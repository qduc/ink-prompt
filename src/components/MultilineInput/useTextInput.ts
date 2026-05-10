import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  createBuffer,
  insertText as bufferInsertText,
  deleteChar as bufferDeleteChar,
  deleteCharForward as bufferDeleteCharForward,
  insertNewLine as bufferInsertNewLine,
  moveCursor as bufferMoveCursor,
  getTextContent,
  getOffset,
  getCursor,
  getVisualRows,
} from './TextBuffer.js';
import type { Buffer, Cursor, Direction, PlaceholderState } from './types.js';
import {
  createPlaceholderState,
  addPlaceholder,
  removePlaceholder,
  getValue,
  getValueCursorOffset,
  getCursorFromValueOffset,
  getDisplayLine,
  bufferColToDisplayCol,
  displayColToBufferCol,
  findPlaceholderAt,
  findPlaceholderAfter,
  findPlaceholderBefore,
} from './Placeholder.js';
import { log } from '../../utils/logger.js';

export interface UseTextInputProps {
  initialValue?: string;
  /** Terminal width for visual-aware cursor navigation (up/down arrows respect line wrapping) */
  width?: number;
  /** Maximum number of history entries to keep (default: 100) */
  historyLimit?: number;
  /**
   * When > 0, consecutive single-character inserts are batched into a single undo step.
   * A batch is committed after this many milliseconds of inactivity (default: 200).
   */
  undoDebounceMs?: number;
  /**
   * When set, pasted text exceeding this character count is replaced
   * with a placeholder for cleaner display.
   */
  pasteThreshold?: number;
  /**
   * Custom formatter for placeholder display text.
   * Default: (id) => `[Paste text #${id}]`
   */
  formatPastePlaceholder?: (id: number) => string;
}

export interface UseTextInputResult {
  value: string;
  cursor: Cursor;
  buffer: Buffer;
  insert: (char: string) => void;
  delete: () => void;
  deleteForward: () => void;
  newLine: () => void;
  deleteAndNewLine: () => void;
  moveCursor: (direction: Direction) => void;
  undo: () => void;
  redo: () => void;
  setText: (text: string) => void;
  cursorOffset: number;
  setCursorOffset: (offset: number) => void;
  placeholderState: PlaceholderState;
}

interface HistoryState {
  buffer: Buffer;
  cursor: Cursor;
  placeholderState: PlaceholderState;
}

const defaultFormatPlaceholder = (id: number) => `[Paste text #${id}]`;

export function useTextInput({
  initialValue = '',
  width,
  historyLimit = 100,
  undoDebounceMs = 200,
  pasteThreshold,
  formatPastePlaceholder = defaultFormatPlaceholder,
}: UseTextInputProps = {}): UseTextInputResult {
  const [buffer, setBuffer] = useState<Buffer>(() => createBuffer(initialValue));
  const [cursor, setCursor] = useState<Cursor>(() => {
    const lines = initialValue.split('\n');
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length,
    };
  });
  const [placeholderState, setPlaceholderState] = useState<PlaceholderState>(() => createPlaceholderState());

  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  const pendingInsertBatchRef = useRef<{
    startState?: HistoryState;
    timerId?: ReturnType<typeof setTimeout>;
  }>({});

  const clearPendingInsertTimer = useCallback(() => {
    if (pendingInsertBatchRef.current.timerId) {
      clearTimeout(pendingInsertBatchRef.current.timerId);
      pendingInsertBatchRef.current.timerId = undefined;
    }
  }, []);

  const appendUndoState = useCallback((state: HistoryState) => {
    setUndoStack((prev) => {
      const newStack = [...prev, state];
      if (newStack.length > historyLimit) {
        return newStack.slice(-historyLimit);
      }
      return newStack;
    });
  }, [historyLimit]);

  const commitPendingInsertBatch = useCallback(() => {
    const startState = pendingInsertBatchRef.current.startState;
    if (!startState) return;

    clearPendingInsertTimer();
    pendingInsertBatchRef.current.startState = undefined;
    appendUndoState(startState);
  }, [appendUndoState, clearPendingInsertTimer]);

  const schedulePendingInsertCommit = useCallback(() => {
    if (undoDebounceMs <= 0) return;

    clearPendingInsertTimer();
    pendingInsertBatchRef.current.timerId = setTimeout(() => {
      commitPendingInsertBatch();
    }, undoDebounceMs);
  }, [clearPendingInsertTimer, commitPendingInsertBatch, undoDebounceMs]);

  const beginOrRefreshInsertBatch = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    if (!pendingInsertBatchRef.current.startState) {
      pendingInsertBatchRef.current.startState = {
        buffer: currentBuffer,
        cursor: currentCursor,
        placeholderState: placeholderState,
      };
      setRedoStack([]);
    }
    schedulePendingInsertCommit();
  }, [schedulePendingInsertCommit, placeholderState]);

  const flushPendingInsertBatch = useCallback(() => {
    commitPendingInsertBatch();
  }, [commitPendingInsertBatch]);

  const pushToHistory = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    appendUndoState({
      buffer: currentBuffer,
      cursor: currentCursor,
      placeholderState: placeholderState,
    });
    setRedoStack([]);
  }, [appendUndoState, placeholderState]);

  useEffect(() => {
    return () => {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;
    };
  }, [clearPendingInsertTimer]);

  const insert = useCallback(
    (char: string) => {
      log(`[INSERT] char="${char.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" len=${char.length} cursor={line:${cursor.line},col:${cursor.column}} linesBefore=${buffer.lines.length}`);

      const normalized = char.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\x00/g, '');

      if (normalized.length === 0) return;

      // Check if this is a paste exceeding the threshold
      if (pasteThreshold !== undefined && pasteThreshold > 0 && normalized.length > pasteThreshold) {
        flushPendingInsertBatch();
        pushToHistory(buffer, cursor);

        const { id, marker, state: newPlaceholderState } = addPlaceholder(
          placeholderState,
          normalized,
          formatPastePlaceholder(placeholderState.nextId)
        );
        setPlaceholderState(newPlaceholderState);

        const result = bufferInsertText(buffer, cursor, marker);
        setBuffer(result.buffer);
        setCursor(result.cursor);
        return;
      }

      const canBatchInsert =
        undoDebounceMs > 0 &&
        normalized.length === 1 &&
        normalized !== '\n';

      if (canBatchInsert) {
        beginOrRefreshInsertBatch(buffer, cursor);
      } else {
        flushPendingInsertBatch();
        pushToHistory(buffer, cursor);
      }

      const result = bufferInsertText(buffer, cursor, normalized);
      setBuffer(result.buffer);
      setCursor(result.cursor);
    },
    [beginOrRefreshInsertBatch, buffer, cursor, flushPendingInsertBatch, pushToHistory, undoDebounceMs, pasteThreshold, placeholderState, formatPastePlaceholder]
  );

  const deleteChar = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);

    const line = buffer.lines[cursor.line];
    const marker = findPlaceholderBefore(line, cursor.column);
    if (marker) {
      const newLine = line.slice(0, marker.start) + line.slice(marker.end);
      const newLines = [...buffer.lines];
      newLines[cursor.line] = newLine;
      setBuffer({ lines: newLines });
      setCursor({ line: cursor.line, column: marker.start });
      setPlaceholderState(prev => removePlaceholder(prev, marker.id));
      return;
    }

    const result = bufferDeleteChar(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const deleteCharForward = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);

    const line = buffer.lines[cursor.line];
    const marker = findPlaceholderAfter(line, cursor.column);
    if (marker) {
      const newLine = line.slice(0, marker.start) + line.slice(marker.end);
      const newLines = [...buffer.lines];
      newLines[cursor.line] = newLine;
      setBuffer({ lines: newLines });
      setPlaceholderState(prev => removePlaceholder(prev, marker.id));
      return;
    }

    const result = bufferDeleteCharForward(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const newLine = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);
    const result = bufferInsertNewLine(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const deleteAndNewLine = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);
    const afterDelete = bufferDeleteChar(buffer, cursor);
    const afterNewLine = bufferInsertNewLine(afterDelete.buffer, afterDelete.cursor);
    setBuffer(afterNewLine.buffer);
    setCursor(afterNewLine.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const moveCursor = useCallback(
    (direction: Direction) => {
      flushPendingInsertBatch();

      let newCursor = bufferMoveCursor(buffer, cursor, direction, width);

      // Handle placeholder markers: skip over them for left/right
      if (placeholderState.placeholders.size > 0) {
        if (direction === 'left' || direction === 'right') {
          const marker = findPlaceholderAt(buffer.lines[newCursor.line], newCursor.column);
          if (marker) {
            newCursor = {
              ...newCursor,
              column: direction === 'left' ? marker.start : marker.end,
            };
          }
        }

        // For up/down with visual-aware navigation, use display-space conversion
        if ((direction === 'up' || direction === 'down') && width !== undefined) {
          const { line, column } = newCursor;
          const currentLine = buffer.lines[line];
          const displayLine = getDisplayLine(currentLine, placeholderState.placeholders);
          const displayCol = bufferColToDisplayCol(currentLine, column, placeholderState.placeholders);
          const rows = getVisualRows(displayLine, width);

          const getVisualPos = (col: number, str: string) => {
            const r = getVisualRows(str, width);
            for (let i = 0; i < r.length; i++) {
              const rowEnd = r[i].start + r[i].length;
              if (col >= r[i].start && col < rowEnd) {
                return { visualRow: i, visualCol: col - r[i].start };
              }
              if (col === rowEnd && i === r.length - 1) {
                return { visualRow: i, visualCol: r[i].length };
              }
            }
            for (let i = 0; i < r.length; i++) {
              if (col === r[i].start + r[i].length && i < r.length - 1) {
                return { visualRow: i + 1, visualCol: 0 };
              }
            }
            const lastRow = r[r.length - 1];
            return { visualRow: r.length - 1, visualCol: lastRow.length };
          };

          const visualPos = getVisualPos(displayCol, displayLine);
          const displayRowCount = rows.length;

          if (direction === 'up') {
            if (visualPos.visualRow > 0) {
              const targetVisRow = visualPos.visualRow - 1;
              const targetVisRowLen = targetVisRow < rows.length ? rows[targetVisRow].length : 0;
              const targetVisCol = Math.min(visualPos.visualCol, targetVisRowLen);
              const targetDispCol = Math.min(rows[targetVisRow].start + targetVisCol, displayLine.length);
              const targetBufCol = displayColToBufferCol(currentLine, targetDispCol, placeholderState.placeholders);
              newCursor = { line, column: targetBufCol };
            } else if (line > 0) {
              const prevLine = buffer.lines[line - 1];
              const prevDisplayLine = getDisplayLine(prevLine, placeholderState.placeholders);
              const prevRows = getVisualRows(prevDisplayLine, width);
              const targetVisRow = prevRows.length - 1;
              const targetVisRowLen = targetVisRow >= 0 ? prevRows[targetVisRow].length : 0;
              const targetVisCol = Math.min(visualPos.visualCol, targetVisRowLen);
              const targetDispCol = targetVisRow >= 0 ? Math.min(prevRows[targetVisRow].start + targetVisCol, prevDisplayLine.length) : 0;
              const targetBufCol = displayColToBufferCol(prevLine, targetDispCol, placeholderState.placeholders);
              newCursor = { line: line - 1, column: targetBufCol };
            }
          } else {
            if (visualPos.visualRow < displayRowCount - 1) {
              const targetVisRow = visualPos.visualRow + 1;
              const targetVisRowLen = targetVisRow < rows.length ? rows[targetVisRow].length : 0;
              const targetVisCol = Math.min(visualPos.visualCol, targetVisRowLen);
              const targetDispCol = Math.min(rows[targetVisRow].start + targetVisCol, displayLine.length);
              const targetBufCol = displayColToBufferCol(currentLine, targetDispCol, placeholderState.placeholders);
              newCursor = { line, column: targetBufCol };
            } else if (line < buffer.lines.length - 1) {
              const nextLine = buffer.lines[line + 1];
              const nextDisplayLine = getDisplayLine(nextLine, placeholderState.placeholders);
              const firstRowLen = nextDisplayLine.length > 0 ? (getVisualRows(nextDisplayLine, width)[0]?.length ?? 0) : 0;
              const targetVisCol = Math.min(visualPos.visualCol, firstRowLen);
              const targetBufCol = displayColToBufferCol(nextLine, targetVisCol, placeholderState.placeholders);
              newCursor = { line: line + 1, column: targetBufCol };
            }
          }
        }
      }

      setCursor(newCursor);
    },
    [buffer, cursor, flushPendingInsertBatch, width, placeholderState]
  );

  const undo = useCallback(() => {
    const pendingStartState = pendingInsertBatchRef.current.startState;
    if (pendingStartState) {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;

      setRedoStack((prev) => [...prev, {
        buffer,
        cursor,
        placeholderState: placeholderState,
      }]);
      setBuffer(pendingStartState.buffer);
      setCursor(pendingStartState.cursor);
      if (pendingStartState.placeholderState) {
        setPlaceholderState(pendingStartState.placeholderState);
      }
      return;
    }

    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, {
      buffer,
      cursor,
      placeholderState: placeholderState,
    }]);
    setBuffer(previousState.buffer);
    setCursor(previousState.cursor);
    setPlaceholderState(previousState.placeholderState);
    setUndoStack(newUndoStack);
  }, [buffer, clearPendingInsertTimer, cursor, undoStack, placeholderState]);

  const redo = useCallback(() => {
    if (pendingInsertBatchRef.current.startState) {
      return;
    }

    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [...prev, {
      buffer,
      cursor,
      placeholderState: placeholderState,
    }]);
    setBuffer(nextState.buffer);
    setCursor(nextState.cursor);
    setPlaceholderState(nextState.placeholderState);
    setRedoStack(newRedoStack);
  }, [buffer, cursor, redoStack, placeholderState]);

  const setText = useCallback(
    (text: string) => {
      flushPendingInsertBatch();
      pushToHistory(buffer, cursor);
      const newBuffer = createBuffer(text);
      setBuffer(newBuffer);
      setPlaceholderState(createPlaceholderState());

      const lines = text.split('\n');
      setCursor({
        line: lines.length - 1,
        column: lines[lines.length - 1].length,
      });
    },
    [buffer, cursor, flushPendingInsertBatch, pushToHistory]
  );

  const value = useMemo(
    () => getValue(buffer.lines, placeholderState.placeholders),
    [buffer.lines, placeholderState.placeholders]
  );

  const cursorOffset = useMemo(
    () => getValueCursorOffset(buffer.lines, cursor, placeholderState.placeholders),
    [buffer.lines, cursor, placeholderState.placeholders]
  );

  return {
    value,
    cursor,
    buffer,
    insert,
    delete: deleteChar,
    deleteForward: deleteCharForward,
    newLine,
    deleteAndNewLine,
    moveCursor,
    undo,
    redo,
    setText,
    cursorOffset,
    setCursorOffset: useCallback(
      (offset: number) => {
        flushPendingInsertBatch();
        setCursor(getCursorFromValueOffset(buffer.lines, offset, placeholderState.placeholders));
      },
      [buffer.lines, flushPendingInsertBatch, placeholderState.placeholders]
    ),
    placeholderState,
  };
}

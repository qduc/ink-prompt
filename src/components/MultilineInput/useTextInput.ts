import { useState, useCallback, useEffect, useRef } from 'react';
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
} from './TextBuffer.js';
import type { Buffer, Cursor, Direction } from './types.js';
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
}

export interface UseTextInputResult {
  value: string;
  cursor: Cursor;
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
}

interface HistoryState {
  buffer: Buffer;
  cursor: Cursor;
}

export function useTextInput({
  initialValue = '',
  width,
  historyLimit = 100,
  undoDebounceMs = 200,
}: UseTextInputProps = {}): UseTextInputResult {
  const [buffer, setBuffer] = useState<Buffer>(() => createBuffer(initialValue));
  const [cursor, setCursor] = useState<Cursor>(() => {
    const lines = initialValue.split('\n');
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length,
    };
  });

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
      pendingInsertBatchRef.current.startState = { buffer: currentBuffer, cursor: currentCursor };
      setRedoStack([]);
    }
    schedulePendingInsertCommit();
  }, [schedulePendingInsertCommit]);

  const flushPendingInsertBatch = useCallback(() => {
    commitPendingInsertBatch();
  }, [commitPendingInsertBatch]);

  const pushToHistory = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    appendUndoState({ buffer: currentBuffer, cursor: currentCursor });
    setRedoStack([]);
  }, [appendUndoState]);

  useEffect(() => {
    return () => {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;
    };
  }, [clearPendingInsertTimer]);

  const insert = useCallback(
    (char: string) => {
      log(`[INSERT] char="${char.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" len=${char.length} cursor={line:${cursor.line},col:${cursor.column}} linesBefore=${buffer.lines.length}`);

      // Normalize line endings: \r\n → \n, \r → \n (handles Windows, Unix, and old Mac)
      const normalized = char.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

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

      // TextBuffer now handles multi-line insertion internally
      const result = bufferInsertText(buffer, cursor, normalized);
      setBuffer(result.buffer);
      setCursor(result.cursor);
    },
    [beginOrRefreshInsertBatch, buffer, cursor, flushPendingInsertBatch, pushToHistory, undoDebounceMs]
  );

  const deleteChar = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);
    const result = bufferDeleteChar(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const deleteCharForward = useCallback(() => {
    flushPendingInsertBatch();
    pushToHistory(buffer, cursor);
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
    // First delete the character before cursor (the backslash)
    const afterDelete = bufferDeleteChar(buffer, cursor);
    // Then insert newline using the updated buffer and cursor
    const afterNewLine = bufferInsertNewLine(afterDelete.buffer, afterDelete.cursor);
    setBuffer(afterNewLine.buffer);
    setCursor(afterNewLine.cursor);
  }, [buffer, cursor, flushPendingInsertBatch, pushToHistory]);

  const moveCursor = useCallback(
    (direction: Direction) => {
      flushPendingInsertBatch();
      const newCursor = bufferMoveCursor(buffer, cursor, direction, width);
      setCursor(newCursor);
    },
    [buffer, cursor, flushPendingInsertBatch, width]
  );

  const undo = useCallback(() => {
    const pendingStartState = pendingInsertBatchRef.current.startState;
    if (pendingStartState) {
      clearPendingInsertTimer();
      pendingInsertBatchRef.current.startState = undefined;

      setRedoStack((prev) => [...prev, { buffer, cursor }]);
      setBuffer(pendingStartState.buffer);
      setCursor(pendingStartState.cursor);
      return;
    }

    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, { buffer, cursor }]);
    setBuffer(previousState.buffer);
    setCursor(previousState.cursor);
    setUndoStack(newUndoStack);
  }, [buffer, clearPendingInsertTimer, cursor, undoStack]);

  const redo = useCallback(() => {
    if (pendingInsertBatchRef.current.startState) {
      return;
    }

    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [...prev, { buffer, cursor }]);
    setBuffer(nextState.buffer);
    setCursor(nextState.cursor);
    setRedoStack(newRedoStack);
  }, [buffer, cursor, redoStack]);

  const setText = useCallback(
    (text: string) => {
      flushPendingInsertBatch();
      pushToHistory(buffer, cursor);
      const newBuffer = createBuffer(text);
      setBuffer(newBuffer);

      // Move cursor to end of new text
      const lines = text.split('\n');
      setCursor({
        line: lines.length - 1,
        column: lines[lines.length - 1].length,
      });
    },
    [buffer, cursor, flushPendingInsertBatch, pushToHistory]
  );

  return {
    value: getTextContent(buffer),
    cursor,
    insert,
    delete: deleteChar,
    deleteForward: deleteCharForward,
    newLine,
    deleteAndNewLine,
    moveCursor,
    undo,
    redo,
    setText,
    cursorOffset: getOffset(buffer, cursor),
    setCursorOffset: useCallback(
      (offset: number) => {
        flushPendingInsertBatch();
        setCursor(getCursor(buffer, offset));
      },
      [buffer, flushPendingInsertBatch]
    ),
  };
}

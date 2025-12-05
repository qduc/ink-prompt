import { useState, useCallback } from 'react';
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

export function useTextInput({ initialValue = '', width }: UseTextInputProps = {}): UseTextInputResult {
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

  const pushToHistory = useCallback((currentBuffer: Buffer, currentCursor: Cursor) => {
    setUndoStack((prev) => [...prev, { buffer: currentBuffer, cursor: currentCursor }]);
    setRedoStack([]);
  }, []);

  const insert = useCallback(
    (char: string) => {
      log(`[INSERT] char="${char.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" len=${char.length} cursor={line:${cursor.line},col:${cursor.column}} linesBefore=${buffer.lines.length}`);

      // Normalize line endings: \r\n → \n, \r → \n (handles Windows, Unix, and old Mac)
      const normalized = char.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      pushToHistory(buffer, cursor);

      // TextBuffer now handles multi-line insertion internally
      const result = bufferInsertText(buffer, cursor, normalized);
      setBuffer(result.buffer);
      setCursor(result.cursor);
    },
    [buffer, cursor, pushToHistory]
  );

  const deleteChar = useCallback(() => {
    pushToHistory(buffer, cursor);
    const result = bufferDeleteChar(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, pushToHistory]);

  const deleteCharForward = useCallback(() => {
    pushToHistory(buffer, cursor);
    const result = bufferDeleteCharForward(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, pushToHistory]);

  const newLine = useCallback(() => {
    pushToHistory(buffer, cursor);
    const result = bufferInsertNewLine(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, pushToHistory]);

  const deleteAndNewLine = useCallback(() => {
    pushToHistory(buffer, cursor);
    // First delete the character before cursor (the backslash)
    const afterDelete = bufferDeleteChar(buffer, cursor);
    // Then insert newline using the updated buffer and cursor
    const afterNewLine = bufferInsertNewLine(afterDelete.buffer, afterDelete.cursor);
    setBuffer(afterNewLine.buffer);
    setCursor(afterNewLine.cursor);
  }, [buffer, cursor, pushToHistory]);

  const moveCursor = useCallback(
    (direction: Direction) => {
      const newCursor = bufferMoveCursor(buffer, cursor, direction, width);
      setCursor(newCursor);
    },
    [buffer, cursor, width]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, { buffer, cursor }]);
    setBuffer(previousState.buffer);
    setCursor(previousState.cursor);
    setUndoStack(newUndoStack);
  }, [buffer, cursor, undoStack]);

  const redo = useCallback(() => {
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
    [buffer, cursor, pushToHistory]
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
        setCursor(getCursor(buffer, offset));
      },
      [buffer]
    ),
  };
}

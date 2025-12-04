import { useState, useCallback } from 'react';
import {
  createBuffer,
  insertChar as bufferInsertChar,
  deleteChar as bufferDeleteChar,
  insertNewLine as bufferInsertNewLine,
  moveCursor as bufferMoveCursor,
  getTextContent,
} from './TextBuffer';
import type { Buffer, Cursor, Direction } from './types';

export interface UseTextInputProps {
  initialValue?: string;
}

export interface UseTextInputResult {
  value: string;
  cursor: Cursor;
  insert: (char: string) => void;
  delete: () => void;
  newLine: () => void;
  moveCursor: (direction: Direction) => void;
  undo: () => void;
  redo: () => void;
  setText: (text: string) => void;
}

interface HistoryState {
  buffer: Buffer;
  cursor: Cursor;
}

export function useTextInput({ initialValue = '' }: UseTextInputProps = {}): UseTextInputResult {
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
      pushToHistory(buffer, cursor);
      const result = bufferInsertChar(buffer, cursor, char);
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

  const newLine = useCallback(() => {
    pushToHistory(buffer, cursor);
    const result = bufferInsertNewLine(buffer, cursor);
    setBuffer(result.buffer);
    setCursor(result.cursor);
  }, [buffer, cursor, pushToHistory]);

  const moveCursor = useCallback(
    (direction: Direction) => {
      const newCursor = bufferMoveCursor(buffer, cursor, direction);
      setCursor(newCursor);
    },
    [buffer, cursor]
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
    newLine,
    moveCursor,
    undo,
    redo,
    setText,
  };
}

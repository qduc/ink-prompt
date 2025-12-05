import type { Buffer, Cursor, Direction } from './types.js';

/**
 * Create a new buffer from optional initial text
 */
export function createBuffer(text?: string): Buffer {
  if (!text) {
    return { lines: [''] };
  }
  return { lines: text.split('\n') };
}

/**
 * Insert text at the cursor position.
 * Handles both single-line and multi-line text (containing \n).
 */
export function insertText(
  buffer: Buffer,
  cursor: Cursor,
  text: string
): { buffer: Buffer; cursor: Cursor } {
  if (!text) return { buffer, cursor };

  const { line, column } = cursor;
  const currentLine = buffer.lines[line];

  // Insert text and handle newlines
  const beforeCursor = currentLine.slice(0, column);
  const afterCursor = currentLine.slice(column);
  const fullText = beforeCursor + text + afterCursor;

  // Split into lines
  const newLines = fullText.split('\n');

  // Calculate new cursor position
  const textLines = text.split('\n');
  const cursorLine = line + (textLines.length - 1);
  const cursorColumn = textLines.length === 1
    ? column + text.length
    : textLines[textLines.length - 1].length;

  // Rebuild buffer
  const resultLines = [
    ...buffer.lines.slice(0, line),
    ...newLines,
    ...buffer.lines.slice(line + 1),
  ];

  return {
    buffer: { lines: resultLines },
    cursor: { line: cursorLine, column: cursorColumn },
  };
}

/**
 * Delete character before cursor (backspace)
 */
export function deleteChar(
  buffer: Buffer,
  cursor: Cursor
): { buffer: Buffer; cursor: Cursor } {
  const { line, column } = cursor;

  // At the very start of the buffer - nothing to delete
  if (line === 0 && column === 0) {
    return { buffer, cursor };
  }

  // At the start of a line - merge with previous line
  if (column === 0) {
    const previousLine = buffer.lines[line - 1];
    const currentLine = buffer.lines[line];
    const mergedLine = previousLine + currentLine;

    const newLines = [...buffer.lines];
    newLines[line - 1] = mergedLine;
    newLines.splice(line, 1);

    return {
      buffer: { lines: newLines },
      cursor: { line: line - 1, column: previousLine.length },
    };
  }

  // Delete character within the line
  const currentLine = buffer.lines[line];
  const newLine = currentLine.slice(0, column - 1) + currentLine.slice(column);

  const newLines = [...buffer.lines];
  newLines[line] = newLine;

  return {
    buffer: { lines: newLines },
    cursor: { line, column: column - 1 },
  };
}

/**
 * Delete character after cursor (forward delete / Delete key)
 */
export function deleteCharForward(
  buffer: Buffer,
  cursor: Cursor
): { buffer: Buffer; cursor: Cursor } {
  const { line, column } = cursor;
  const currentLine = buffer.lines[line];
  const lineCount = buffer.lines.length;

  // At the very end of the buffer - nothing to delete
  if (line === lineCount - 1 && column >= currentLine.length) {
    return { buffer, cursor };
  }

  // At the end of a line - merge with next line
  if (column >= currentLine.length) {
    const nextLine = buffer.lines[line + 1];
    const mergedLine = currentLine + nextLine;

    const newLines = [...buffer.lines];
    newLines[line] = mergedLine;
    newLines.splice(line + 1, 1);

    return {
      buffer: { lines: newLines },
      cursor, // Cursor stays in place
    };
  }

  // Delete character after cursor within the line
  const newLine = currentLine.slice(0, column) + currentLine.slice(column + 1);

  const newLines = [...buffer.lines];
  newLines[line] = newLine;

  return {
    buffer: { lines: newLines },
    cursor, // Cursor stays in place
  };
}

/**
 * Insert a new line at cursor position (splits current line)
 */
export function insertNewLine(
  buffer: Buffer,
  cursor: Cursor
): { buffer: Buffer; cursor: Cursor } {
  const { line, column } = cursor;
  const currentLine = buffer.lines[line];

  const beforeCursor = currentLine.slice(0, column);
  const afterCursor = currentLine.slice(column);

  const newLines = [...buffer.lines];
  newLines[line] = beforeCursor;
  newLines.splice(line + 1, 0, afterCursor);

  return {
    buffer: { lines: newLines },
    cursor: { line: line + 1, column: 0 },
  };
}

/**
 * Move cursor in specified direction with bounds checking
 */
export function moveCursor(
  buffer: Buffer,
  cursor: Cursor,
  direction: Direction
): Cursor {
  const { line, column } = cursor;
  const currentLine = buffer.lines[line];
  const lineCount = buffer.lines.length;

  switch (direction) {
    case 'left':
      if (column > 0) {
        return { line, column: column - 1 };
      }
      // Wrap to end of previous line
      if (line > 0) {
        return { line: line - 1, column: buffer.lines[line - 1].length };
      }
      return cursor;

    case 'right':
      if (column < currentLine.length) {
        return { line, column: column + 1 };
      }
      // Wrap to start of next line
      if (line < lineCount - 1) {
        return { line: line + 1, column: 0 };
      }
      return cursor;

    case 'up':
      if (line > 0) {
        const targetLine = buffer.lines[line - 1];
        return { line: line - 1, column: Math.min(column, targetLine.length) };
      }
      return cursor;

    case 'down':
      if (line < lineCount - 1) {
        const targetLine = buffer.lines[line + 1];
        return { line: line + 1, column: Math.min(column, targetLine.length) };
      }
      return cursor;

    case 'lineStart':
      return { line, column: 0 };

    case 'lineEnd':
      return { line, column: currentLine.length };

    default:
      return cursor;
  }
}

/**
 * Get the full text content from buffer (lines joined with newlines)
 */
export function getTextContent(buffer: Buffer): string {
  // Single empty line is considered empty buffer
  if (buffer.lines.length === 1 && buffer.lines[0] === '') {
    return '';
  }
  return buffer.lines.join('\n');
}

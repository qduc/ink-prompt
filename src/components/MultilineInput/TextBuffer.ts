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
 * Calculate which visual row (within a buffer line) the cursor is on,
 * and the column within that visual row.
 */
function getVisualPosition(
  bufferColumn: number,
  lineLength: number,
  width: number
): { visualRow: number; visualCol: number } {
  if (lineLength <= width) {
    return { visualRow: 0, visualCol: bufferColumn };
  }
  const visualRow = Math.floor(bufferColumn / width);
  const visualCol = bufferColumn % width;
  return { visualRow, visualCol };
}

/**
 * Calculate how many visual rows a buffer line takes.
 */
function getVisualRowCount(lineLength: number, width: number): number {
  if (lineLength === 0) return 1;
  return Math.ceil(lineLength / width);
}

/**
 * Convert visual position back to buffer column.
 */
function visualToBufferColumn(
  visualRow: number,
  visualCol: number,
  lineLength: number,
  width: number
): number {
  const bufferColumn = visualRow * width + visualCol;
  return Math.min(bufferColumn, lineLength);
}

/**
 * Get the length of a specific visual row within a buffer line.
 */
function getVisualRowLength(
  lineLength: number,
  visualRow: number,
  width: number
): number {
  const totalVisualRows = getVisualRowCount(lineLength, width);
  if (visualRow >= totalVisualRows) return 0;

  if (visualRow === totalVisualRows - 1) {
    // Last visual row - might be shorter
    const remaining = lineLength - visualRow * width;
    return remaining;
  }
  return width;
}

/**
 * Move cursor in specified direction with bounds checking.
 * When width is provided, up/down movement is based on visual lines (accounting for wrapping).
 * When width is not provided, up/down movement is based on buffer lines.
 */
export function moveCursor(
  buffer: Buffer,
  cursor: Cursor,
  direction: Direction,
  width?: number
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
      if (width !== undefined) {
        // Visual-aware movement
        const { visualRow, visualCol } = getVisualPosition(column, currentLine.length, width);

        if (visualRow > 0) {
          // Move to previous visual row within the same buffer line
          const targetVisualRow = visualRow - 1;
          const targetVisualRowLength = getVisualRowLength(currentLine.length, targetVisualRow, width);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line, column: visualToBufferColumn(targetVisualRow, targetVisualCol, currentLine.length, width) };
        }

        // At first visual row of current line - move to last visual row of previous buffer line
        if (line > 0) {
          const prevLine = buffer.lines[line - 1];
          const prevLineVisualRows = getVisualRowCount(prevLine.length, width);
          const targetVisualRow = prevLineVisualRows - 1;
          const targetVisualRowLength = getVisualRowLength(prevLine.length, targetVisualRow, width);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line: line - 1, column: visualToBufferColumn(targetVisualRow, targetVisualCol, prevLine.length, width) };
        }

        return cursor;
      }

      // Buffer-line movement (no width provided)
      if (line > 0) {
        const targetLine = buffer.lines[line - 1];
        return { line: line - 1, column: Math.min(column, targetLine.length) };
      }
      return cursor;

    case 'down':
      if (width !== undefined) {
        // Visual-aware movement
        const { visualRow, visualCol } = getVisualPosition(column, currentLine.length, width);
        const currentLineVisualRows = getVisualRowCount(currentLine.length, width);

        if (visualRow < currentLineVisualRows - 1) {
          // Move to next visual row within the same buffer line
          const targetVisualRow = visualRow + 1;
          const targetVisualRowLength = getVisualRowLength(currentLine.length, targetVisualRow, width);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line, column: visualToBufferColumn(targetVisualRow, targetVisualCol, currentLine.length, width) };
        }

        // At last visual row of current line - move to first visual row of next buffer line
        if (line < lineCount - 1) {
          const nextLine = buffer.lines[line + 1];
          const targetVisualRowLength = getVisualRowLength(nextLine.length, 0, width);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line: line + 1, column: Math.min(targetVisualCol, nextLine.length) };
        }

        return cursor;
      }

      // Buffer-line movement (no width provided)
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

/**
 * Get the flat offset (index) from a cursor position.
 */
export function getOffset(buffer: Buffer, cursor: Cursor): number {
  let offset = 0;
  for (let i = 0; i < cursor.line; i++) {
    offset += buffer.lines[i].length + 1; // +1 for the newline
  }
  offset += cursor.column;
  return offset;
}

/**
 * Get the cursor position from a flat offset.
 */
export function getCursor(buffer: Buffer, offset: number): Cursor {
  let currentOffset = 0;
  for (let i = 0; i < buffer.lines.length; i++) {
    const lineLength = buffer.lines[i].length;
    // Check if the offset falls within this line (including the newline character unless it's the last line)
    // We treat the position *after* the newline as the start of the next line.
    // Position *at* the end of line (before newline) is valid cursor column.

    // If we are on the last line, we accept up to lineLength
    if (i === buffer.lines.length - 1) {
      if (offset <= currentOffset + lineLength) {
        return { line: i, column: Math.max(0, offset - currentOffset) };
      }
      // If offset is beyond the content, clamp to end
      return { line: i, column: lineLength };
    }

    // For non-last lines, we account for newline character (+1)
    if (offset <= currentOffset + lineLength) {
      return { line: i, column: Math.max(0, offset - currentOffset) };
    }

    // If offset is exactly at the newline character, it depends on interpretation.
    // Usually, cursor at the newline means it's at the end of the line.
    // But if we are "past" the newline, we are on the start of next line.
    // Logic:
    // Line 0: "abc" (len 3). Newline at index 3.
    // Index 0='a', 1='b', 2='c', 3='\n'.
    // If target offset is 3: That's end of line 0.
    // If target offset is 4: That's start of line 1.
    // currentOffset + lineLength is index of newline.

    // If offset == currentOffset + lineLength + 1, we move to next loop

    currentOffset += lineLength + 1;
  }

  // Fallback (should have returned in loop)
  const lastLineIdx = buffer.lines.length - 1;
  return { line: lastLineIdx, column: buffer.lines[lastLineIdx].length };
}

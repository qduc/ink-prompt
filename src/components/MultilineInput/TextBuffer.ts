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
 * Information about a visual row within a wrapped line.
 */
interface VisualRowInfo {
  /** Starting offset in the buffer line */
  start: number;
  /** Length of this visual row */
  length: number;
}

/**
 * Break a line into visual rows using word-aware wrapping.
 * Words are kept intact when possible, breaking at spaces.
 * Long words that exceed width are hard-wrapped.
 */
export function getVisualRows(line: string, width: number): VisualRowInfo[] {
  const safeWidth = Math.max(1, width);
  const rows: VisualRowInfo[] = [];

  if (line.length === 0) {
    return [{ start: 0, length: 0 }];
  }

  let offset = 0;
  let remaining = line;

  while (remaining.length > 0) {
    let chunkLength = safeWidth;

    if (remaining.length <= safeWidth) {
      chunkLength = remaining.length;
    } else {
      // Find split point (last space within width)
      let splitIndex = -1;
      for (let i = safeWidth - 1; i >= 0; i--) {
        if (remaining[i] === ' ') {
          splitIndex = i;
          break;
        }
      }

      if (splitIndex !== -1) {
        // Include the space in the chunk
        chunkLength = splitIndex + 1;
      }
    }

    rows.push({ start: offset, length: chunkLength });
    remaining = remaining.slice(chunkLength);
    offset += chunkLength;
  }

  return rows;
}

/**
 * Calculate which visual row (within a buffer line) the cursor is on,
 * and the column within that visual row.
 * Uses word-aware wrapping.
 */
function getVisualPosition(
  bufferColumn: number,
  line: string,
  width: number
): { visualRow: number; visualCol: number } {
  const rows = getVisualRows(line, width);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowEnd = row.start + row.length;

    if (bufferColumn >= row.start && bufferColumn < rowEnd) {
      return { visualRow: i, visualCol: bufferColumn - row.start };
    }
    // Handle cursor at the very end of this row
    if (bufferColumn === rowEnd && i === rows.length - 1) {
      return { visualRow: i, visualCol: row.length };
    }
  }

  // Cursor at wrap point - belongs to the next row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (bufferColumn === row.start + row.length && i < rows.length - 1) {
      return { visualRow: i + 1, visualCol: 0 };
    }
  }

  // Fallback: cursor at end of line
  const lastRow = rows[rows.length - 1];
  return { visualRow: rows.length - 1, visualCol: lastRow.length };
}

/**
 * Calculate how many visual rows a buffer line takes.
 * Uses word-aware wrapping.
 */
function getVisualRowCount(line: string, width: number): number {
  return getVisualRows(line, width).length;
}

/**
 * Convert visual position back to buffer column.
 * Uses word-aware wrapping.
 */
function visualToBufferColumn(
  visualRow: number,
  visualCol: number,
  line: string,
  width: number
): number {
  const rows = getVisualRows(line, width);
  if (visualRow >= rows.length) {
    return line.length;
  }
  const row = rows[visualRow];
  return Math.min(row.start + visualCol, line.length);
}

/**
 * Get the length of a specific visual row within a buffer line.
 * Uses word-aware wrapping.
 */
function getVisualRowLength(
  line: string,
  visualRow: number,
  width: number
): number {
  const rows = getVisualRows(line, width);
  if (visualRow >= rows.length) return 0;
  return rows[visualRow].length;
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
        // Visual-aware movement (word-aware wrapping)
        const { visualRow, visualCol } = getVisualPosition(column, currentLine, width);

        if (visualRow > 0) {
          // Move to previous visual row within the same buffer line
          const targetVisualRow = visualRow - 1;
          const targetVisualRowLength = getVisualRowLength(currentLine, targetVisualRow, width);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line, column: visualToBufferColumn(targetVisualRow, targetVisualCol, currentLine, width) };
        }

        // At first visual row of current line - move to last visual row of previous buffer line
        if (line > 0) {
          const prevLine = buffer.lines[line - 1];
          const prevLineVisualRows = getVisualRowCount(prevLine, width);
          const targetVisualRow = prevLineVisualRows - 1;
          const targetVisualRowLength = getVisualRowLength(prevLine, targetVisualRow, width);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line: line - 1, column: visualToBufferColumn(targetVisualRow, targetVisualCol, prevLine, width) };
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
        // Visual-aware movement (word-aware wrapping)
        const { visualRow, visualCol } = getVisualPosition(column, currentLine, width);
        const currentLineVisualRows = getVisualRowCount(currentLine, width);

        if (visualRow < currentLineVisualRows - 1) {
          // Move to next visual row within the same buffer line
          const targetVisualRow = visualRow + 1;
          const targetVisualRowLength = getVisualRowLength(currentLine, targetVisualRow, width);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line, column: visualToBufferColumn(targetVisualRow, targetVisualCol, currentLine, width) };
        }

        // At last visual row of current line - move to first visual row of next buffer line
        if (line < lineCount - 1) {
          const nextLine = buffer.lines[line + 1];
          const targetVisualRowLength = getVisualRowLength(nextLine, 0, width);
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

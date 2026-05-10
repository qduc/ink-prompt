import type { Buffer, Cursor, Direction } from './types.js';
import {
  findAtomicBlocks,
  findAtomicBlockSpanning,
  findAtomicBlockBefore,
  findAtomicBlockAfter,
  type BlockEntries,
} from './AtomicBlocks.js';

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

  const beforeCursor = currentLine.slice(0, column);
  const afterCursor = currentLine.slice(column);
  const fullText = beforeCursor + text + afterCursor;

  const newLines = fullText.split('\n');

  const textLines = text.split('\n');
  const cursorLine = line + (textLines.length - 1);
  const cursorColumn = textLines.length === 1
    ? column + text.length
    : textLines[textLines.length - 1].length;

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
  cursor: Cursor,
  entries?: BlockEntries
): { buffer: Buffer; cursor: Cursor } {
  const { line, column } = cursor;

  if (line === 0 && column === 0) {
    return { buffer, cursor };
  }

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

  const currentLine = buffer.lines[line];
  const block = findAtomicBlockBefore(currentLine, column, entries);
  if (block) {
    const newLine = currentLine.slice(0, block.start) + currentLine.slice(block.end);
    const newLines = [...buffer.lines];
    newLines[line] = newLine;
    return {
      buffer: { lines: newLines },
      cursor: { line, column: block.start },
    };
  }

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
  cursor: Cursor,
  entries?: BlockEntries
): { buffer: Buffer; cursor: Cursor } {
  const { line, column } = cursor;
  const currentLine = buffer.lines[line];
  const lineCount = buffer.lines.length;

  if (line === lineCount - 1 && column >= currentLine.length) {
    return { buffer, cursor };
  }

  if (column >= currentLine.length) {
    const nextLine = buffer.lines[line + 1];
    const mergedLine = currentLine + nextLine;

    const newLines = [...buffer.lines];
    newLines[line] = mergedLine;
    newLines.splice(line + 1, 1);

    return {
      buffer: { lines: newLines },
      cursor,
    };
  }

  const block = findAtomicBlockAfter(currentLine, column, entries);
  if (block) {
    const newLine = currentLine.slice(0, block.start) + currentLine.slice(block.end);
    const newLines = [...buffer.lines];
    newLines[line] = newLine;
    return {
      buffer: { lines: newLines },
      cursor,
    };
  }

  const newLine = currentLine.slice(0, column) + currentLine.slice(column + 1);

  const newLines = [...buffer.lines];
  newLines[line] = newLine;

  return {
    buffer: { lines: newLines },
    cursor,
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

interface VisualRowInfo {
  start: number;
  length: number;
}

function getVisualWidth(char: string): number {
  return 1;
}

function getVisualRowCount(line: string, width: number, entries?: BlockEntries): number {
  return getVisualRows(line, width, entries).length;
}

function visualToBufferColumn(
  visualRow: number,
  visualCol: number,
  line: string,
  width: number,
  entries?: BlockEntries
): number {
  const rows = getVisualRows(line, width, entries);
  if (visualRow >= rows.length) {
    return line.length;
  }
  const row = rows[visualRow];
  return Math.min(row.start + visualCol, line.length);
}

function getVisualRowLength(
  line: string,
  visualRow: number,
  width: number,
  entries?: BlockEntries
): number {
  const rows = getVisualRows(line, width, entries);
  if (visualRow >= rows.length) return 0;
  return rows[visualRow].length;
}

function getVisualPosition(
  bufferColumn: number,
  line: string,
  width: number,
  entries?: BlockEntries
): { visualRow: number; visualCol: number } {
  const rows = getVisualRows(line, width, entries);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowEnd = row.start + row.length;

    if (bufferColumn >= row.start && bufferColumn < rowEnd) {
      return { visualRow: i, visualCol: bufferColumn - row.start };
    }
    if (bufferColumn === rowEnd && i === rows.length - 1) {
      return { visualRow: i, visualCol: row.length };
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (bufferColumn === row.start + row.length && i < rows.length - 1) {
      return { visualRow: i + 1, visualCol: 0 };
    }
  }

  const lastRow = rows[rows.length - 1];
  return { visualRow: rows.length - 1, visualCol: lastRow.length };
}

export function getVisualRows(
  line: string,
  width: number,
  entries?: BlockEntries
): VisualRowInfo[] {
  const safeWidth = Math.max(1, width);
  const rows: VisualRowInfo[] = [];
  const blocks = findAtomicBlocks(line, entries);

  if (blocks.length > 0) {
    return getVisualRowsWithBlocks(line, safeWidth, rows, blocks);
  }

  let offset = 0;
  let remaining = line;
  while (remaining.length > 0) {
    let chunkLength = safeWidth;
    if (remaining.length <= safeWidth) {
      chunkLength = remaining.length;
    } else {
      let splitIndex = -1;
      for (let i = safeWidth - 1; i >= 0; i--) {
        if (remaining[i] === ' ') {
          splitIndex = i;
          break;
        }
      }
      if (splitIndex !== -1) {
        chunkLength = splitIndex + 1;
      }
    }
    rows.push({ start: offset, length: chunkLength });
    remaining = remaining.slice(chunkLength);
    offset += chunkLength;
  }

  if (rows.length === 0) {
    return [{ start: 0, length: 0 }];
  }
  return rows;
}

function getVisualRowsWithBlocks(
  line: string,
  safeWidth: number,
  rows: VisualRowInfo[],
  blocks: ReturnType<typeof findAtomicBlocks>
): VisualRowInfo[] {
  if (line.length === 0) {
    return [{ start: 0, length: 0 }];
  }

  let charPos = 0;
  let rowStart = 0;
  let rowVisualWidth = 0;
  let lastSpaceCharPos = -1;
  let blockIdx = 0;

  while (charPos < line.length) {
    while (blockIdx < blocks.length && blocks[blockIdx].start < charPos) blockIdx++;
    const block = blockIdx < blocks.length && blocks[blockIdx].start === charPos
      ? blocks[blockIdx]
      : undefined;

    if (block) {
      const svw = block.displayWidth;

      if (rowVisualWidth > 0 && rowVisualWidth + svw > safeWidth) {
        if (lastSpaceCharPos >= rowStart) {
          rows.push({ start: rowStart, length: lastSpaceCharPos - rowStart });
          rowStart = lastSpaceCharPos + 1;
          charPos = rowStart;
          rowVisualWidth = 0;
          lastSpaceCharPos = -1;
          continue;
        } else {
          rows.push({ start: rowStart, length: charPos - rowStart });
          rowStart = charPos;
          rowVisualWidth = 0;
        }
      }

      rowVisualWidth += svw;
      charPos = block.end;
      lastSpaceCharPos = -1;
      continue;
    }

    const ch = line[charPos];
    const cw = getVisualWidth(ch);

    if (rowVisualWidth + cw > safeWidth) {
      if (lastSpaceCharPos >= rowStart) {
        rows.push({ start: rowStart, length: lastSpaceCharPos - rowStart });
        rowStart = lastSpaceCharPos + 1;
        charPos = rowStart;
        rowVisualWidth = 0;
        lastSpaceCharPos = -1;
        continue;
      } else {
        rows.push({ start: rowStart, length: charPos - rowStart });
        rowStart = charPos;
        rowVisualWidth = 0;
      }
    }

    rowVisualWidth += cw;
    if (ch === ' ') {
      lastSpaceCharPos = charPos;
    }
    charPos++;
  }

  if (rowStart < line.length) {
    rows.push({ start: rowStart, length: line.length - rowStart });
  } else if (rows.length === 0) {
    rows.push({ start: 0, length: 0 });
  }

  return rows;
}

export function moveCursor(
  buffer: Buffer,
  cursor: Cursor,
  direction: Direction,
  width?: number,
  entries?: BlockEntries
): Cursor {
  const { line, column } = cursor;
  const currentLine = buffer.lines[line];
  const lineCount = buffer.lines.length;

  switch (direction) {
    case 'left': {
      if (column > 0) {
        const block = findAtomicBlockBefore(currentLine, column, entries);
        if (block) return { line, column: block.start };
        return { line, column: column - 1 };
      }
      if (line > 0) {
        return { line: line - 1, column: buffer.lines[line - 1].length };
      }
      return cursor;
    }

    case 'right': {
      if (column < currentLine.length) {
        const block = findAtomicBlockAfter(currentLine, column, entries);
        if (block) return { line, column: block.end };
        return { line, column: column + 1 };
      }
      if (line < lineCount - 1) {
        return { line: line + 1, column: 0 };
      }
      return cursor;
    }

    case 'up':
      if (width !== undefined) {
        const { visualRow, visualCol } = getVisualPosition(column, currentLine, width, entries);

        if (visualRow > 0) {
          const targetVisualRow = visualRow - 1;
          const targetVisualRowLength = getVisualRowLength(currentLine, targetVisualRow, width, entries);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line, column: visualToBufferColumn(targetVisualRow, targetVisualCol, currentLine, width, entries) };
        }

        if (line > 0) {
          const prevLine = buffer.lines[line - 1];
          const prevLineVisualRows = getVisualRowCount(prevLine, width, entries);
          const targetVisualRow = prevLineVisualRows - 1;
          const targetVisualRowLength = getVisualRowLength(prevLine, targetVisualRow, width, entries);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line: line - 1, column: visualToBufferColumn(targetVisualRow, targetVisualCol, prevLine, width, entries) };
        }

        return cursor;
      }

      if (line > 0) {
        const targetLine = buffer.lines[line - 1];
        return { line: line - 1, column: Math.min(column, targetLine.length) };
      }
      return cursor;

    case 'down':
      if (width !== undefined) {
        const { visualRow, visualCol } = getVisualPosition(column, currentLine, width, entries);
        const currentLineVisualRows = getVisualRowCount(currentLine, width, entries);

        if (visualRow < currentLineVisualRows - 1) {
          const targetVisualRow = visualRow + 1;
          const targetVisualRowLength = getVisualRowLength(currentLine, targetVisualRow, width, entries);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line, column: visualToBufferColumn(targetVisualRow, targetVisualCol, currentLine, width, entries) };
        }

        if (line < lineCount - 1) {
          const nextLine = buffer.lines[line + 1];
          const targetVisualRowLength = getVisualRowLength(nextLine, 0, width, entries);
          const targetVisualCol = Math.min(visualCol, targetVisualRowLength);
          return { line: line + 1, column: Math.min(targetVisualCol, nextLine.length) };
        }

        return cursor;
      }

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

export function getTextContent(buffer: Buffer): string {
  if (buffer.lines.length === 1 && buffer.lines[0] === '') {
    return '';
  }
  return buffer.lines.join('\n');
}

export function getOffset(buffer: Buffer, cursor: Cursor): number {
  let offset = 0;
  for (let i = 0; i < cursor.line; i++) {
    offset += buffer.lines[i].length + 1;
  }
  offset += cursor.column;
  return offset;
}

export function getCursor(buffer: Buffer, offset: number): Cursor {
  let currentOffset = 0;
  for (let i = 0; i < buffer.lines.length; i++) {
    const lineLength = buffer.lines[i].length;
    if (i === buffer.lines.length - 1) {
      if (offset <= currentOffset + lineLength) {
        return { line: i, column: Math.max(0, offset - currentOffset) };
      }
      return { line: i, column: lineLength };
    }

    if (offset <= currentOffset + lineLength) {
      return { line: i, column: Math.max(0, offset - currentOffset) };
    }

    currentOffset += lineLength + 1;
  }

  const lastLineIdx = buffer.lines.length - 1;
  return { line: lastLineIdx, column: buffer.lines[lastLineIdx].length };
}

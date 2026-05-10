import React from 'react';
import { Box, Text } from 'ink';
import type { Buffer, Cursor, WrapResult } from './types.js';
import type { BlockState } from './BlockTypes.js';
import { useTerminalWidth } from '../../hooks/useTerminalWidth.js';
import { getVisualRows } from './TextBuffer.js';
import { findAtomicBlocks, type AtomicBlock } from './AtomicBlocks.js';

export interface TextRendererProps {
  buffer: Buffer;
  cursor: Cursor;
  width?: number;
  showCursor?: boolean;
  /** Block state for expanding markers into display text */
  blockState?: BlockState;
}

interface VisualSegment {
  text: string;
  dim: boolean;
}

interface VisualRow {
  segments: VisualSegment[];
  /** Total visual length (sum of segment text lengths). */
  visualLength: number;
}

/** Expand a [start, end) range of the raw line into styled segments. */
function expandRange(
  line: string,
  start: number,
  end: number,
  blocks: AtomicBlock[]
): VisualSegment[] {
  const segments: VisualSegment[] = [];
  let raw = start;
  let plainStart = start;

  while (raw < end) {
    const block = blocks.find((b) => b.start === raw && b.end <= end);
    if (block) {
      if (raw > plainStart) {
        segments.push({ text: line.slice(plainStart, raw), dim: false });
      }
      segments.push({ text: block.displayText, dim: block.dim });
      raw = block.end;
      plainStart = raw;
    } else {
      raw++;
    }
  }

  if (plainStart < end) {
    segments.push({ text: line.slice(plainStart, end), dim: false });
  }
  return segments;
}

/** Visual column inside a row corresponding to a raw buffer column. */
function visualColumnForRawColumn(
  line: string,
  rowStart: number,
  column: number,
  blocks: AtomicBlock[]
): number {
  let visualCol = 0;
  let rawIndex = rowStart;

  while (rawIndex < column) {
    const block = blocks.find((b) => b.start === rawIndex);
    if (block) {
      if (column <= block.start) return visualCol;
      visualCol += block.displayWidth;
      rawIndex = block.end;
    } else {
      visualCol += 1;
      rawIndex++;
    }
  }
  return visualCol;
}

export function wrapLines(
  buffer: Buffer,
  cursor: Cursor,
  width: number,
  entries?: Map<string, import('./BlockTypes.js').BlockEntry>
): WrapResult & { rows: VisualRow[] } {
  const visualLines: string[] = [];
  const rowsOut: VisualRow[] = [];
  let cursorVisualRow = 0;
  let cursorVisualCol = 0;
  const safeWidth = Math.max(1, width);
  let visualRowIndex = 0;

  for (let lineIndex = 0; lineIndex < buffer.lines.length; lineIndex++) {
    const rawLine = buffer.lines[lineIndex];
    const isCursorLine = lineIndex === cursor.line;
    const blocks = findAtomicBlocks(rawLine, entries);
    const rows = getVisualRows(rawLine, safeWidth, entries);

    if (rawLine.length === 0) {
      visualLines.push('');
      rowsOut.push({ segments: [], visualLength: 0 });
      if (isCursorLine) {
        cursorVisualRow = visualRowIndex;
        cursorVisualCol = 0;
      }
      visualRowIndex++;
      continue;
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const rowEnd = row.start + row.length;
      const segments = expandRange(rawLine, row.start, rowEnd, blocks);
      const visualLength = segments.reduce((sum, s) => sum + s.text.length, 0);
      visualLines.push(segments.map((s) => s.text).join(''));
      rowsOut.push({ segments, visualLength });

      if (isCursorLine) {
        if (cursor.column >= row.start && cursor.column < rowEnd) {
          cursorVisualRow = visualRowIndex;
          cursorVisualCol = visualColumnForRawColumn(rawLine, row.start, cursor.column, blocks);
        } else if (cursor.column === rowEnd && rowIndex === rows.length - 1) {
          cursorVisualRow = visualRowIndex;
          cursorVisualCol = visualLength;
        }
      }

      visualRowIndex++;
    }
  }

  return { visualLines, cursorVisualRow, cursorVisualCol, rows: rowsOut };
}

function renderSegments(segments: VisualSegment[], keyPrefix: string): React.ReactNode[] {
  return segments.map((seg, i) =>
    seg.dim ? (
      <Text dimColor key={`${keyPrefix}-d-${i}`}>{seg.text}</Text>
    ) : (
      <Text key={`${keyPrefix}-t-${i}`}>{seg.text}</Text>
    )
  );
}

function sliceSegments(segments: VisualSegment[], start: number, end: number): VisualSegment[] {
  const out: VisualSegment[] = [];
  let pos = 0;
  for (const seg of segments) {
    const segEnd = pos + seg.text.length;
    if (segEnd <= start) { pos = segEnd; continue; }
    if (pos >= end) break;
    const sliceStart = Math.max(0, start - pos);
    const sliceEnd = Math.min(seg.text.length, end - pos);
    out.push({ text: seg.text.slice(sliceStart, sliceEnd), dim: seg.dim });
    pos = segEnd;
  }
  return out;
}

function charAtVisualCol(segments: VisualSegment[], col: number): { ch: string; dim: boolean } {
  let pos = 0;
  for (const seg of segments) {
    if (col < pos + seg.text.length) {
      return { ch: seg.text[col - pos], dim: seg.dim };
    }
    pos += seg.text.length;
  }
  return { ch: ' ', dim: false };
}

function renderVisualRow(
  row: VisualRow,
  isCursorRow: boolean,
  cursorCol: number,
  showCursor: boolean
): React.ReactNode {
  const { segments, visualLength } = row;

  if (!isCursorRow || !showCursor) {
    if (visualLength === 0) return <Text> </Text>;
    return <>{renderSegments(segments, 'r')}</>;
  }

  if (visualLength === 0) {
    return <Text inverse> </Text>;
  }

  const before = sliceSegments(segments, 0, cursorCol);
  const under = cursorCol < visualLength
    ? charAtVisualCol(segments, cursorCol)
    : { ch: ' ', dim: false };
  const after = cursorCol < visualLength
    ? sliceSegments(segments, cursorCol + 1, visualLength)
    : [];

  return (
    <>
      {renderSegments(before, 'b')}
      <Text inverse dimColor={under.dim}>{under.ch}</Text>
      {renderSegments(after, 'a')}
    </>
  );
}

export function TextRenderer({
  buffer,
  cursor,
  width: propWidth,
  showCursor = true,
  blockState,
}: TextRendererProps): React.ReactElement {
  const width = useTerminalWidth(propWidth);
  const entries = blockState?.entries;

  const { rows, cursorVisualRow, cursorVisualCol } = wrapLines(buffer, cursor, width, entries);

  return (
    <Box flexDirection="column">
      {rows.map((row, index) => {
        const isCursorRow = index === cursorVisualRow;
        return (
          <Box key={index}>
            {renderVisualRow(row, isCursorRow, cursorVisualCol, showCursor)}
          </Box>
        );
      })}
    </Box>
  );
}

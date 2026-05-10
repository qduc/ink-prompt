import React from 'react';
import { Box, Text } from 'ink';
import type { Buffer, Cursor, WrapResult, PlaceholderState } from './types.js';
import type { ImageRef } from './ImageTypes.js';
import { useTerminalWidth } from '../../hooks/useTerminalWidth.js';
import { getVisualRows } from './TextBuffer.js';
import { getDisplayLine, bufferColToDisplayCol } from './Placeholder.js';
import { parseSentinels, getPlaceholderText, type SentinelInfo } from './ImageSentinel.js';

const PLACEHOLDER_PATTERN = /\[Pasted Image #\d+\]/g;

export interface TextRendererProps {
  buffer: Buffer;
  cursor: Cursor;
  width?: number;
  showCursor?: boolean;
  /** Placeholder state for expanding paste markers into display text */
  placeholderState?: PlaceholderState;
  images?: Record<string, ImageRef>;
}

export function wrapLines(
  buffer: Buffer,
  cursor: Cursor,
  width: number,
  images?: Record<string, ImageRef>
): WrapResult {
  const visualLines: string[] = [];
  let cursorVisualRow = 0;
  let cursorVisualCol = 0;
  const safeWidth = Math.max(1, width);
  let visualRowIndex = 0;

  for (let lineIndex = 0; lineIndex < buffer.lines.length; lineIndex++) {
    const rawLine = buffer.lines[lineIndex];
    const isCursorLine = lineIndex === cursor.line;
    const sentinels = parseSentinels(rawLine);
    const rows = getVisualRows(rawLine, safeWidth);

    if (rawLine.length === 0) {
      visualLines.push('');
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
      const chunk = expandRawSegment(rawLine, row.start, rowEnd, sentinels);
      visualLines.push(chunk);

      if (isCursorLine) {
        if (cursor.column >= row.start && cursor.column < rowEnd) {
          cursorVisualRow = visualRowIndex;
          cursorVisualCol = visualColumnForRawColumn(rawLine, row.start, cursor.column, sentinels);
        } else if (cursor.column === rowEnd && rowIndex === rows.length - 1) {
          cursorVisualRow = visualRowIndex;
          cursorVisualCol = chunk.length;
        }
      }

      visualRowIndex++;
    }
  }

  return { visualLines, cursorVisualRow, cursorVisualCol };
}

function expandRawSegment(
  line: string,
  start: number,
  end: number,
  sentinels: SentinelInfo[]
): string {
  let expanded = '';
  let rawIndex = start;

  while (rawIndex < end) {
    const sentinel = sentinels.find(s => s.start === rawIndex);
    if (sentinel && sentinel.end <= end) {
      expanded += getPlaceholderText(sentinel.displayNumber);
      rawIndex = sentinel.end;
    } else {
      expanded += line[rawIndex];
      rawIndex++;
    }
  }

  return expanded;
}

function visualColumnForRawColumn(
  line: string,
  start: number,
  column: number,
  sentinels: SentinelInfo[]
): number {
  let visualCol = 0;
  let rawIndex = start;

  while (rawIndex < column) {
    const sentinel = sentinels.find(s => s.start === rawIndex);
    if (sentinel) {
      if (column <= sentinel.start) {
        return visualCol;
      }
      visualCol += getPlaceholderText(sentinel.displayNumber).length;
      rawIndex = sentinel.end;
    } else {
      visualCol += 1;
      rawIndex++;
    }
  }

  return visualCol;
}

function renderLineSegments(line: string): React.ReactNode[] {
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(PLACEHOLDER_PATTERN.source, 'g');

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push(
        <Text key={`t-${lastIndex}`}>{line.slice(lastIndex, match.index)}</Text>
      );
    }
    segments.push(
      <Text dimColor key={`p-${match.index}`}>{match[0]}</Text>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push(
      <Text key={`t-${lastIndex}`}>{line.slice(lastIndex)}</Text>
    );
  }

  return segments;
}

function renderVisualLine(line: string, isCursorRow: boolean, cursorCol: number, showCursor: boolean): React.ReactNode {
  if (!isCursorRow) {
    if (line.length === 0) return <Text> </Text>;
    return <>{renderLineSegments(line)}</>;
  }

  if (!showCursor) {
    if (line.length === 0) return <Text> </Text>;
    return <>{renderLineSegments(line)}</>;
  }

  if (line.length === 0) {
    return <Text inverse> </Text>;
  }

  const before = line.slice(0, cursorCol);
  const charUnderCursor = cursorCol < line.length ? line[cursorCol] : ' ';
  const after = line.slice(cursorCol + 1);

  return (
    <>
      {renderLineSegments(before)}
      <Text inverse>{charUnderCursor}</Text>
      {renderLineSegments(after)}
    </>
  );
}

export function TextRenderer({
  buffer,
  cursor,
  width: propWidth,
  showCursor = true,
  placeholderState,
  images = {},
}: TextRendererProps): React.ReactElement {
  const width = useTerminalWidth(propWidth);

  // Expand paste placeholder markers to display text before rendering
  const hasPlaceholders = placeholderState && placeholderState.placeholders.size > 0;

  const displayBuffer: Buffer = hasPlaceholders
    ? { lines: buffer.lines.map(line => getDisplayLine(line, placeholderState!.placeholders)) }
    : buffer;

  const displayCursor: Cursor = hasPlaceholders && cursor.line < buffer.lines.length
    ? { line: cursor.line, column: bufferColToDisplayCol(buffer.lines[cursor.line], cursor.column, placeholderState!.placeholders) }
    : cursor;

  const { visualLines, cursorVisualRow, cursorVisualCol } = wrapLines(displayBuffer, displayCursor, width, images);

  return (
    <Box flexDirection="column">
      {visualLines.map((line, index) => {
        const isCursorRow = index === cursorVisualRow;

        return (
          <Box key={index}>
            {renderVisualLine(line, isCursorRow, cursorVisualCol, showCursor)}
          </Box>
        );
      })}
    </Box>
  );
}

import type { PlaceholderInfo, PlaceholderState } from './types.js';

export const MARKER_REGEX = /\x00P(\d+)\x00/g;

export function createMarker(id: number): string {
  return `\x00P${id}\x00`;
}

export function createPlaceholderState(): PlaceholderState {
  return { placeholders: new Map(), nextId: 0 };
}

export function addPlaceholder(
  state: PlaceholderState,
  originalText: string,
  displayText: string
): { id: number; marker: string; state: PlaceholderState } {
  const id = state.nextId;
  const marker = createMarker(id);
  const newPlaceholders = new Map(state.placeholders);
  newPlaceholders.set(id, { id, originalText, displayText });
  return { id, marker, state: { placeholders: newPlaceholders, nextId: id + 1 } };
}

export function removePlaceholder(
  state: PlaceholderState,
  id: number
): PlaceholderState {
  const newPlaceholders = new Map(state.placeholders);
  newPlaceholders.delete(id);
  return { ...state, placeholders: newPlaceholders };
}

export function getDisplayLine(line: string, placeholders: Map<number, PlaceholderInfo>): string {
  return line.replace(MARKER_REGEX, (_, idStr) => {
    const info = placeholders.get(Number(idStr));
    return info ? info.displayText : '';
  });
}

export function getValue(lines: string[], placeholders: Map<number, PlaceholderInfo>): string {
  const text = lines.join('\n');
  return text.replace(MARKER_REGEX, (_, idStr) => {
    const info = placeholders.get(Number(idStr));
    return info ? info.originalText : '';
  });
}

export interface MarkerRange {
  id: number;
  start: number;
  end: number;
}

export function findPlaceholderAt(line: string, column: number): MarkerRange | null {
  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (column > start && column < end) {
      return { id: Number(match[1]), start, end };
    }
  }
  return null;
}

export function findPlaceholderAfter(line: string, column: number): MarkerRange | null {
  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    if (match.index === column) {
      return { id: Number(match[1]), start: match.index, end: match.index + match[0].length };
    }
  }
  return null;
}

export function findPlaceholderBefore(line: string, column: number): MarkerRange | null {
  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    const end = match.index + match[0].length;
    if (end === column) {
      return { id: Number(match[1]), start: match.index, end };
    }
  }
  return null;
}

export function bufferColToDisplayCol(
  line: string,
  column: number,
  placeholders: Map<number, PlaceholderInfo>
): number {
  if (!placeholders || placeholders.size === 0) return column;

  let displayCol = 0;
  let lastEnd = 0;

  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    const markerStart = match.index;
    const markerEnd = markerStart + match[0].length;

    if (column <= markerStart) {
      return displayCol + (column - lastEnd);
    }

    displayCol += markerStart - lastEnd;

    const info = placeholders.get(Number(match[1]));
    const displayLen = info ? info.displayText.length : 0;

    if (column <= markerEnd) {
      return displayCol + displayLen;
    }

    displayCol += displayLen;
    lastEnd = markerEnd;
  }

  return displayCol + (column - lastEnd);
}

export function displayColToBufferCol(
  line: string,
  displayColumn: number,
  placeholders: Map<number, PlaceholderInfo>
): number {
  if (!placeholders || placeholders.size === 0) return displayColumn;

  let bufPos = 0;
  let dispPos = 0;

  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    const markerStart = match.index;
    const markerEnd = markerStart + match[0].length;

    const textLen = markerStart - bufPos;
    if (displayColumn <= dispPos + textLen) {
      return bufPos + (displayColumn - dispPos);
    }
    dispPos += textLen;
    bufPos = markerStart;

    const info = placeholders.get(Number(match[1]));
    const displayLen = info ? info.displayText.length : 0;

    if (displayColumn <= dispPos + displayLen) {
      return markerEnd;
    }

    dispPos += displayLen;
    bufPos = markerEnd;
  }

  return bufPos + (displayColumn - dispPos);
}

export function getValueCursorOffset(
  lines: string[],
  cursor: { line: number; column: number },
  placeholders: Map<number, PlaceholderInfo>
): number {
  let offset = 0;
  for (let i = 0; i < cursor.line; i++) {
    offset += getExpandedLineLength(lines[i], placeholders) + 1;
  }

  const line = lines[cursor.line];
  let bufPos = 0;

  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    const markerStart = match.index;
    const markerEnd = markerStart + match[0].length;

    if (cursor.column <= markerStart) {
      offset += cursor.column - bufPos;
      return offset;
    }

    offset += markerStart - bufPos;

    const info = placeholders.get(Number(match[1]));
    offset += info ? info.originalText.length : 0;
    bufPos = markerEnd;

    if (cursor.column <= markerEnd) {
      return offset;
    }
  }

  offset += cursor.column - bufPos;
  return offset;
}

export function getCursorFromValueOffset(
  lines: string[],
  offset: number,
  placeholders: Map<number, PlaceholderInfo>
): { line: number; column: number } {
  let currentOffset = 0;
  const lineCount = lines.length;

  for (let i = 0; i < lineCount; i++) {
    const lineLen = getExpandedLineLength(lines[i], placeholders);

    if (i === lineCount - 1) {
      if (offset <= currentOffset + lineLen) {
        const colInExpanded = offset - currentOffset;
        return { line: i, column: valueOffsetToBufferColumn(lines[i], colInExpanded, placeholders) };
      }
      return { line: i, column: lines[i].length };
    }

    if (offset <= currentOffset + lineLen) {
      const colInExpanded = offset - currentOffset;
      return { line: i, column: valueOffsetToBufferColumn(lines[i], colInExpanded, placeholders) };
    }

    currentOffset += lineLen + 1;
  }

  const lastIdx = lines.length - 1;
  return { line: lastIdx, column: lines[lastIdx].length };
}

function getExpandedLineLength(line: string, placeholders: Map<number, PlaceholderInfo>): number {
  let len = 0;
  let lastEnd = 0;
  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    len += match.index - lastEnd;
    const info = placeholders.get(Number(match[1]));
    len += info ? info.originalText.length : 0;
    lastEnd = match.index + match[0].length;
  }
  len += line.length - lastEnd;
  return len;
}

function valueOffsetToBufferColumn(
  line: string,
  offsetInExpanded: number,
  placeholders: Map<number, PlaceholderInfo>
): number {
  let bufPos = 0;
  let expandedPos = 0;

  MARKER_REGEX.lastIndex = 0;
  let match;
  while ((match = MARKER_REGEX.exec(line)) !== null) {
    const markerStart = match.index;
    const textLen = markerStart - bufPos;

    if (offsetInExpanded <= expandedPos + textLen) {
      return bufPos + (offsetInExpanded - expandedPos);
    }
    expandedPos += textLen;
    bufPos = markerStart;

    const info = placeholders.get(Number(match[1]));
    const originalLen = info ? info.originalText.length : 0;

    if (offsetInExpanded <= expandedPos + originalLen) {
      return markerStart + match[0].length;
    }

    expandedPos += originalLen;
    bufPos = markerStart + match[0].length;
  }

  return bufPos + (offsetInExpanded - expandedPos);
}

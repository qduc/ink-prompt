import type { BlockEntry, BlockState, PasteBlockEntry, ImageBlockEntry } from './BlockTypes.js';
import {
  createBlockMarker,
  generateBlockId,
  parseBlockMarkers,
  type BlockMarkerKind,
} from './BlockMarker.js';
import type { ImageRef } from './ImageTypes.js';

export function createBlockState(): BlockState {
  return { entries: new Map(), nextPasteNumber: 1, nextImageNumber: 1 };
}

export function createPasteBlockEntry(
  state: BlockState,
  originalText: string,
  displayText: string
): { id: string; marker: string; state: BlockState } {
  const id = generateBlockId();
  const displayNumber = state.nextPasteNumber;
  const marker = createBlockMarker('p', id, displayNumber);
  const newEntries = new Map(state.entries);
  newEntries.set(id, { kind: 'paste', id, displayNumber, originalText, displayText });
  return {
    id,
    marker,
    state: { entries: newEntries, nextPasteNumber: displayNumber + 1, nextImageNumber: state.nextImageNumber },
  };
}

export function createImageBlockEntry(
  state: BlockState,
  imageRef: ImageRef,
  id?: string
): { id: string; marker: string; state: BlockState } {
  const blockId = id || imageRef.id;
  const displayNumber = imageRef.displayNumber;
  const marker = createBlockMarker('i', blockId, displayNumber);
  const newEntries = new Map(state.entries);
  newEntries.set(blockId, {
    kind: 'image',
    id: blockId,
    displayNumber,
    data: imageRef.data,
    mimeType: imageRef.mimeType,
    byteSize: imageRef.byteSize,
  });
  return {
    id: blockId,
    marker,
    state: {
      entries: newEntries,
      nextPasteNumber: state.nextPasteNumber,
      nextImageNumber: Math.max(state.nextImageNumber, displayNumber + 1),
    },
  };
}

export function removeBlock(state: BlockState, id: string): BlockState {
  const newEntries = new Map(state.entries);
  newEntries.delete(id);
  return { ...state, entries: newEntries };
}

export function getBlock(state: BlockState, id: string): BlockEntry | undefined {
  return state.entries.get(id);
}

export function getDisplayLine(line: string, entries: Map<string, BlockEntry>): string {
  const markers = parseBlockMarkers(line);
  if (markers.length === 0) return line;

  let result = '';
  let lastEnd = 0;
  for (const m of markers) {
    result += line.slice(lastEnd, m.start);
    const entry = entries.get(m.id);
    if (entry && entry.kind === 'paste') {
      result += entry.displayText;
    } else {
      result += m.kind === 'i' ? `[Pasted Image #${m.displayNumber}]` : `[Paste text #${m.displayNumber}]`;
    }
    lastEnd = m.end;
  }
  result += line.slice(lastEnd);
  return result;
}

export function getValue(lines: string[], entries: Map<string, BlockEntry>): string {
  return lines.map((line) => {
    const markers = parseBlockMarkers(line);
    if (markers.length === 0) return line;

    let result = '';
    let lastEnd = 0;
    for (const m of markers) {
      result += line.slice(lastEnd, m.start);
      const entry = entries.get(m.id);
      if (entry && entry.kind === 'paste') {
        result += entry.originalText;
      } else {
        result += line.slice(m.start, m.end);
      }
      lastEnd = m.end;
    }
    result += line.slice(lastEnd);
    return result;
  }).join('\n');
}

export function bufferColToDisplayCol(
  line: string,
  column: number,
  entries: Map<string, BlockEntry>
): number {
  if (entries.size === 0) return column;

  let displayCol = 0;
  let lastEnd = 0;

  const markers = parseBlockMarkers(line);
  for (const m of markers) {
    if (column <= m.start) {
      return displayCol + (column - lastEnd);
    }

    displayCol += m.start - lastEnd;

    const entry = entries.get(m.id);
    const displayLen = entry && entry.kind === 'paste' ? entry.displayText.length : `[Pasted Image #${m.displayNumber}]`.length;

    if (column <= m.end) {
      return displayCol + displayLen;
    }

    displayCol += displayLen;
    lastEnd = m.end;
  }

  return displayCol + (column - lastEnd);
}

export function displayColToBufferCol(
  line: string,
  displayColumn: number,
  entries: Map<string, BlockEntry>
): number {
  if (entries.size === 0) return displayColumn;

  let bufPos = 0;
  let dispPos = 0;

  const markers = parseBlockMarkers(line);
  for (const m of markers) {
    const textLen = m.start - bufPos;
    if (displayColumn <= dispPos + textLen) {
      return bufPos + (displayColumn - dispPos);
    }
    dispPos += textLen;
    bufPos = m.start;

    const entry = entries.get(m.id);
    const displayLen = entry && entry.kind === 'paste' ? entry.displayText.length : `[Pasted Image #${m.displayNumber}]`.length;

    if (displayColumn <= dispPos + displayLen) {
      return m.end;
    }

    dispPos += displayLen;
    bufPos = m.end;
  }

  return bufPos + (displayColumn - dispPos);
}

export function getExpandedLineLength(line: string, entries: Map<string, BlockEntry>): number {
  let len = 0;
  let lastEnd = 0;
  const markers = parseBlockMarkers(line);
  for (const m of markers) {
    len += m.start - lastEnd;
    const entry = entries.get(m.id);
    if (entry && entry.kind === 'paste') {
      len += entry.originalText.length;
    } else {
      len += m.end - m.start;
    }
    lastEnd = m.end;
  }
  len += line.length - lastEnd;
  return len;
}

export function getValueCursorOffset(
  lines: string[],
  cursor: { line: number; column: number },
  entries: Map<string, BlockEntry>
): number {
  let offset = 0;
  for (let i = 0; i < cursor.line; i++) {
    offset += getExpandedLineLength(lines[i], entries) + 1;
  }

  const line = lines[cursor.line];
  let bufPos = 0;

  const markers = parseBlockMarkers(line);
  for (const m of markers) {
    if (cursor.column <= m.start) {
      offset += cursor.column - bufPos;
      return offset;
    }

    offset += m.start - bufPos;

    const entry = entries.get(m.id);
    if (entry && entry.kind === 'paste') {
      offset += entry.originalText.length;
    } else {
      offset += m.end - m.start;
    }
    bufPos = m.end;

    if (cursor.column <= m.end) {
      return offset;
    }
  }

  offset += cursor.column - bufPos;
  return offset;
}

export function getCursorFromValueOffset(
  lines: string[],
  offset: number,
  entries: Map<string, BlockEntry>
): { line: number; column: number } {
  let currentOffset = 0;
  const lineCount = lines.length;

  for (let i = 0; i < lineCount; i++) {
    const lineLen = getExpandedLineLength(lines[i], entries);

    if (i === lineCount - 1) {
      if (offset <= currentOffset + lineLen) {
        const colInExpanded = offset - currentOffset;
        return { line: i, column: valueOffsetToBufferColumn(lines[i], colInExpanded, entries) };
      }
      return { line: i, column: lines[i].length };
    }

    if (offset <= currentOffset + lineLen) {
      const colInExpanded = offset - currentOffset;
      return { line: i, column: valueOffsetToBufferColumn(lines[i], colInExpanded, entries) };
    }

    currentOffset += lineLen + 1;
  }

  const lastIdx = lines.length - 1;
  return { line: lastIdx, column: lines[lastIdx].length };
}

function valueOffsetToBufferColumn(
  line: string,
  offsetInExpanded: number,
  entries: Map<string, BlockEntry>
): number {
  let bufPos = 0;
  let expandedPos = 0;

  const markers = parseBlockMarkers(line);
  for (const m of markers) {
    const textLen = m.start - bufPos;

    if (offsetInExpanded <= expandedPos + textLen) {
      return bufPos + (offsetInExpanded - expandedPos);
    }
    expandedPos += textLen;
    bufPos = m.start;

    const entry = entries.get(m.id);
    const originalLen = entry && entry.kind === 'paste' ? entry.originalText.length : (m.end - m.start);

    if (offsetInExpanded <= expandedPos + originalLen) {
      return m.end;
    }

    expandedPos += originalLen;
    bufPos = m.end;
  }

  return bufPos + (offsetInExpanded - expandedPos);
}

export function getDisplayWidthForMarker(
  m: { kind: BlockMarkerKind; id: string; displayNumber: number },
  entries: Map<string, BlockEntry>
): number {
  const entry = entries.get(m.id);
  if (entry && entry.kind === 'paste') {
    return entry.displayText.length;
  }
  return `[Pasted Image #${m.displayNumber}]`.length;
}

export function getDisplayTextForMarker(
  m: { kind: BlockMarkerKind; id: string; displayNumber: number },
  entries: Map<string, BlockEntry>
): string {
  const entry = entries.get(m.id);
  if (entry && entry.kind === 'paste') {
    return entry.displayText;
  }
  return `[Pasted Image #${m.displayNumber}]`;
}

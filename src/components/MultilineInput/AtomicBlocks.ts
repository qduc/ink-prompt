import type { BlockEntry, BlockKind } from './BlockTypes.js';
import { parseBlockMarkers } from './BlockMarker.js';

export interface AtomicBlock {
  kind: BlockKind;
  id: string;
  start: number;
  end: number;
  displayWidth: number;
  displayText: string;
  dim: boolean;
}

export type BlockEntries = Map<string, BlockEntry> | undefined;

function getDisplayInfo(
  marker: { kind: 'p' | 'i'; id: string; displayNumber: number },
  entries?: BlockEntries
): { displayWidth: number; displayText: string } {
  if (entries) {
    const entry = entries.get(marker.id);
    if (entry && entry.kind === 'paste') {
      return { displayWidth: entry.displayText.length, displayText: entry.displayText };
    }
  }
  if (marker.kind === 'p') {
    const text = `[Paste text #${marker.displayNumber}]`;
    return { displayWidth: text.length, displayText: text };
  }
  const text = `[Pasted Image #${marker.displayNumber}]`;
  return { displayWidth: text.length, displayText: text };
}

export function findAtomicBlocks(line: string, entries?: BlockEntries): AtomicBlock[] {
  const markers = parseBlockMarkers(line);

  return markers.map((m) => {
    const { displayWidth, displayText } = getDisplayInfo(m, entries);
    return {
      kind: m.kind === 'p' ? 'paste' : 'image',
      id: m.id,
      start: m.start,
      end: m.end,
      displayWidth,
      displayText,
      dim: m.kind === 'i',
    };
  });
}

export function findAtomicBlockSpanning(
  line: string,
  offset: number,
  entries?: BlockEntries
): AtomicBlock | null {
  for (const b of findAtomicBlocks(line, entries)) {
    if (offset > b.start && offset < b.end) return b;
  }
  return null;
}

export function findAtomicBlockBefore(
  line: string,
  offset: number,
  entries?: BlockEntries
): AtomicBlock | null {
  for (const b of findAtomicBlocks(line, entries)) {
    if (b.end === offset) return b;
  }
  return null;
}

export function findAtomicBlockAfter(
  line: string,
  offset: number,
  entries?: BlockEntries
): AtomicBlock | null {
  for (const b of findAtomicBlocks(line, entries)) {
    if (b.start === offset) return b;
  }
  return null;
}

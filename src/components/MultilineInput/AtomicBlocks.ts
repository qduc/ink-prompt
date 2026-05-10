import type { PlaceholderInfo } from './types.js';
import { parseSentinels, getPlaceholderText } from './ImageSentinel.js';
import { MARKER_REGEX } from './Placeholder.js';

export type AtomicBlock =
  | {
      kind: 'sentinel';
      id: string;
      displayNumber: number;
      start: number;
      end: number;
      displayWidth: number;
      displayText: string;
    }
  | {
      kind: 'placeholder';
      id: number;
      start: number;
      end: number;
      displayWidth: number;
      displayText: string;
    };

export type Placeholders = Map<number, PlaceholderInfo> | undefined;

export function findAtomicBlocks(line: string, placeholders?: Placeholders): AtomicBlock[] {
  const blocks: AtomicBlock[] = [];

  for (const s of parseSentinels(line)) {
    const displayText = getPlaceholderText(s.displayNumber);
    blocks.push({
      kind: 'sentinel',
      id: s.id,
      displayNumber: s.displayNumber,
      start: s.start,
      end: s.end,
      displayWidth: displayText.length,
      displayText,
    });
  }

  if (placeholders && placeholders.size > 0) {
    MARKER_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MARKER_REGEX.exec(line)) !== null) {
      const id = Number(m[1]);
      const info = placeholders.get(id);
      const displayText = info ? info.displayText : '';
      blocks.push({
        kind: 'placeholder',
        id,
        start: m.index,
        end: m.index + m[0].length,
        displayWidth: displayText.length,
        displayText,
      });
    }
  }

  blocks.sort((a, b) => a.start - b.start);
  return blocks;
}

/** Block that strictly contains offset (offset > start && offset < end) — cursor is in the interior. */
export function findAtomicBlockSpanning(
  line: string,
  offset: number,
  placeholders?: Placeholders
): AtomicBlock | null {
  for (const b of findAtomicBlocks(line, placeholders)) {
    if (offset > b.start && offset < b.end) return b;
  }
  return null;
}

/** Block whose end === offset (the block immediately to the left of the cursor). */
export function findAtomicBlockBefore(
  line: string,
  offset: number,
  placeholders?: Placeholders
): AtomicBlock | null {
  for (const b of findAtomicBlocks(line, placeholders)) {
    if (b.end === offset) return b;
  }
  return null;
}

/** Block whose start === offset (the block immediately to the right of the cursor). */
export function findAtomicBlockAfter(
  line: string,
  offset: number,
  placeholders?: Placeholders
): AtomicBlock | null {
  for (const b of findAtomicBlocks(line, placeholders)) {
    if (b.start === offset) return b;
  }
  return null;
}

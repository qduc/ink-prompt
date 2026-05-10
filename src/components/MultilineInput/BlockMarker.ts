export const BLOCK_OPEN = '\uE000';
export const BLOCK_CLOSE = '\uE001';

export type BlockMarkerKind = 'p' | 'i';

export interface BlockMarkerInfo {
  kind: BlockMarkerKind;
  id: string;
  displayNumber: number;
  start: number;
  end: number;
}

export function generateBlockId(): string {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
}

export function createBlockMarker(kind: BlockMarkerKind, id: string, displayNumber: number): string {
  return `${BLOCK_OPEN}${kind}:${id}:${displayNumber}${BLOCK_CLOSE}`;
}

export function parseBlockMarkers(text: string): BlockMarkerInfo[] {
  const result: BlockMarkerInfo[] = [];
  let i = 0;

  while (i < text.length) {
    const openIdx = text.indexOf(BLOCK_OPEN, i);
    if (openIdx === -1) break;

    const closeIdx = text.indexOf(BLOCK_CLOSE, openIdx + 1);
    if (closeIdx === -1) break;

    const raw = text.substring(openIdx + 1, closeIdx);
    const kindChar = raw[0];
    if (kindChar !== 'p' && kindChar !== 'i') {
      i = closeIdx + 1;
      continue;
    }

    const rest = raw.substring(2);
    const colonIdx = rest.lastIndexOf(':');
    if (colonIdx === -1) {
      i = closeIdx + 1;
      continue;
    }

    const id = rest.substring(0, colonIdx);
    const displayNumber = parseInt(rest.substring(colonIdx + 1), 10);
    if (isNaN(displayNumber)) {
      i = closeIdx + 1;
      continue;
    }

    result.push({
      kind: kindChar as BlockMarkerKind,
      id,
      displayNumber,
      start: openIdx,
      end: closeIdx + 1,
    });

    i = closeIdx + 1;
  }

  return result;
}

export function findBlockMarkerAt(text: string, offset: number): BlockMarkerInfo | null {
  for (const m of parseBlockMarkers(text)) {
    if (offset > m.start && offset < m.end) return m;
  }
  return null;
}

export function findBlockMarkerBefore(text: string, offset: number): BlockMarkerInfo | null {
  for (const m of parseBlockMarkers(text)) {
    if (m.end === offset) return m;
  }
  return null;
}

export function findBlockMarkerAfter(text: string, offset: number): BlockMarkerInfo | null {
  for (const m of parseBlockMarkers(text)) {
    if (m.start === offset) return m;
  }
  return null;
}

export function removeBlockMarker(text: string, offset: number): string {
  const marker = findBlockMarkerAt(text, offset);
  if (!marker) return text;
  return text.slice(0, marker.start) + text.slice(marker.end);
}

export function blockMarkerVisualWidth(displayNumber: number): number {
  return getBlockPlaceholderText('i', displayNumber).length;
}

export function getBlockPlaceholderText(kind: BlockMarkerKind, displayNumber: number): string {
  if (kind === 'i') {
    return `[Pasted Image #${displayNumber}]`;
  }
  return `[Paste text #${displayNumber}]`;
}

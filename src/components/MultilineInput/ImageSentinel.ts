import { SENTINEL_OPEN, SENTINEL_CLOSE } from './ImageTypes.js';

export function generateImageId(): string {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
}

export function createSentinel(id: string, displayNumber: number): string {
  return `${SENTINEL_OPEN}${id}:${displayNumber}${SENTINEL_CLOSE}`;
}

export interface SentinelInfo {
  id: string;
  displayNumber: number;
  start: number;
  end: number;
}

export function parseSentinels(text: string): SentinelInfo[] {
  const result: SentinelInfo[] = [];
  let i = 0;

  while (i < text.length) {
    const openIdx = text.indexOf(SENTINEL_OPEN, i);
    if (openIdx === -1) break;

    const closeIdx = text.indexOf(SENTINEL_CLOSE, openIdx + 1);
    if (closeIdx === -1) break;

    const raw = text.substring(openIdx + 1, closeIdx);
    const colonIdx = raw.lastIndexOf(':');
    const id = colonIdx >= 0 ? raw.substring(0, colonIdx) : raw;
    const displayNumber = colonIdx >= 0 ? parseInt(raw.substring(colonIdx + 1), 10) || 1 : 1;

    result.push({ id, displayNumber, start: openIdx, end: closeIdx + 1 });
    i = closeIdx + 1;
  }

  return result;
}

export function findSentinelAt(
  text: string,
  offset: number
): SentinelInfo | null {
  const sentinels = parseSentinels(text);
  for (const s of sentinels) {
    if (offset >= s.start && offset <= s.end) {
      return s;
    }
  }
  return null;
}

export function isInsideSentinel(text: string, offset: number): boolean {
  const sentinels = parseSentinels(text);
  for (const s of sentinels) {
    if (offset >= s.start && offset < s.end) {
      return true;
    }
  }
  return false;
}

export function removeSentinel(text: string, offset: number): string {
  const sentinel = findSentinelAt(text, offset);
  if (!sentinel) return text;

  return text.slice(0, sentinel.start) + text.slice(sentinel.end);
}

export function getPlaceholderText(displayNumber: number): string {
  return `[Pasted Image #${displayNumber}]`;
}

export function getPlaceholderVisualWidth(displayNumber: number): number {
  return getPlaceholderText(displayNumber).length;
}

export function getSentinelVisualWidthFromText(text: string, offset: number): number | null {
  const s = findSentinelAt(text, offset);
  if (!s) return null;
  return getPlaceholderVisualWidth(s.displayNumber);
}

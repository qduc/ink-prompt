import { describe, it, expect } from 'vitest';
import {
  BLOCK_OPEN,
  BLOCK_CLOSE,
  createBlockMarker,
  parseBlockMarkers,
  findBlockMarkerAt,
  findBlockMarkerBefore,
  findBlockMarkerAfter,
  removeBlockMarker,
  blockMarkerVisualWidth,
  getBlockPlaceholderText,
  generateBlockId,
} from '../BlockMarker.js';

describe('generateBlockId', () => {
  it('generates a non-empty string', () => {
    const id = generateBlockId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateBlockId()));
    expect(ids.size).toBe(100);
  });
});

describe('createBlockMarker', () => {
  it('creates a paste marker', () => {
    const marker = createBlockMarker('p', 'abc123', 1);
    expect(marker).toBe(`${BLOCK_OPEN}p:abc123:1${BLOCK_CLOSE}`);
  });

  it('creates an image marker', () => {
    const marker = createBlockMarker('i', 'xyz789', 2);
    expect(marker).toBe(`${BLOCK_OPEN}i:xyz789:2${BLOCK_CLOSE}`);
  });
});

describe('parseBlockMarkers', () => {
  it('finds a single paste marker', () => {
    const text = `hello ${BLOCK_OPEN}p:abc123:1${BLOCK_CLOSE} world`;
    const markers = parseBlockMarkers(text);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ kind: 'p', id: 'abc123', displayNumber: 1, start: 6, end: 18 });
  });

  it('finds a single image marker', () => {
    const text = `${BLOCK_OPEN}i:xyz789:2${BLOCK_CLOSE}`;
    const markers = parseBlockMarkers(text);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ kind: 'i', id: 'xyz789', displayNumber: 2, start: 0, end: 12 });
  });

  it('finds multiple markers', () => {
    const text = `${BLOCK_OPEN}p:id1:1${BLOCK_CLOSE}ab${BLOCK_OPEN}i:id2:2${BLOCK_CLOSE}`;
    const markers = parseBlockMarkers(text);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ kind: 'p', id: 'id1', displayNumber: 1, start: 0 });
    expect(markers[1]).toMatchObject({ kind: 'i', id: 'id2', displayNumber: 2 });
  });

  it('returns empty array for text without markers', () => {
    expect(parseBlockMarkers('plain text')).toEqual([]);
  });

  it('returns empty array for empty text', () => {
    expect(parseBlockMarkers('')).toEqual([]);
  });

  it('skips malformed markers', () => {
    const text = `${BLOCK_OPEN}bad${BLOCK_CLOSE}`;
    expect(parseBlockMarkers(text)).toEqual([]);
  });

  it('skips markers with unknown kind', () => {
    const text = `${BLOCK_OPEN}x:abc:1${BLOCK_CLOSE}`;
    expect(parseBlockMarkers(text)).toEqual([]);
  });
});

describe('findBlockMarkerAt', () => {
  it('finds marker containing the offset', () => {
    const text = `a${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}b`;
    const result = findBlockMarkerAt(text, 2);
    expect(result).toMatchObject({ kind: 'p', id: 'id', displayNumber: 1 });
  });

  it('returns null for offset at marker start', () => {
    const text = `${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}`;
    expect(findBlockMarkerAt(text, 0)).toBeNull();
  });

  it('returns null for offset at marker end', () => {
    const text = `${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}`;
    const end = text.length;
    expect(findBlockMarkerAt(text, end)).toBeNull();
  });

  it('returns null outside markers', () => {
    const text = `a${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}b`;
    expect(findBlockMarkerAt(text, 0)).toBeNull();
    expect(findBlockMarkerAt(text, text.length - 1)).toBeNull();
  });
});

describe('findBlockMarkerBefore', () => {
  it('finds marker ending at offset', () => {
    const text = `a${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}b`;
    const end = text.indexOf(BLOCK_CLOSE) + 1;
    const result = findBlockMarkerBefore(text, end);
    expect(result).toMatchObject({ kind: 'p', id: 'id' });
  });

  it('returns null when no marker ends at offset', () => {
    const text = `a${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}b`;
    expect(findBlockMarkerBefore(text, 1)).toBeNull();
  });
});

describe('findBlockMarkerAfter', () => {
  it('finds marker starting at offset', () => {
    const text = `a${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}b`;
    const start = text.indexOf(BLOCK_OPEN);
    const result = findBlockMarkerAfter(text, start);
    expect(result).toMatchObject({ kind: 'p', id: 'id' });
  });

  it('returns null when no marker starts at offset', () => {
    const text = `a${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}b`;
    expect(findBlockMarkerAfter(text, 0)).toBeNull();
    expect(findBlockMarkerAfter(text, 2)).toBeNull();
  });
});

describe('removeBlockMarker', () => {
  it('removes marker at offset', () => {
    const text = `a${BLOCK_OPEN}p:id:1${BLOCK_CLOSE}b`;
    const result = removeBlockMarker(text, 2);
    expect(result).toBe('ab');
  });

  it('returns original text if no marker at offset', () => {
    const text = 'abc';
    expect(removeBlockMarker(text, 1)).toBe('abc');
  });
});

describe('getBlockPlaceholderText', () => {
  it('formats image display text', () => {
    expect(getBlockPlaceholderText('i', 1)).toBe('[Pasted Image #1]');
    expect(getBlockPlaceholderText('i', 42)).toBe('[Pasted Image #42]');
  });

  it('formats paste display text', () => {
    expect(getBlockPlaceholderText('p', 1)).toBe('[Paste text #1]');
    expect(getBlockPlaceholderText('p', 5)).toBe('[Paste text #5]');
  });
});

describe('blockMarkerVisualWidth', () => {
  it('returns correct width', () => {
    expect(blockMarkerVisualWidth(1)).toBe('[Pasted Image #1]'.length);
    expect(blockMarkerVisualWidth(100)).toBe('[Pasted Image #100]'.length);
  });
});

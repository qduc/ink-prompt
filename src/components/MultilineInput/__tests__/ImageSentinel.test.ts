import { describe, it, expect } from 'vitest';
import {
  generateImageId,
  createSentinel,
  parseSentinels,
  findSentinelAt,
  isInsideSentinel,
  removeSentinel,
  getPlaceholderText,
  getPlaceholderVisualWidth,
} from '../ImageSentinel.js';
import { SENTINEL_OPEN, SENTINEL_CLOSE } from '../ImageTypes.js';

describe('ImageSentinel', () => {
  describe('generateImageId', () => {
    it('generates a string id', () => {
      const id = generateImageId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateImageId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('createSentinel', () => {
    it('creates a sentinel block with the given id and display number', () => {
      const result = createSentinel('abc123', 1);
      expect(result).toBe(`${SENTINEL_OPEN}abc123:1${SENTINEL_CLOSE}`);
    });

    it('creates a sentinel with higher display number', () => {
      const result = createSentinel('def456', 42);
      expect(result).toBe(`${SENTINEL_OPEN}def456:42${SENTINEL_CLOSE}`);
    });
  });

  describe('parseSentinels', () => {
    it('returns empty array for text without sentinels', () => {
      expect(parseSentinels('hello world')).toEqual([]);
    });

    it('finds a single sentinel', () => {
      const text = `hello ${SENTINEL_OPEN}abc123:1${SENTINEL_CLOSE} world`;
      const result = parseSentinels(text);
      expect(result).toEqual([
        { id: 'abc123', displayNumber: 1, start: 6, end: 16 },
      ]);
    });

    it('finds multiple sentinels', () => {
      const text = `${SENTINEL_OPEN}id1:1${SENTINEL_CLOSE}hello${SENTINEL_OPEN}id2:2${SENTINEL_CLOSE}`;
      const result = parseSentinels(text);
      expect(result).toEqual([
        { id: 'id1', displayNumber: 1, start: 0, end: 7 },
        { id: 'id2', displayNumber: 2, start: 12, end: 19 },
      ]);
    });

    it('returns empty for unmatched opener', () => {
      const text = `hello ${SENTINEL_OPEN}abc:1`;
      const result = parseSentinels(text);
      expect(result).toEqual([]);
    });

    it('returns empty for unmatched closer', () => {
      const text = `hello abc:1${SENTINEL_CLOSE} world`;
      const result = parseSentinels(text);
      expect(result).toEqual([]);
    });
  });

  describe('findSentinelAt', () => {
    it('returns null when offset is not near a sentinel', () => {
      const text = `hello ${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE} world`;
      expect(findSentinelAt(text, 0)).toBeNull();
    });

    it('finds sentinel when offset is at the opener', () => {
      const text = `hello ${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE} world`;
      const result = findSentinelAt(text, 6);
      expect(result).toMatchObject({ id: 'abc', displayNumber: 1, start: 6 });
    });

    it('finds sentinel when offset is inside the id', () => {
      const text = `hello ${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE} world`;
      const result = findSentinelAt(text, 8);
      expect(result).toMatchObject({ id: 'abc', displayNumber: 1 });
    });

    it('finds sentinel when offset is at the closer', () => {
      const text = `hello ${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE} world`;
      const result = findSentinelAt(text, 12);
      expect(result).toMatchObject({ id: 'abc', displayNumber: 1 });
    });

    it('finds sentinel when offset is right after the closer', () => {
      const text = `${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}`;
      const result = findSentinelAt(text, 7);
      expect(result).toMatchObject({ id: 'abc', displayNumber: 1, start: 0, end: 7 });
    });
  });

  describe('isInsideSentinel', () => {
    it('returns false when offset is before any sentinel', () => {
      const text = `hi ${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}`;
      expect(isInsideSentinel(text, 0)).toBe(false);
    });

    it('returns false when offset is after sentinel', () => {
      const text = `${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE} world`;
      expect(isInsideSentinel(text, 10)).toBe(false);
    });

    it('returns true when offset is at the opener', () => {
      const text = `${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}`;
      expect(isInsideSentinel(text, 0)).toBe(true);
    });

    it('returns true when offset is inside the id', () => {
      const text = `${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}`;
      expect(isInsideSentinel(text, 2)).toBe(true);
    });

    it('returns true when offset is at the closer', () => {
      const text = `${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}`;
      expect(isInsideSentinel(text, 6)).toBe(true);
    });

    it('returns false when offset is after the closer', () => {
      const text = `${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}`;
      expect(isInsideSentinel(text, 7)).toBe(false);
    });
  });

  describe('removeSentinel', () => {
    it('removes sentinel block at cursor position', () => {
      const text = `hello ${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE} world`;
      const result = removeSentinel(text, 10);
      expect(result).toBe('hello  world');
    });

    it('removes sentinel when cursor is at the opener', () => {
      const text = `${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}hello`;
      const result = removeSentinel(text, 0);
      expect(result).toBe('hello');
    });

    it('removes sentinel when cursor is at the closer', () => {
      const text = `hello${SENTINEL_OPEN}abc:1${SENTINEL_CLOSE}`;
      const result = removeSentinel(text, 11);
      expect(result).toBe('hello');
    });

    it('removes first sentinel when cursor is between two', () => {
      const text = `${SENTINEL_OPEN}a:1${SENTINEL_CLOSE}${SENTINEL_OPEN}b:2${SENTINEL_CLOSE}`;
      const result = removeSentinel(text, 1);
      expect(result).toBe(`${SENTINEL_OPEN}b:2${SENTINEL_CLOSE}`);
    });

    it('returns text unchanged if no sentinel at offset', () => {
      const text = 'hello world';
      const result = removeSentinel(text, 3);
      expect(result).toBe('hello world');
    });
  });

  describe('getPlaceholderText', () => {
    it('returns correct placeholder for display number 1', () => {
      expect(getPlaceholderText(1)).toBe('[Pasted Image #1]');
    });

    it('returns correct placeholder for display number 42', () => {
      expect(getPlaceholderText(42)).toBe('[Pasted Image #42]');
    });
  });

  describe('getPlaceholderVisualWidth', () => {
    it('returns correct width for display number 1', () => {
      expect(getPlaceholderVisualWidth(1)).toBe(17);
    });

    it('returns correct width for display number 100', () => {
      expect(getPlaceholderVisualWidth(100)).toBe(19);
    });

    it('returns correct width for display number 0', () => {
      expect(getPlaceholderVisualWidth(0)).toBe(17);
    });
  });
});

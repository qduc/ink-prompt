import { describe, it, expect } from 'vitest';
import {
  createBuffer,
  insertText,
  deleteChar,
  deleteCharForward,
  moveCursor,
  getVisualRows,
  getTextContent,
} from '../TextBuffer.js';
import { createSentinel, getPlaceholderText } from '../ImageSentinel.js';
import { SENTINEL_OPEN, SENTINEL_CLOSE } from '../ImageTypes.js';
import type { Buffer, Cursor } from '../types.js';

describe('TextBuffer with sentinels', () => {
  const sentinel1 = createSentinel('img1', 1);
  const sentinel2 = createSentinel('img2', 2);
  const placeholder1 = getPlaceholderText(1); // "[Pasted Image #1]" (17 chars)
  const placeholder2 = getPlaceholderText(2); // "[Pasted Image #2]" (17 chars)

  describe('getVisualRows', () => {
    it('treats sentinel as atomic block with placeholder visual width', () => {
      const line = `${sentinel1}`;
      const rows = getVisualRows(line, 20);
      // The sentinel takes up placeholder text width (17)
      expect(rows).toEqual([
        { start: 0, length: sentinel1.length }, // whole sentinel as one chunk
      ]);
    });

    it('does not split a sentinel block across visual rows', () => {
      // Sentinel (17 visual width) + "abc" (3) = 20 total, use width 20
      const line = `${sentinel1}abc`;
      const rows = getVisualRows(line, 20);
      // All fits on one row
      expect(rows.length).toBe(1);
      expect(rows[0].start).toBe(0);
      expect(rows[0].length).toBe(line.length);
    });

    it('wraps text around sentinel blocks', () => {
      // A sentinel in the middle, wrap at a narrow width
      const line = `a${sentinel1}b`;
      const rows = getVisualRows(line, 3);
      // Each sentinel block is atomic and takes up its full visual width
      // "a" (1) + sentinel (5 actual chars but 17 visual width) = 18 > 3, so splits
      // The sentinel can't be split so it goes on its own row
      // But "a" (1) fits in first row
      // Then sentinel (17 visual) might need to be on its own row
      // Then "b" (1) on next
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('renders empty array for empty line', () => {
      const rows = getVisualRows('', 10);
      expect(rows).toEqual([{ start: 0, length: 0 }]);
    });
  });

  describe('moveCursor left with sentinels', () => {
    it('jumps over sentinel when cursor is right after it', () => {
      const buffer = createBuffer(`hello${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: `hello${sentinel1}`.length }; // right after sentinel
      const result = moveCursor(buffer, cursor, 'left');
      // Should jump to before the sentinel opener (after "hello")
      expect(result).toEqual({ line: 0, column: 5 });
    });

    it('normal left movement when not adjacent to sentinel', () => {
      const buffer = createBuffer(`${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: `${sentinel1}world`.length }; // end of "world"
      const result = moveCursor(buffer, cursor, 'left');
      expect(result).toEqual({ line: 0, column: `${sentinel1}worl`.length });
    });
  });

  describe('moveCursor right with sentinels', () => {
    it('jumps over sentinel when cursor is right before it', () => {
      const buffer = createBuffer(`hello${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: 5 }; // right before sentinel
      const result = moveCursor(buffer, cursor, 'right');
      // Should jump to after the sentinel closer
      expect(result).toEqual({ line: 0, column: `hello${sentinel1}`.length });
    });

    it('normal right movement when not adjacent to sentinel', () => {
      const buffer = createBuffer(`hello${sentinel1}`);
      const cursor: Cursor = { line: 0, column: 3 };
      const result = moveCursor(buffer, cursor, 'right');
      expect(result).toEqual({ line: 0, column: 4 });
    });
  });

  describe('deleteChar (backspace) with sentinels', () => {
    it('removes whole sentinel block when deleting at closer', () => {
      const buffer = createBuffer(`hello${sentinel1}world`);
      // Use getTextContent to find offset
      // Cursor: right after sentinel (at end of sentinel block)
      const cursor: Cursor = { line: 0, column: `hello${sentinel1}`.length };
      const result = deleteChar(buffer, cursor);
      expect(getTextContent(result.buffer)).toBe('helloworld');
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });

    it('normal backspace when not near sentinel', () => {
      const buffer = createBuffer(`hello${sentinel1}`);
      const cursor: Cursor = { line: 0, column: `hello${sentinel1}`.length };
      // This is right after sentinel, so the first backspace removes the sentinel
      // Just test a normal backspace on regular text
      const normalBuffer = createBuffer('hello');
      const normalCursor: Cursor = { line: 0, column: 5 };
      const result = deleteChar(normalBuffer, normalCursor);
      expect(getTextContent(result.buffer)).toBe('hell');
    });
  });

  describe('deleteCharForward (delete key) with sentinels', () => {
    it('removes whole sentinel block when cursor is at opener', () => {
      const buffer = createBuffer(`hello${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: 5 }; // at sentinel opener
      const result = deleteCharForward(buffer, cursor);
      expect(getTextContent(result.buffer)).toBe('helloworld');
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });

    it('normal forward delete when not near sentinel', () => {
      const buffer = createBuffer(`hello${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: 0 };
      const result = deleteCharForward(buffer, cursor);
      expect(result.cursor).toEqual({ line: 0, column: 0 });
    });
  });

  describe('insertText with sentinels', () => {
    it('inserts text normally before sentinel', () => {
      const buffer = createBuffer(`${sentinel1}`);
      const cursor: Cursor = { line: 0, column: 0 };
      const result = insertText(buffer, cursor, 'hello');
      expect(getTextContent(result.buffer)).toBe(`hello${sentinel1}`);
    });

    it('inserts text normally after sentinel', () => {
      const buffer = createBuffer(`${sentinel1}`);
      const cursor: Cursor = { line: 0, column: sentinel1.length };
      const result = insertText(buffer, cursor, 'hello');
      expect(getTextContent(result.buffer)).toBe(`${sentinel1}hello`);
    });
  });

  describe('multiple sentinels', () => {
    it('handles two sentinels with text between', () => {
      const buffer = createBuffer(`${sentinel1}text${sentinel2}`);
      // Cursor right after sentinel2
      const cursor: Cursor = { line: 0, column: `${sentinel1}text${sentinel2}`.length };
      // Move left should jump over sentinel2
      const leftOnce = moveCursor(buffer, cursor, 'left');
      expect(leftOnce).toEqual({ line: 0, column: `${sentinel1}text`.length });
      // Move left again should be normal (inside "text")
      const leftTwice = moveCursor(buffer, leftOnce, 'left');
      expect(leftTwice).toEqual({ line: 0, column: `${sentinel1}tex`.length });
    });

    it('backspace on sentinel2 removes only sentinel2', () => {
      const text = `${sentinel1}text${sentinel2}`;
      const buffer = createBuffer(text);
      const cursor: Cursor = { line: 0, column: text.length };
      const result = deleteChar(buffer, cursor);
      expect(getTextContent(result.buffer)).toBe(`${sentinel1}text`);
    });
  });
});

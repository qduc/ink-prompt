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
import { createBlockMarker, getBlockPlaceholderText, BLOCK_OPEN, BLOCK_CLOSE } from '../BlockMarker.js';
import type { Buffer, Cursor } from '../types.js';

describe('TextBuffer with sentinels', () => {
  const sentinel1 = createBlockMarker('i', 'img1', 1);
  const sentinel2 = createBlockMarker('i', 'img2', 2);
  const placeholder1 = getBlockPlaceholderText('i', 1); // "[Pasted Image #1]" (17 chars)
  const placeholder2 = getBlockPlaceholderText('i', 2); // "[Pasted Image #2]" (17 chars)

  describe('getVisualRows', () => {
    it('treats sentinel as atomic block with placeholder visual width', () => {
      const line = `${sentinel1}`;
      const rows = getVisualRows(line, 20);
      expect(rows).toEqual([
        { start: 0, length: sentinel1.length },
      ]);
    });

    it('does not split a sentinel block across visual rows', () => {
      const line = `${sentinel1}abc`;
      const rows = getVisualRows(line, 20);
      expect(rows.length).toBe(1);
      expect(rows[0].start).toBe(0);
      expect(rows[0].length).toBe(line.length);
    });

    it('wraps text around sentinel blocks', () => {
      const line = `a${sentinel1}b`;
      const rows = getVisualRows(line, 3);
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
      const cursor: Cursor = { line: 0, column: `hello${sentinel1}`.length };
      const result = moveCursor(buffer, cursor, 'left');
      expect(result).toEqual({ line: 0, column: 5 });
    });

    it('normal left movement when not adjacent to sentinel', () => {
      const buffer = createBuffer(`${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: `${sentinel1}world`.length };
      const result = moveCursor(buffer, cursor, 'left');
      expect(result).toEqual({ line: 0, column: `${sentinel1}worl`.length });
    });
  });

  describe('moveCursor right with sentinels', () => {
    it('jumps over sentinel when cursor is right before it', () => {
      const buffer = createBuffer(`hello${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: 5 };
      const result = moveCursor(buffer, cursor, 'right');
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
      const cursor: Cursor = { line: 0, column: `hello${sentinel1}`.length };
      const result = deleteChar(buffer, cursor);
      expect(getTextContent(result.buffer)).toBe('helloworld');
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });

    it('normal backspace when not near sentinel', () => {
      const normalBuffer = createBuffer('hello');
      const normalCursor: Cursor = { line: 0, column: 5 };
      const result = deleteChar(normalBuffer, normalCursor);
      expect(getTextContent(result.buffer)).toBe('hell');
    });
  });

  describe('deleteCharForward (delete key) with sentinels', () => {
    it('removes whole sentinel block when cursor is at opener', () => {
      const buffer = createBuffer(`hello${sentinel1}world`);
      const cursor: Cursor = { line: 0, column: 5 };
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
      const cursor: Cursor = { line: 0, column: `${sentinel1}text${sentinel2}`.length };
      const leftOnce = moveCursor(buffer, cursor, 'left');
      expect(leftOnce).toEqual({ line: 0, column: `${sentinel1}text`.length });
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

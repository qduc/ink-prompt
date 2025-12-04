import { describe, it, expect } from 'vitest';
import {
  createBuffer,
  insertChar,
  deleteChar,
  deleteCharForward,
  insertNewLine,
  moveCursor,
  getTextContent,
} from '../TextBuffer.js';
import type { Buffer, Cursor } from '../types.js';

describe('TextBuffer', () => {
  describe('createBuffer', () => {
    it('creates empty buffer with single empty line', () => {
      const buffer = createBuffer();
      expect(buffer).toEqual({ lines: [''] });
    });

    it('creates buffer from single line text', () => {
      const buffer = createBuffer('hello');
      expect(buffer).toEqual({ lines: ['hello'] });
    });

    it('creates buffer from multi-line text', () => {
      const buffer = createBuffer('line1\nline2\nline3');
      expect(buffer).toEqual({ lines: ['line1', 'line2', 'line3'] });
    });

    it('handles text ending with newline', () => {
      const buffer = createBuffer('hello\n');
      expect(buffer).toEqual({ lines: ['hello', ''] });
    });
  });

  describe('insertChar', () => {
    it('inserts character into empty buffer', () => {
      const buffer = createBuffer();
      const cursor: Cursor = { line: 0, column: 0 };
      const result = insertChar(buffer, cursor, 'a');
      expect(result.buffer).toEqual({ lines: ['a'] });
      expect(result.cursor).toEqual({ line: 0, column: 1 });
    });

    it('inserts character at end of line', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = insertChar(buffer, cursor, '!');
      expect(result.buffer).toEqual({ lines: ['hello!'] });
      expect(result.cursor).toEqual({ line: 0, column: 6 });
    });

    it('inserts character in middle of line', () => {
      const buffer = createBuffer('hllo');
      const cursor: Cursor = { line: 0, column: 1 };
      const result = insertChar(buffer, cursor, 'e');
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 2 });
    });

    it('inserts character at line start', () => {
      const buffer = createBuffer('ello');
      const cursor: Cursor = { line: 0, column: 0 };
      const result = insertChar(buffer, cursor, 'h');
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 1 });
    });

    it('inserts into specific line of multi-line buffer', () => {
      const buffer = createBuffer('line1\nline2\nline3');
      const cursor: Cursor = { line: 1, column: 4 };
      const result = insertChar(buffer, cursor, 'X');
      expect(result.buffer).toEqual({ lines: ['line1', 'lineX2', 'line3'] });
      expect(result.cursor).toEqual({ line: 1, column: 5 });
    });
  });

  describe('deleteChar (backspace)', () => {
    it('does nothing when cursor at buffer start', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 0 };
      const result = deleteChar(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 0 });
    });

    it('deletes character before cursor', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = deleteChar(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hell'] });
      expect(result.cursor).toEqual({ line: 0, column: 4 });
    });

    it('deletes character in middle of line', () => {
      const buffer = createBuffer('heello');
      const cursor: Cursor = { line: 0, column: 3 };
      const result = deleteChar(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 2 });
    });

    it('merges with previous line when at line start', () => {
      const buffer = createBuffer('hello\nworld');
      const cursor: Cursor = { line: 1, column: 0 };
      const result = deleteChar(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['helloworld'] });
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });

    it('merges empty line with previous', () => {
      const buffer = createBuffer('hello\n');
      const cursor: Cursor = { line: 1, column: 0 };
      const result = deleteChar(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });
  });

  describe('deleteCharForward (delete key)', () => {
    it('does nothing when cursor at buffer end', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = deleteCharForward(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });

    it('deletes character after cursor', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 0 };
      const result = deleteCharForward(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['ello'] });
      expect(result.cursor).toEqual({ line: 0, column: 0 });
    });

    it('deletes character in middle of line', () => {
      const buffer = createBuffer('heello');
      const cursor: Cursor = { line: 0, column: 2 };
      const result = deleteCharForward(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 2 });
    });

    it('merges with next line when at line end', () => {
      const buffer = createBuffer('hello\nworld');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = deleteCharForward(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['helloworld'] });
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });

    it('merges next empty line with current', () => {
      const buffer = createBuffer('hello\n');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = deleteCharForward(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 5 });
    });

    it('does nothing on last line at end', () => {
      const buffer = createBuffer('hello\nworld');
      const cursor: Cursor = { line: 1, column: 5 };
      const result = deleteCharForward(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello', 'world'] });
      expect(result.cursor).toEqual({ line: 1, column: 5 });
    });
  });

  describe('insertNewLine', () => {
    it('splits line at cursor position', () => {
      const buffer = createBuffer('helloworld');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = insertNewLine(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello', 'world'] });
      expect(result.cursor).toEqual({ line: 1, column: 0 });
    });

    it('creates new line at line start', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 0 };
      const result = insertNewLine(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['', 'hello'] });
      expect(result.cursor).toEqual({ line: 1, column: 0 });
    });

    it('creates new line at line end', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = insertNewLine(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['hello', ''] });
      expect(result.cursor).toEqual({ line: 1, column: 0 });
    });

    it('inserts new line in middle of multi-line buffer', () => {
      const buffer = createBuffer('line1\nline2\nline3');
      const cursor: Cursor = { line: 1, column: 2 };
      const result = insertNewLine(buffer, cursor);
      expect(result.buffer).toEqual({ lines: ['line1', 'li', 'ne2', 'line3'] });
      expect(result.cursor).toEqual({ line: 2, column: 0 });
    });
  });

  describe('moveCursor', () => {
    describe('left', () => {
      it('moves left within line', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 3 };
        const result = moveCursor(buffer, cursor, 'left');
        expect(result).toEqual({ line: 0, column: 2 });
      });

      it('wraps to end of previous line', () => {
        const buffer = createBuffer('hello\nworld');
        const cursor: Cursor = { line: 1, column: 0 };
        const result = moveCursor(buffer, cursor, 'left');
        expect(result).toEqual({ line: 0, column: 5 });
      });

      it('stays at buffer start', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 0 };
        const result = moveCursor(buffer, cursor, 'left');
        expect(result).toEqual({ line: 0, column: 0 });
      });
    });

    describe('right', () => {
      it('moves right within line', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 2 };
        const result = moveCursor(buffer, cursor, 'right');
        expect(result).toEqual({ line: 0, column: 3 });
      });

      it('wraps to start of next line', () => {
        const buffer = createBuffer('hello\nworld');
        const cursor: Cursor = { line: 0, column: 5 };
        const result = moveCursor(buffer, cursor, 'right');
        expect(result).toEqual({ line: 1, column: 0 });
      });

      it('stays at buffer end', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 5 };
        const result = moveCursor(buffer, cursor, 'right');
        expect(result).toEqual({ line: 0, column: 5 });
      });
    });

    describe('up', () => {
      it('moves up maintaining column', () => {
        const buffer = createBuffer('hello\nworld');
        const cursor: Cursor = { line: 1, column: 3 };
        const result = moveCursor(buffer, cursor, 'up');
        expect(result).toEqual({ line: 0, column: 3 });
      });

      it('clamps column to shorter line', () => {
        const buffer = createBuffer('hi\nhello');
        const cursor: Cursor = { line: 1, column: 4 };
        const result = moveCursor(buffer, cursor, 'up');
        expect(result).toEqual({ line: 0, column: 2 });
      });

      it('stays on first line', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 2 };
        const result = moveCursor(buffer, cursor, 'up');
        expect(result).toEqual({ line: 0, column: 2 });
      });
    });

    describe('down', () => {
      it('moves down maintaining column', () => {
        const buffer = createBuffer('hello\nworld');
        const cursor: Cursor = { line: 0, column: 3 };
        const result = moveCursor(buffer, cursor, 'down');
        expect(result).toEqual({ line: 1, column: 3 });
      });

      it('clamps column to shorter line', () => {
        const buffer = createBuffer('hello\nhi');
        const cursor: Cursor = { line: 0, column: 4 };
        const result = moveCursor(buffer, cursor, 'down');
        expect(result).toEqual({ line: 1, column: 2 });
      });

      it('stays on last line', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 2 };
        const result = moveCursor(buffer, cursor, 'down');
        expect(result).toEqual({ line: 0, column: 2 });
      });
    });

    describe('lineStart', () => {
      it('moves to start of line', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 3 };
        const result = moveCursor(buffer, cursor, 'lineStart');
        expect(result).toEqual({ line: 0, column: 0 });
      });

      it('stays at start if already there', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 0 };
        const result = moveCursor(buffer, cursor, 'lineStart');
        expect(result).toEqual({ line: 0, column: 0 });
      });
    });

    describe('lineEnd', () => {
      it('moves to end of line', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 2 };
        const result = moveCursor(buffer, cursor, 'lineEnd');
        expect(result).toEqual({ line: 0, column: 5 });
      });

      it('stays at end if already there', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 5 };
        const result = moveCursor(buffer, cursor, 'lineEnd');
        expect(result).toEqual({ line: 0, column: 5 });
      });
    });
  });

  describe('getTextContent', () => {
    it('returns empty string for empty buffer', () => {
      const buffer = createBuffer();
      expect(getTextContent(buffer)).toBe('');
    });

    it('returns single line content', () => {
      const buffer = createBuffer('hello');
      expect(getTextContent(buffer)).toBe('hello');
    });

    it('joins multiple lines with newlines', () => {
      const buffer = createBuffer('line1\nline2\nline3');
      expect(getTextContent(buffer)).toBe('line1\nline2\nline3');
    });

    it('preserves empty lines', () => {
      const buffer = createBuffer('hello\n\nworld');
      expect(getTextContent(buffer)).toBe('hello\n\nworld');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  createBuffer,
  insertText,
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

  describe('insertText', () => {
    it('inserts character into empty buffer', () => {
      const buffer = createBuffer();
      const cursor: Cursor = { line: 0, column: 0 };
      const result = insertText(buffer, cursor, 'a');
      expect(result.buffer).toEqual({ lines: ['a'] });
      expect(result.cursor).toEqual({ line: 0, column: 1 });
    });

    it('inserts character at end of line', () => {
      const buffer = createBuffer('hello');
      const cursor: Cursor = { line: 0, column: 5 };
      const result = insertText(buffer, cursor, '!');
      expect(result.buffer).toEqual({ lines: ['hello!'] });
      expect(result.cursor).toEqual({ line: 0, column: 6 });
    });

    it('inserts character in middle of line', () => {
      const buffer = createBuffer('hllo');
      const cursor: Cursor = { line: 0, column: 1 };
      const result = insertText(buffer, cursor, 'e');
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 2 });
    });

    it('inserts character at line start', () => {
      const buffer = createBuffer('ello');
      const cursor: Cursor = { line: 0, column: 0 };
      const result = insertText(buffer, cursor, 'h');
      expect(result.buffer).toEqual({ lines: ['hello'] });
      expect(result.cursor).toEqual({ line: 0, column: 1 });
    });

    it('inserts into specific line of multi-line buffer', () => {
      const buffer = createBuffer('line1\nline2\nline3');
      const cursor: Cursor = { line: 1, column: 4 };
      const result = insertText(buffer, cursor, 'X');
      expect(result.buffer).toEqual({ lines: ['line1', 'lineX2', 'line3'] });
      expect(result.cursor).toEqual({ line: 1, column: 5 });
    });

    describe('multi-character insertion', () => {
      it('inserts multiple characters at once', () => {
        const buffer = createBuffer('world');
        const cursor: Cursor = { line: 0, column: 0 };
        const result = insertText(buffer, cursor, 'hello ');
        expect(result.buffer).toEqual({ lines: ['hello world'] });
        expect(result.cursor).toEqual({ line: 0, column: 6 });
      });

      it('inserts multi-char string in middle of line', () => {
        const buffer = createBuffer('helloworld');
        const cursor: Cursor = { line: 0, column: 5 };
        const result = insertText(buffer, cursor, ', beautiful ');
        expect(result.buffer).toEqual({ lines: ['hello, beautiful world'] });
        expect(result.cursor).toEqual({ line: 0, column: 17 });
      });
    });

    describe('multi-line insertion', () => {
      it('handles text with single newline', () => {
        const buffer = createBuffer('');
        const cursor: Cursor = { line: 0, column: 0 };
        const result = insertText(buffer, cursor, 'hello\nworld');
        expect(result.buffer).toEqual({ lines: ['hello', 'world'] });
        expect(result.cursor).toEqual({ line: 1, column: 5 });
      });

      it('handles text with multiple newlines', () => {
        const buffer = createBuffer('');
        const cursor: Cursor = { line: 0, column: 0 };
        const result = insertText(buffer, cursor, 'line1\nline2\nline3');
        expect(result.buffer).toEqual({ lines: ['line1', 'line2', 'line3'] });
        expect(result.cursor).toEqual({ line: 2, column: 5 });
      });

      it('inserts multi-line text in middle of line', () => {
        const buffer = createBuffer('helloworld');
        const cursor: Cursor = { line: 0, column: 5 };
        const result = insertText(buffer, cursor, '\nthere\n');
        expect(result.buffer).toEqual({ lines: ['hello', 'there', 'world'] });
        expect(result.cursor).toEqual({ line: 2, column: 0 });
      });

      it('handles paste with trailing content', () => {
        const buffer = createBuffer('start end');
        const cursor: Cursor = { line: 0, column: 6 };
        const result = insertText(buffer, cursor, 'mid1\nmid2');
        expect(result.buffer).toEqual({ lines: ['start mid1', 'mid2end'] });
        expect(result.cursor).toEqual({ line: 1, column: 4 });
      });

      it('handles empty lines from consecutive newlines', () => {
        const buffer = createBuffer('hello');
        const cursor: Cursor = { line: 0, column: 5 };
        const result = insertText(buffer, cursor, '\n\nworld');
        expect(result.buffer).toEqual({ lines: ['hello', '', 'world'] });
        expect(result.cursor).toEqual({ line: 2, column: 5 });
      });
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

    describe('visual navigation with wrapping', () => {
      // A 25-char line wraps into 3 visual lines with width=10:
      // Visual 0: "0123456789" (chars 0-9)
      // Visual 1: "0123456789" (chars 10-19)
      // Visual 2: "01234"      (chars 20-24)
      const longLine = '0123456789012345678901234'; // 25 chars

      describe('down with width (visual)', () => {
        it('moves down within wrapped line', () => {
          const buffer = createBuffer(longLine);
          const cursor: Cursor = { line: 0, column: 5 }; // visual row 0, col 5
          const result = moveCursor(buffer, cursor, 'down', 10);
          // Should move to visual row 1, col 5 → buffer column 15
          expect(result).toEqual({ line: 0, column: 15 });
        });

        it('moves from second visual row to third', () => {
          const buffer = createBuffer(longLine);
          const cursor: Cursor = { line: 0, column: 12 }; // visual row 1, col 2
          const result = moveCursor(buffer, cursor, 'down', 10);
          // Should move to visual row 2, col 2 → buffer column 22
          expect(result).toEqual({ line: 0, column: 22 });
        });

        it('clamps column when moving to shorter visual row', () => {
          const buffer = createBuffer(longLine);
          const cursor: Cursor = { line: 0, column: 17 }; // visual row 1, col 7
          const result = moveCursor(buffer, cursor, 'down', 10);
          // Visual row 2 only has 5 chars (0-4), so clamp to end of line position (25)
          // The cursor can be positioned at the end of the line (after the last char)
          expect(result).toEqual({ line: 0, column: 25 });
        });

        it('moves from last visual row of one line to first visual row of next line', () => {
          const buffer = createBuffer(longLine + '\nhello');
          const cursor: Cursor = { line: 0, column: 22 }; // visual row 2, col 2
          const result = moveCursor(buffer, cursor, 'down', 10);
          // Should move to line 1, visual row 0, col 2 → line 1, column 2
          expect(result).toEqual({ line: 1, column: 2 });
        });

        it('stays at last visual row of last line', () => {
          const buffer = createBuffer(longLine);
          const cursor: Cursor = { line: 0, column: 22 }; // visual row 2, col 2
          const result = moveCursor(buffer, cursor, 'down', 10);
          // No more visual rows, stay where we are
          expect(result).toEqual({ line: 0, column: 22 });
        });
      });

      describe('up with width (visual)', () => {
        it('moves up within wrapped line', () => {
          const buffer = createBuffer(longLine);
          const cursor: Cursor = { line: 0, column: 15 }; // visual row 1, col 5
          const result = moveCursor(buffer, cursor, 'up', 10);
          // Should move to visual row 0, col 5 → buffer column 5
          expect(result).toEqual({ line: 0, column: 5 });
        });

        it('moves from third visual row to second', () => {
          const buffer = createBuffer(longLine);
          const cursor: Cursor = { line: 0, column: 22 }; // visual row 2, col 2
          const result = moveCursor(buffer, cursor, 'up', 10);
          // Should move to visual row 1, col 2 → buffer column 12
          expect(result).toEqual({ line: 0, column: 12 });
        });

        it('moves from first visual row of line to last visual row of previous line', () => {
          const buffer = createBuffer(longLine + '\nhello');
          const cursor: Cursor = { line: 1, column: 2 }; // line 1, visual row 0, col 2
          const result = moveCursor(buffer, cursor, 'up', 10);
          // Should move to line 0, visual row 2, col 2 → line 0, column 22
          expect(result).toEqual({ line: 0, column: 22 });
        });

        it('clamps column when moving to shorter visual row above', () => {
          const buffer = createBuffer(longLine + '\nhello');
          const cursor: Cursor = { line: 1, column: 4 }; // line 1, col 4
          const result = moveCursor(buffer, cursor, 'up', 10);
          // Move to line 0, visual row 2 (only 5 chars: 0-4)
          // col 4 is valid, so buffer column = 20 + 4 = 24
          expect(result).toEqual({ line: 0, column: 24 });
        });

        it('stays at first visual row of first line', () => {
          const buffer = createBuffer(longLine);
          const cursor: Cursor = { line: 0, column: 5 }; // visual row 0, col 5
          const result = moveCursor(buffer, cursor, 'up', 10);
          // No more visual rows above, stay where we are
          expect(result).toEqual({ line: 0, column: 5 });
        });
      });

      describe('backward compatibility without width', () => {
        it('up still works with buffer lines when width not provided', () => {
          const buffer = createBuffer(longLine + '\nhello');
          const cursor: Cursor = { line: 1, column: 3 };
          const result = moveCursor(buffer, cursor, 'up');
          // Without width, should move to previous buffer line
          expect(result).toEqual({ line: 0, column: 3 });
        });

        it('down still works with buffer lines when width not provided', () => {
          const buffer = createBuffer('hello\n' + longLine);
          const cursor: Cursor = { line: 0, column: 3 };
          const result = moveCursor(buffer, cursor, 'down');
          // Without width, should move to next buffer line
          expect(result).toEqual({ line: 1, column: 3 });
        });
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

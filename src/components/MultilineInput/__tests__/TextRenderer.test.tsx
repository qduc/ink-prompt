import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TextRenderer, wrapLines } from '../TextRenderer.js';
import type { Buffer, Cursor } from '../types.js';

describe('wrapLines', () => {
  describe('no wrapping needed', () => {
    it('returns single line unchanged when shorter than width', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 5 };
      const result = wrapLines(buffer, cursor, 80);

      expect(result.visualLines).toEqual(['hello']);
      expect(result.cursorVisualRow).toBe(0);
      expect(result.cursorVisualCol).toBe(5);
    });

    it('returns multiple lines unchanged when all shorter than width', () => {
      const buffer: Buffer = { lines: ['hello', 'world'] };
      const cursor: Cursor = { line: 1, column: 3 };
      const result = wrapLines(buffer, cursor, 80);

      expect(result.visualLines).toEqual(['hello', 'world']);
      expect(result.cursorVisualRow).toBe(1);
      expect(result.cursorVisualCol).toBe(3);
    });

    it('handles empty buffer', () => {
      const buffer: Buffer = { lines: [''] };
      const cursor: Cursor = { line: 0, column: 0 };
      const result = wrapLines(buffer, cursor, 80);

      expect(result.visualLines).toEqual(['']);
      expect(result.cursorVisualRow).toBe(0);
      expect(result.cursorVisualCol).toBe(0);
    });
  });

  describe('wrapping single line', () => {
    it('wraps line exceeding width', () => {
      const buffer: Buffer = { lines: ['abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 0 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.visualLines).toEqual(['abcde', 'fghij']);
    });

    it('wraps line into multiple visual lines', () => {
      const buffer: Buffer = { lines: ['abcdefghijklmno'] };
      const cursor: Cursor = { line: 0, column: 0 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.visualLines).toEqual(['abcde', 'fghij', 'klmno']);
    });

    it('handles exact width match (no extra empty line)', () => {
      const buffer: Buffer = { lines: ['abcde'] };
      const cursor: Cursor = { line: 0, column: 5 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.visualLines).toEqual(['abcde']);
    });
  });

  describe('cursor position in wrapped lines', () => {
    it('cursor on first visual row', () => {
      const buffer: Buffer = { lines: ['abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 3 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.cursorVisualRow).toBe(0);
      expect(result.cursorVisualCol).toBe(3);
    });

    it('cursor on second visual row', () => {
      const buffer: Buffer = { lines: ['abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 7 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.cursorVisualRow).toBe(1);
      expect(result.cursorVisualCol).toBe(2);
    });

    it('cursor at wrap boundary (end of first visual row)', () => {
      const buffer: Buffer = { lines: ['abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 5 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.cursorVisualRow).toBe(1);
      expect(result.cursorVisualCol).toBe(0);
    });

    it('cursor at end of wrapped line', () => {
      const buffer: Buffer = { lines: ['abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 10 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.cursorVisualRow).toBe(1);
      expect(result.cursorVisualCol).toBe(5);
    });
  });

  describe('wrapping multiple lines', () => {
    it('wraps only the line that exceeds width', () => {
      const buffer: Buffer = { lines: ['hi', 'abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 0 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.visualLines).toEqual(['hi', 'abcde', 'fghij']);
    });

    it('cursor on second logical line that wraps', () => {
      const buffer: Buffer = { lines: ['hi', 'abcdefghij'] };
      const cursor: Cursor = { line: 1, column: 7 };
      const result = wrapLines(buffer, cursor, 5);

      expect(result.visualLines).toEqual(['hi', 'abcde', 'fghij']);
      expect(result.cursorVisualRow).toBe(2);
      expect(result.cursorVisualCol).toBe(2);
    });

    it('handles multiple wrapped lines', () => {
      const buffer: Buffer = { lines: ['abcdefg', 'hijklmn'] };
      const cursor: Cursor = { line: 1, column: 5 };
      const result = wrapLines(buffer, cursor, 4);

      expect(result.visualLines).toEqual(['abcd', 'efg', 'hijk', 'lmn']);
      expect(result.cursorVisualRow).toBe(3);
      expect(result.cursorVisualCol).toBe(1);
    });
  });
});

describe('TextRenderer', () => {
  describe('basic rendering', () => {
    it('renders single line', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} />
      );

      expect(container.textContent).toContain('hello');
    });

    it('renders multiple lines', () => {
      const buffer: Buffer = { lines: ['hello', 'world'] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} />
      );

      expect(container.textContent).toContain('hello');
      expect(container.textContent).toContain('world');
    });

    it('renders empty buffer', () => {
      const buffer: Buffer = { lines: [''] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} />
      );

      // Should render cursor as a space in empty buffer
      expect(container.textContent).toContain(' ');
    });
  });

  describe('cursor display', () => {
    it('shows cursor at start of line', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} showCursor={true} />
      );

      // Cursor highlights the first character 'h'
      expect(container.textContent).toBe('hello');
    });

    it('shows cursor at end of line', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 5 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} showCursor={true} />
      );

      // Cursor at end shows a space after 'hello'
      expect(container.textContent).toBe('hello ');
    });

    it('shows cursor in middle of line', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 2 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} showCursor={true} />
      );

      // Cursor highlights the character at position 2 ('l')
      expect(container.textContent).toBe('hello');
    });

    it('hides cursor when showCursor is false', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} showCursor={false} />
      );

      expect(container.textContent).toBe('hello');
    });
  });

  describe('word wrapping in render', () => {
    it('renders wrapped lines', () => {
      const buffer: Buffer = { lines: ['abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} width={5} />
      );

      // Both visual lines should be present
      expect(container.textContent).toContain('abcde');
      expect(container.textContent).toContain('fghij');
    });

    it('shows cursor correctly on wrapped line', () => {
      const buffer: Buffer = { lines: ['abcdefghij'] };
      const cursor: Cursor = { line: 0, column: 7 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} width={5} showCursor={true} />
      );

      // Cursor at position 7 wraps to second visual row, column 2
      // The cursor highlights character 'h' at that position
      expect(container.textContent).toContain('abcde');
      expect(container.textContent).toContain('fghij');
    });
  });
});

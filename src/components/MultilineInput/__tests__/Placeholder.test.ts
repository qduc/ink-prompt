import { describe, it, expect } from 'vitest';
import {
  createMarker,
  createPlaceholderState,
  addPlaceholder,
  removePlaceholder,
  getDisplayLine,
  getValue,
  findPlaceholderAt,
  findPlaceholderAfter,
  findPlaceholderBefore,
  bufferColToDisplayCol,
  displayColToBufferCol,
  getValueCursorOffset,
  getCursorFromValueOffset,
} from '../Placeholder.js';

const displayText = (id: number) => `[Paste text #${id}]`;

describe('Placeholder', () => {
  describe('createMarker', () => {
    it('creates marker for given id', () => {
      const marker = createMarker(1);
      expect(marker).toBe('\x00P1\x00');
      expect(marker.length).toBe(4); // Each \x00 is one char: \x00 + P + 1 + \x00
    });

    it('creates marker for id 42', () => {
      expect(createMarker(42)).toBe('\x00P42\x00');
      expect(createMarker(42).length).toBe(5);
    });
  });

  describe('createPlaceholderState', () => {
    it('creates empty state', () => {
      const state = createPlaceholderState();
      expect(state.placeholders.size).toBe(0);
      expect(state.nextId).toBe(0);
    });
  });

  describe('addPlaceholder', () => {
    it('adds a placeholder and increments nextId', () => {
      const state = createPlaceholderState();
      const result = addPlaceholder(state, 'original text', displayText(0));

      expect(result.id).toBe(0);
      expect(result.marker).toBe('\x00P0\x00');
      expect(result.state.nextId).toBe(1);
      expect(result.state.placeholders.get(0)?.originalText).toBe('original text');
      expect(result.state.placeholders.get(0)?.displayText).toBe('[Paste text #0]');
    });

    it('increments id for sequential additions', () => {
      let state = createPlaceholderState();

      const r1 = addPlaceholder(state, 'text1', displayText(0));
      expect(r1.id).toBe(0);
      state = r1.state;

      const r2 = addPlaceholder(state, 'text2', displayText(1));
      expect(r2.id).toBe(1);
      state = r2.state;

      expect(state.placeholders.size).toBe(2);
      expect(state.nextId).toBe(2);
    });

    it('does not mutate original state', () => {
      const state = createPlaceholderState();
      addPlaceholder(state, 'text', displayText(0));
      expect(state.placeholders.size).toBe(0);
      expect(state.nextId).toBe(0);
    });
  });

  describe('removePlaceholder', () => {
    it('removes a placeholder from state', () => {
      let state = createPlaceholderState();
      const r = addPlaceholder(state, 'text', displayText(0));
      state = r.state;

      state = removePlaceholder(state, 0);
      expect(state.placeholders.size).toBe(0);
      expect(state.nextId).toBe(1); // nextId is not decremented
    });
  });

  describe('getDisplayLine', () => {
    it('replaces markers with display text', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original long text', '[Paste text #1]');
      const placeholders = r.state.placeholders;

      const line = `Hello ${createMarker(0)} world`;
      const display = getDisplayLine(line, placeholders);
      expect(display).toBe('Hello [Paste text #1] world');
    });

    it('handles line without markers', () => {
      const display = getDisplayLine('Hello world', new Map());
      expect(display).toBe('Hello world');
    });
  });

  describe('getValue', () => {
    it('replaces markers with original text', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'hello\nworld\nfoo', displayText(0));
      const placeholders = r.state.placeholders;

      const value = getValue([`Hello ${createMarker(0)} bar`], placeholders);
      expect(value).toBe('Hello hello\nworld\nfoo bar');
    });

    it('handles lines without markers', () => {
      const value = getValue(['Hello', 'world'], new Map());
      expect(value).toBe('Hello\nworld');
    });
  });

  describe('findPlaceholderAt', () => {
    it('finds marker containing a position', () => {
      const line = `ab\x00P1\x00cd`;
      // marker is at columns 2-5 (0-indexed), length 4: \x00, P, 1, \x00
      // So column 2 is \x00 (start), 3 is P, 4 is 1, 5 is \x00 (end)
      // Column 2,3,4,5 are the marker (start inclusive, end exclusive would be columns 2-6)
      // Actually, findPlaceholderAt checks column > start && column < end
      // start = 2, end = 2 + 4 = 6
      // So columns 3,4,5 are "inside" the marker

      const result = findPlaceholderAt(line, 3);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.start).toBe(2);
      expect(result!.end).toBe(6);

      // Not inside marker
      expect(findPlaceholderAt(line, 1)).toBeNull();
      expect(findPlaceholderAt(line, 7)).toBeNull();
    });

    it('returns null when no marker at position', () => {
      expect(findPlaceholderAt('hello', 0)).toBeNull();
    });
  });

  describe('findPlaceholderAfter', () => {
    it('finds marker starting at given column', () => {
      const line = `ab\x00P1\x00cd`;
      const result = findPlaceholderAfter(line, 2);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.start).toBe(2);
      expect(result!.end).toBe(6);
    });

    it('returns null when no marker starts at column', () => {
      expect(findPlaceholderAfter('hello', 0)).toBeNull();
    });
  });

  describe('findPlaceholderBefore', () => {
    it('finds marker ending at given column', () => {
      const line = `ab\x00P1\x00cd`;
      const result = findPlaceholderBefore(line, 6);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.start).toBe(2);
      expect(result!.end).toBe(6);
    });

    it('returns null when no marker ends at column', () => {
      expect(findPlaceholderBefore('hello', 0)).toBeNull();
    });
  });

  describe('bufferColToDisplayCol', () => {
    it('converts column before marker', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original', '[Paste text #1]');
      const line = `ab\x00P0\x00cd`;
      expect(bufferColToDisplayCol(line, 0, r.state.placeholders)).toBe(0);
      expect(bufferColToDisplayCol(line, 1, r.state.placeholders)).toBe(1);
    });

    it('converts column after marker', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original', '[Paste text #1]');
      const line = `ab\x00P0\x00cd`;
      // buffer marker is 4 chars, display is 15 chars
      // buffer: a(0) b(1) \x00(2) P(3) 0(4) \x00(5) c(6) d(7)
      // But wait, \x00 is one char. Let me count:
      // ab = 2 chars, \x00P0\x00 = 4 chars, cd = 2 chars, total = 8 chars
      // Marker at 2-5 (4 chars)
      // display: ab[Paste text #1]cd
      // ab = 2, [Paste text #1] = 15, cd = 2, total = 19
      // Buffer col 6 (c) → display col 2 + 15 = 17
      expect(bufferColToDisplayCol(line, 6, r.state.placeholders)).toBe(17);
    });

    it('converts column at marker start', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original', '[Paste text #1]');
      const line = `ab\x00P0\x00cd`;
      // Buffer col 2 (start of marker) → display col 2 (start of display text)
      expect(bufferColToDisplayCol(line, 2, r.state.placeholders)).toBe(2);
    });

    it('converts column at marker end', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original', '[Paste text #1]');
      const line = `ab\x00P0\x00cd`;
      // Buffer col 6 (end of marker = start of 'c') → display col 2 + 15 = 17
      expect(bufferColToDisplayCol(line, 6, r.state.placeholders)).toBe(17);
    });
  });

  describe('displayColToBufferCol', () => {
    it('converts column before marker', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original', '[Paste text #1]');
      const line = `ab\x00P0\x00cd`;
      expect(displayColToBufferCol(line, 0, r.state.placeholders)).toBe(0);
      expect(displayColToBufferCol(line, 1, r.state.placeholders)).toBe(1);
    });

    it('converts column after marker display text', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original', '[Paste text #1]');
      const line = `ab\x00P0\x00cd`;
      // Display col 17 = right after display text → buffer col 6 (right after marker)
      expect(displayColToBufferCol(line, 17, r.state.placeholders)).toBe(6);
    });

    it('converts column within marker display text snaps to end', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'original', '[Paste text #1]');
      const line = `ab\x00P0\x00cd`;
      // Display col 10 (within [Paste text #1]) → should snap to marker end = 6
      expect(displayColToBufferCol(line, 10, r.state.placeholders)).toBe(6);
    });
  });

  describe('getValueCursorOffset', () => {
    it('computes offset in expanded value', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'hello\nworld', displayText(0));
      const cursor = { line: 0, column: 2 + 4 + 1 }; // After "ab" + marker + " " = 7
      // Wait, let me construct the line: "ab\x00P0\x00 cd"
      // Actually let me just use "ab" + marker + " cd"
      const lines = [`ab${createMarker(0)} cd`];
      // buffer: a b \x00 P 0 \x00 space c d (8 chars)
      // marker at cols 2-5 (length 4)
      // cursor at col 6 (after marker, before space)
      // expanded: "ab" + "hello\nworld" + " cd"
      // cursor offset = 2 + 11 (length of "hello\nworld") = 13
      expect(getValueCursorOffset(lines, { line: 0, column: 6 }, r.state.placeholders)).toBe(13);
    });

    it('computes offset before marker', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'hello', displayText(0));
      const lines = [`ab${createMarker(0)} cd`];
      expect(getValueCursorOffset(lines, { line: 0, column: 1 }, r.state.placeholders)).toBe(1);
    });
  });

  describe('getCursorFromValueOffset', () => {
    it('converts value offset to buffer cursor before marker', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'hello', displayText(0));
      const lines = [`ab${createMarker(0)} cd`];
      const cursor = getCursorFromValueOffset(lines, 1, r.state.placeholders);
      expect(cursor).toEqual({ line: 0, column: 1 });
    });

    it('converts value offset to buffer cursor after marker', () => {
      const state = createPlaceholderState();
      const r = addPlaceholder(state, 'hello', displayText(0));
      const lines = [`ab${createMarker(0)} cd`];
      // Value offset past 'abhello' = 7 → buffer col 6 (after marker)
      const cursor = getCursorFromValueOffset(lines, 7, r.state.placeholders);
      expect(cursor).toEqual({ line: 0, column: 6 });
    });
  });
});

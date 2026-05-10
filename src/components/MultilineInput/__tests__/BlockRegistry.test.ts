import { describe, it, expect } from 'vitest';
import type { ImageRef } from '../ImageTypes.js';
import {
  createBlockState,
  createPasteBlockEntry,
  createImageBlockEntry,
  removeBlock,
  getBlock,
  getDisplayLine,
  getValue,
  bufferColToDisplayCol,
  displayColToBufferCol,
  getValueCursorOffset,
  getCursorFromValueOffset,
} from '../BlockRegistry.js';
import { parseBlockMarkers } from '../BlockMarker.js';

function makeImageRef(overrides: Partial<ImageRef> = {}): ImageRef {
  return {
    id: 'img1',
    data: '',
    mimeType: 'image/png',
    byteSize: 100,
    displayNumber: 1,
    ...overrides,
  };
}

describe('createBlockState', () => {
  it('creates empty state with counters at 1', () => {
    const state = createBlockState();
    expect(state.entries.size).toBe(0);
    expect(state.nextPasteNumber).toBe(1);
    expect(state.nextImageNumber).toBe(1);
  });
});

describe('createPasteBlockEntry', () => {
  it('adds paste block and returns marker', () => {
    const state = createBlockState();
    const { id, marker, state: newState } = createPasteBlockEntry(state, 'original text', '[Paste text #1]');

    expect(id).toBeTruthy();
    expect(marker).toContain('p:');
    expect(marker).toContain(':1');
    expect(newState.entries.size).toBe(1);
    expect(newState.nextPasteNumber).toBe(2);
    expect(newState.nextImageNumber).toBe(1);

    const entry = newState.entries.get(id)!;
    expect(entry.kind).toBe('paste');
    if (entry.kind === 'paste') {
      expect(entry.originalText).toBe('original text');
      expect(entry.displayText).toBe('[Paste text #1]');
      expect(entry.displayNumber).toBe(1);
    }
  });

  it('increments paste counter', () => {
    const state = createBlockState();
    const { state: s1 } = createPasteBlockEntry(state, 'a', '[#1]');
    const { state: s2 } = createPasteBlockEntry(s1, 'b', '[#2]');

    expect(s2.nextPasteNumber).toBe(3);
    expect(s2.nextImageNumber).toBe(1);
    expect(s2.entries.size).toBe(2);
  });
});

describe('createImageBlockEntry', () => {
  it('adds image block and returns marker', () => {
    const state = createBlockState();
    const imgRef = makeImageRef();
    const { id, marker, state: newState } = createImageBlockEntry(state, imgRef);

    expect(id).toBe('img1');
    expect(marker).toContain('i:');
    expect(marker).toContain(':1');
    expect(newState.entries.size).toBe(1);
    expect(newState.nextImageNumber).toBe(2);
    expect(newState.nextPasteNumber).toBe(1);

    const entry = newState.entries.get(id)!;
    expect(entry.kind).toBe('image');
    if (entry.kind === 'image') {
      expect(entry.data).toBe('');
      expect(entry.mimeType).toBe('image/png');
      expect(entry.byteSize).toBe(100);
      expect(entry.displayNumber).toBe(1);
    }
  });

  it('increments image counter', () => {
    const state = createBlockState();
    const { state: s1 } = createImageBlockEntry(state, makeImageRef({ id: 'a' }));
    const { state: s2 } = createImageBlockEntry(s1, makeImageRef({ id: 'b', displayNumber: 2 }));

    expect(s2.nextImageNumber).toBe(3);
    expect(s2.nextPasteNumber).toBe(1);
    expect(s2.entries.size).toBe(2);
  });

  it('uses image ref displayNumber for marker and counter', () => {
    const state = createBlockState();
    const { marker, state: newState } = createImageBlockEntry(
      state,
      makeImageRef({ id: 'img5', displayNumber: 5 })
    );

    expect(marker).toContain(':5');
    expect(newState.nextImageNumber).toBe(6);
    const entry = newState.entries.get('img5')!;
    expect(entry.displayNumber).toBe(5);
  });

  it('paste and image counters are independent', () => {
    const state = createBlockState();
    const { state: s1 } = createPasteBlockEntry(state, 'text', '[Paste text #1]');
    const { state: s2 } = createImageBlockEntry(s1, makeImageRef());
    expect(s2.nextPasteNumber).toBe(2);
    expect(s2.nextImageNumber).toBe(2);
  });
});

describe('removeBlock', () => {
  it('removes block by id', () => {
    const state = createBlockState();
    const { id, state: s1 } = createPasteBlockEntry(state, 'a', '[#1]');
    expect(s1.entries.size).toBe(1);

    const s2 = removeBlock(s1, id);
    expect(s2.entries.size).toBe(0);
  });

  it('does nothing for non-existent id', () => {
    const state = createBlockState();
    const s1 = removeBlock(state, 'nonexistent');
    expect(s1.entries.size).toBe(0);
  });
});

describe('getBlock', () => {
  it('returns entry by id', () => {
    const state = createBlockState();
    const { id, state: s1 } = createPasteBlockEntry(state, 'a', '[#1]');
    const entry = getBlock(s1, id);
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe('paste');
  });

  it('returns undefined for non-existent id', () => {
    const state = createBlockState();
    expect(getBlock(state, 'nope')).toBeUndefined();
  });
});

describe('getDisplayLine', () => {
  it('expands paste marker to display text', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'original', '[Custom #1]');
    const line = `Hello ${marker} world`;
    expect(getDisplayLine(line, s1.entries)).toBe('Hello [Custom #1] world');
  });

  it('expands image marker to display text', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createImageBlockEntry(state, makeImageRef());
    const line = `a${marker}b`;
    expect(getDisplayLine(line, s1.entries)).toBe('a[Pasted Image #1]b');
  });

  it('returns line unchanged if no markers', () => {
    const state = createBlockState();
    expect(getDisplayLine('plain text', state.entries)).toBe('plain text');
  });
});

describe('getValue', () => {
  it('expands paste markers to original text', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'long original text', '[#1]');
    const lines = [`Hello ${marker} world`];
    expect(getValue(lines, s1.entries)).toBe('Hello long original text world');
  });

  it('leaves image markers as raw markers', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createImageBlockEntry(state, makeImageRef());
    const lines = [`a${marker}b`];
    expect(getValue(lines, s1.entries)).toBe(`a${marker}b`);
  });

  it('handles multiple lines', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'long', '[#1]');
    const lines = [`line1 ${marker}`, 'line2'];
    expect(getValue(lines, s1.entries)).toBe('line1 long\nline2');
  });

  it('returns original lines if no entries', () => {
    const state = createBlockState();
    expect(getValue(['hello'], state.entries)).toBe('hello');
  });
});

describe('bufferColToDisplayCol', () => {
  it('handles plain text without markers', () => {
    const state = createBlockState();
    expect(bufferColToDisplayCol('hello', 3, state.entries)).toBe(3);
  });

  it('maps column before marker', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'x', '[Display]');
    const line = `ab${marker}cd`;
    expect(bufferColToDisplayCol(line, 0, s1.entries)).toBe(0);
    expect(bufferColToDisplayCol(line, 1, s1.entries)).toBe(1);
    expect(bufferColToDisplayCol(line, 2, s1.entries)).toBe(2);
  });

  it('maps column within paste marker to display length', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'x', '[Display]');
    const line = `ab${marker}cd`;
    // marker is at buffer positions 2-~15
    const markers = parseBlockMarkers(line);
    const m = markers[0];
    // Any column within the marker should map to display col = 2 + 9 = 11
    expect(bufferColToDisplayCol(line, m.start + 1, s1.entries)).toBe(11);
    expect(bufferColToDisplayCol(line, m.end - 1, s1.entries)).toBe(11);
  });
});

describe('getValueCursorOffset', () => {
  it('computes offset in expanded value', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'hello', '[#1]');
    const lines = [`${marker} world`];
    // marker expands to 5 chars, so cursor at buffer position 0 maps to value position 0
    expect(getValueCursorOffset(lines, { line: 0, column: 0 }, s1.entries)).toBe(0);
    // Cursor after marker in buffer maps to value position after original text
    const markers = parseBlockMarkers(marker);
    expect(getValueCursorOffset(lines, { line: 0, column: markers[0].end }, s1.entries)).toBe(5);
    expect(getValueCursorOffset(lines, { line: 0, column: markers[0].end + 1 }, s1.entries)).toBe(6);
  });
});

describe('getCursorFromValueOffset', () => {
  it('converts value offset back to buffer cursor', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'hello', '[#1]');
    const lines = [`${marker} world`];
    const markers = parseBlockMarkers(marker);
    const cursor = getCursorFromValueOffset(lines, 5, s1.entries);
    expect(cursor.line).toBe(0);
    expect(cursor.column).toBe(markers[0].end);
  });
});

describe('displayColToBufferCol', () => {
  it('handles plain text without markers', () => {
    const state = createBlockState();
    expect(displayColToBufferCol('hello', 3, state.entries)).toBe(3);
  });

  it('maps display column past marker to buffer column past marker', () => {
    const state = createBlockState();
    const { marker, state: s1 } = createPasteBlockEntry(state, 'x', '[Display]');
    const line = `ab${marker}cd`;
    const markers = parseBlockMarkers(line);
    const displayLen = '[Display]'.length; // 9
    // display position after marker: 2 + 9 = 11 → buffer after marker
    expect(displayColToBufferCol(line, 2 + displayLen, s1.entries)).toBe(markers[0].end);
  });
});

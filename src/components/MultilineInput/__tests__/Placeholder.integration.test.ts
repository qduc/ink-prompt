import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextInput } from '../useTextInput.js';
import { parseBlockMarkers } from '../BlockMarker.js';
import { BLOCK_OPEN, BLOCK_CLOSE } from '../BlockMarker.js';

describe('Placeholder integration with useTextInput', () => {
  const longText = 'x'.repeat(200);

  it('creates a placeholder when pasting text exceeding pasteThreshold', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 100,
      undoDebounceMs: 0,
    }));

    act(() => {
      result.current.insert(longText);
    });

    const line = result.current.buffer.lines[0];
    expect(line).toContain(BLOCK_OPEN);
    expect(line).toContain('p:');

    expect(result.current.value).toBe(longText);

    const bufLine = result.current.buffer.lines[0];
    const markerEnd = bufLine.length;
    expect(result.current.cursor).toEqual({ line: 0, column: markerEnd });
  });

  it('does not create placeholder when pasteThreshold is not set', () => {
    const { result } = renderHook(() => useTextInput({
      undoDebounceMs: 0,
    }));

    act(() => {
      result.current.insert(longText);
    });

    expect(result.current.value).toBe(longText);
    expect(result.current.buffer.lines[0]).toBe(longText);
  });

  it('does not create placeholder for text below threshold', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 100,
      undoDebounceMs: 0,
    }));

    const shortText = 'short text';
    act(() => {
      result.current.insert(shortText);
    });

    expect(result.current.value).toBe(shortText);
    expect(result.current.buffer.lines[0]).toBe(shortText);
  });

  it('increments placeholder IDs for multiple pastes', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });

    act(() => { result.current.insert(' '); });

    act(() => { result.current.insert(longText + longText); });

    const line = result.current.buffer.lines[0];
    const markers = parseBlockMarkers(line);
    expect(markers.length).toBeGreaterThanOrEqual(2);
    const ids = markers.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('value returns original text with multiple placeholders', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    const text1 = 'abc'.repeat(10);
    const text2 = 'def'.repeat(10);

    act(() => { result.current.insert(text1); });
    act(() => { result.current.insert(' '); });
    act(() => { result.current.insert(text2); });

    expect(result.current.value).toBe(text1 + ' ' + text2);
  });

  it('backspace at end of placeholder deletes entire placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });

    expect(result.current.value).toBe(longText);

    act(() => { result.current.delete(); });

    expect(result.current.value).toBe('');
    expect(result.current.buffer.lines[0]).toBe('');
    expect(result.current.cursor).toEqual({ line: 0, column: 0 });
  });

  it('delete key at start of placeholder deletes entire placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });
    act(() => { result.current.insert(longText); });

    act(() => { result.current.moveCursor('lineStart'); });
    expect(result.current.cursor).toEqual({ line: 0, column: 0 });

    act(() => { result.current.deleteForward(); });
    expect(result.current.value).toBe(longText);
    expect(result.current.cursor).toEqual({ line: 0, column: 0 });

    act(() => { result.current.deleteForward(); });
    expect(result.current.value).toBe('');
    expect(result.current.buffer.lines[0]).toBe('');
  });

  it('left arrow jumps over placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });
    act(() => { result.current.insert(longText); });
    act(() => { result.current.insert('B'); });

    const line = result.current.buffer.lines[0];
    const markers = parseBlockMarkers(line);
    const marker = markers[0];
    const endCol = marker.end + 1; // 1 for B

    expect(result.current.cursor.column).toBe(endCol);

    // Move left to position after marker (before B)
    act(() => { result.current.moveCursor('left'); });
    expect(result.current.cursor.column).toBe(marker.end);

    // Move left again - should jump to marker start
    act(() => { result.current.moveCursor('left'); });
    expect(result.current.cursor.column).toBe(marker.start);
  });

  it('right arrow jumps over placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });
    act(() => { result.current.insert(longText); });
    act(() => { result.current.insert('B'); });

    act(() => { result.current.moveCursor('lineStart'); });
    expect(result.current.cursor.column).toBe(0);

    const line = result.current.buffer.lines[0];
    const markers = parseBlockMarkers(line);
    const marker = markers[0];

    // Move right past 'A'
    act(() => { result.current.moveCursor('right'); });
    expect(result.current.cursor.column).toBe(marker.start);

    // Move right again - should jump to marker end
    act(() => { result.current.moveCursor('right'); });
    expect(result.current.cursor.column).toBe(marker.end);
  });

  it('undo restores state before placeholder creation', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });

    act(() => { result.current.insert(longText); });
    expect(result.current.value).toBe('A' + longText);

    act(() => { result.current.undo(); });
    expect(result.current.value).toBe('A');
    expect(result.current.cursor).toEqual({ line: 0, column: 1 });

    act(() => { result.current.undo(); });
    expect(result.current.value).toBe('');
  });

  it('redo restores placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });
    act(() => { result.current.insert(longText); });
    expect(result.current.value).toBe('A' + longText);

    act(() => { result.current.undo(); });
    expect(result.current.value).toBe('A');

    act(() => { result.current.redo(); });
    expect(result.current.value).toBe('A' + longText);
    expect(result.current.buffer.lines[0]).toContain(BLOCK_OPEN);
  });

  it('handles multi-line original text', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    const multiLineText = 'hello\nworld\nfoo';
    act(() => { result.current.insert(multiLineText); });

    expect(result.current.value).toBe(multiLineText);

    expect(result.current.buffer.lines[0]).toContain(BLOCK_OPEN);
    expect(result.current.buffer.lines.length).toBe(1);
  });

  it('typing after placeholder works correctly', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });

    act(() => { result.current.insert(' and more'); });

    expect(result.current.value).toBe(longText + ' and more');
    const line = result.current.buffer.lines[0];
    expect(line).toContain(BLOCK_OPEN);
    expect(line).toContain(' and more');
  });

  it('typing before placeholder works correctly', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });

    act(() => { result.current.moveCursor('lineStart'); });

    act(() => { result.current.insert('prefix '); });

    expect(result.current.value).toBe('prefix ' + longText);
    const line = result.current.buffer.lines[0];
    expect(line).toContain(BLOCK_OPEN);
    expect(line).toContain('prefix ');
  });

  it('setText clears placeholders', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });
    expect(result.current.blockState.entries.size).toBe(1);

    act(() => { result.current.setText('new text'); });
    expect(result.current.value).toBe('new text');
    expect(result.current.blockState.entries.size).toBe(0);
  });

  it('custom formatPastePlaceholder is used for display text', () => {
    const formatter = (displayNumber: number) => `📋Pasted#${displayNumber}📋`;
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      formatPastePlaceholder: formatter,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });

    expect(result.current.value).toBe(longText);

    const entry = result.current.blockState.entries.values().next().value!;
    expect(entry.kind).toBe('paste');
    if (entry.kind === 'paste') {
      expect(entry.displayText).toBe('📋Pasted#1📋');
    }
  });

  it('placeholder counter is per useTextInput instance', () => {
    const { result: r1 } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    const { result: r2 } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => {
      r1.current.insert(longText);
      r2.current.insert(longText);
    });

    expect(r1.current.blockState.entries.size).toBe(1);
    expect(r2.current.blockState.entries.size).toBe(1);
  });

  it('strips \x00 from user input so it cannot impersonate a placeholder marker', () => {
    const { result } = renderHook(() => useTextInput({
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('hello\x00P0\x00world'); });

    expect(result.current.buffer.lines[0]).toBe('helloP0world');
    expect(result.current.value).toBe('helloP0world');
    expect(result.current.blockState.entries.size).toBe(0);
  });

  it('backspace at line start merges with previous line containing placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });
    act(() => { result.current.insert('\n'); });
    act(() => { result.current.insert('abc'); });

    expect(result.current.cursor).toEqual({ line: 1, column: 3 });

    for (let i = 0; i < 3; i++) {
      act(() => { result.current.moveCursor('left'); });
    }
    expect(result.current.cursor).toEqual({ line: 1, column: 0 });

    act(() => { result.current.delete(); });
    expect(result.current.cursor.line).toBe(0);
    expect(result.current.value).toBe(longText + 'abc');
  });

  it('delete at end of line merges with next line containing placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('hi'); });
    act(() => { result.current.insert('\n'); });
    act(() => { result.current.insert(longText); });

    act(() => { result.current.moveCursor('up'); });
    expect(result.current.cursor).toEqual({ line: 0, column: 2 });

    act(() => { result.current.deleteForward(); });
    expect(result.current.value).toBe('hi' + longText);
  });

  it('cursor offset is in value space with expanded text', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });
    const longLen = longText.length;

    expect(result.current.cursorOffset).toBe(1);

    act(() => { result.current.insert(longText); });

    expect(result.current.cursorOffset).toBe(1 + longLen);

    expect(result.current.value.length).toBe(1 + longLen);
  });
});

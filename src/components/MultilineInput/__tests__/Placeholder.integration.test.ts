import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextInput } from '../useTextInput.js';
import { findPlaceholderAt, findPlaceholderBefore } from '../Placeholder.js';

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

    // Text should contain the placeholder marker
    expect(result.current.buffer.lines[0]).toContain('\x00P');

    // Value should return the original text
    expect(result.current.value).toBe(longText);

    // Cursor should be after the placeholder
    const bufLine = result.current.buffer.lines[0];
    const markerEnd = bufLine.length; // marker is the only thing on the line
    expect(result.current.cursor).toEqual({ line: 0, column: markerEnd });
  });

  it('does not create placeholder when pasteThreshold is not set', () => {
    const { result } = renderHook(() => useTextInput({
      undoDebounceMs: 0,
    }));

    act(() => {
      result.current.insert(longText);
    });

    // Should contain the actual text, not a marker
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

    // Move cursor to end to insert more
    act(() => { result.current.insert(' '); });

    act(() => { result.current.insert(longText + longText); });

    // Two placeholders should exist
    const line = result.current.buffer.lines[0];
    expect(line.match(/\x00P\d+\x00/g)?.length).toBeGreaterThanOrEqual(2);
    // Different IDs
    const ids = line.match(/\x00P(\d+)\x00/g)!.map(s => parseInt(s.match(/\d+/)![0], 10));
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
    expect(result.current.buffer.lines[0]).toContain('\x00P0\x00');

    // Backspace should remove the whole placeholder
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

    // Insert text, then go back to start
    act(() => { result.current.insert('A'); });
    act(() => { result.current.insert(longText); });

    // Move cursor to start
    act(() => { result.current.moveCursor('lineStart'); });
    expect(result.current.cursor).toEqual({ line: 0, column: 0 });

    // Forward delete should delete 'A' first
    act(() => { result.current.deleteForward(); });
    expect(result.current.value).toBe(longText);
    expect(result.current.cursor).toEqual({ line: 0, column: 0 });

    // Forward delete again should delete the placeholder
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

    // Cursor at end: 'A'(0) + marker(1-4) + 'B'(5) → column 6
    expect(result.current.cursor.column).toBe(6);

    // Move left to column 5 (valid: before 'B', after marker)
    act(() => { result.current.moveCursor('left'); });
    expect(result.current.cursor.column).toBe(5);

    // Move left again - lands inside marker, skip to marker start (column 1)
    act(() => { result.current.moveCursor('left'); });
    expect(result.current.cursor.column).toBe(1);
  });

  it('right arrow jumps over placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });
    act(() => { result.current.insert(longText); });
    act(() => { result.current.insert('B'); });

    // Move cursor to start
    act(() => { result.current.moveCursor('lineStart'); });
    expect(result.current.cursor.column).toBe(0);

    // Move right to column 1 (valid: after 'A', before marker)
    act(() => { result.current.moveCursor('right'); });
    expect(result.current.cursor.column).toBe(1);

    // Move right again - lands inside marker, skip to marker end (column 5)
    act(() => { result.current.moveCursor('right'); });
    expect(result.current.cursor.column).toBe(5);
  });

  it('undo restores state before placeholder creation', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('A'); });

    act(() => { result.current.insert(longText); });
    expect(result.current.value).toBe('A' + longText);

    // Undo should remove the paste
    act(() => { result.current.undo(); });
    expect(result.current.value).toBe('A');
    expect(result.current.cursor).toEqual({ line: 0, column: 1 });

    // Undo again should remove 'A'
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

    // Undo the placeholder creation
    act(() => { result.current.undo(); });
    expect(result.current.value).toBe('A');

    // Redo should bring back the placeholder
    act(() => { result.current.redo(); });
    expect(result.current.value).toBe('A' + longText);
    expect(result.current.buffer.lines[0]).toContain('\x00P');
  });

  it('handles multi-line original text', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    const multiLineText = 'hello\nworld\nfoo';
    act(() => { result.current.insert(multiLineText); });

    // Value should contain the original multi-line text
    expect(result.current.value).toBe(multiLineText);

    // Buffer should have the marker on a single line
    expect(result.current.buffer.lines[0]).toContain('\x00P0\x00');
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
    expect(line).toContain('\x00P0\x00');
    expect(line).toContain(' and more');
  });

  it('typing before placeholder works correctly', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });

    // Move cursor to start
    act(() => { result.current.moveCursor('lineStart'); });

    act(() => { result.current.insert('prefix '); });

    expect(result.current.value).toBe('prefix ' + longText);
    const line = result.current.buffer.lines[0];
    expect(line).toContain('\x00P0\x00');
    expect(line).toContain('prefix ');
  });

  it('setText clears placeholders', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });
    expect(result.current.placeholderState.placeholders.size).toBe(1);

    act(() => { result.current.setText('new text'); });
    expect(result.current.value).toBe('new text');
    expect(result.current.placeholderState.placeholders.size).toBe(0);
  });

  it('custom formatPastePlaceholder is used for display text', () => {
    const formatter = (id: number) => `📋Pasted#${id}📋`;
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      formatPastePlaceholder: formatter,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });

    // Value should still have original text
    expect(result.current.value).toBe(longText);

    // The placeholder should have the custom display text
    const placeholderInfo = result.current.placeholderState.placeholders.get(0);
    expect(placeholderInfo?.displayText).toBe('📋Pasted#0📋');
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

    expect(r1.current.placeholderState.placeholders.get(0)).toBeDefined();
    expect(r2.current.placeholderState.placeholders.get(0)).toBeDefined();
  });

  it('strips \x00 from user input so it cannot impersonate a placeholder marker', () => {
    const { result } = renderHook(() => useTextInput({
      undoDebounceMs: 0,
    }));

    // Forge what looks like a marker for id 0
    act(() => { result.current.insert('hello\x00P0\x00world'); });

    // \x00 bytes are stripped, leaving plain text — no fake marker in buffer or value
    expect(result.current.buffer.lines[0]).toBe('helloP0world');
    expect(result.current.value).toBe('helloP0world');
    expect(result.current.placeholderState.placeholders.size).toBe(0);
  });

  it('backspace at line start merges with previous line containing placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert(longText); });
    act(() => { result.current.insert('\n'); });
    act(() => { result.current.insert('abc'); }); // 3 chars, below threshold

    // Cursor should be at end of line 1
    expect(result.current.cursor).toEqual({ line: 1, column: 3 }); // 'abc' = 3 chars

    // Move to start of second line
    for (let i = 0; i < 3; i++) {
      act(() => { result.current.moveCursor('left'); });
    }
    expect(result.current.cursor).toEqual({ line: 1, column: 0 });

    // Backspace should merge lines
    act(() => { result.current.delete(); });
    expect(result.current.cursor.line).toBe(0);
    // After merge: "\x00P0\x00abc" = 7 chars, cursor at previousLine.length = 4
    expect(result.current.cursor.column).toBe(4);
    expect(result.current.value).toBe(longText + 'abc');
  });

  it('delete at end of line merges with next line containing placeholder', () => {
    const { result } = renderHook(() => useTextInput({
      pasteThreshold: 10,
      undoDebounceMs: 0,
    }));

    act(() => { result.current.insert('hi'); }); // 2 chars, below threshold
    act(() => { result.current.insert('\n'); });
    act(() => { result.current.insert(longText); });

    // Move to end of first line
    act(() => { result.current.moveCursor('up'); });
    expect(result.current.cursor).toEqual({ line: 0, column: 2 }); // end of 'hi'

    // Forward delete should merge lines
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

    // Before paste, cursor offset = 1
    expect(result.current.cursorOffset).toBe(1);

    act(() => { result.current.insert(longText); });

    // After paste, cursor offset should be 1 + longLen (after the expanded text)
    expect(result.current.cursorOffset).toBe(1 + longLen);

    // Value is A + longText (length 1 + longLen)
    expect(result.current.value.length).toBe(1 + longLen);
  });
});

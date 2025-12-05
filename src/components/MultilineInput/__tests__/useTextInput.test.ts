import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTextInput } from '../useTextInput.js';

describe('useTextInput', () => {
  it('should initialize with empty buffer', () => {
    const { result } = renderHook(() => useTextInput());
    expect(result.current.value).toBe('');
    expect(result.current.cursor).toEqual({ line: 0, column: 0 });
  });

  it('should initialize with initial value', () => {
    const { result } = renderHook(() => useTextInput({ initialValue: 'Hello\nWorld' }));
    expect(result.current.value).toBe('Hello\nWorld');
    expect(result.current.cursor).toEqual({ line: 1, column: 5 }); // Cursor at end
  });

  it('should insert character', () => {
    const { result } = renderHook(() => useTextInput());

    act(() => {
      result.current.insert('a');
    });

    expect(result.current.value).toBe('a');
    expect(result.current.cursor).toEqual({ line: 0, column: 1 });
  });

  it('should delete character', () => {
    const { result } = renderHook(() => useTextInput({ initialValue: 'abc' }));

    act(() => {
      result.current.delete();
    });

    expect(result.current.value).toBe('ab');
    expect(result.current.cursor).toEqual({ line: 0, column: 2 });
  });

  it('should insert new line', () => {
    const { result } = renderHook(() => useTextInput({ initialValue: 'abc' }));

    // Move cursor to middle
    act(() => {
      result.current.moveCursor('left');
    });

    act(() => {
      result.current.newLine();
    });

    expect(result.current.value).toBe('ab\nc');
    expect(result.current.cursor).toEqual({ line: 1, column: 0 });
  });

  it('should move cursor', () => {
    const { result } = renderHook(() => useTextInput({ initialValue: 'abc' }));

    act(() => {
      result.current.moveCursor('left');
    });

    expect(result.current.cursor).toEqual({ line: 0, column: 2 });
  });

  it('should support undo/redo', () => {
    const { result } = renderHook(() => useTextInput());

    act(() => {
      result.current.insert('a');
    });
    expect(result.current.value).toBe('a');

    act(() => {
      result.current.undo();
    });
    expect(result.current.value).toBe('');

    act(() => {
      result.current.redo();
    });
    expect(result.current.value).toBe('a');
  });

  it('should remove backslash when deleted at end of line', () => {
    const { result } = renderHook(() => useTextInput({ initialValue: 'hello\\' }));

    // Cursor should be at end: { line: 0, column: 6 } (after the backslash)
    expect(result.current.cursor).toEqual({ line: 0, column: 6 });
    expect(result.current.value).toBe('hello\\');

    // Delete the backslash
    act(() => {
      result.current.delete();
    });

    // The backslash should be removed
    expect(result.current.value).toBe('hello');
    expect(result.current.cursor).toEqual({ line: 0, column: 5 });

    // Then add newline
    act(() => {
      result.current.newLine();
    });

    // Result should be 'hello' on first line, empty second line
    expect(result.current.value).toBe('hello\n');
    expect(result.current.cursor).toEqual({ line: 1, column: 0 });
  });

  it('should fail when delete and newLine are called separately (demonstrates the bug)', () => {
    const { result } = renderHook(() => useTextInput({ initialValue: 'hello\\' }));

    // Cursor should be at end: { line: 0, column: 6 } (after the backslash)
    expect(result.current.cursor).toEqual({ line: 0, column: 6 });
    expect(result.current.value).toBe('hello\\');

    // Call delete and newLine in the same synchronous execution (as old KeyHandler did)
    act(() => {
      result.current.delete();
      result.current.newLine(); // This will use the OLD state!
    });

    // BUG: The backslash is NOT removed because newLine uses old state
    // This demonstrates why we need deleteAndNewLine
    expect(result.current.value).toBe('hello\\\n');
    expect(result.current.cursor).toEqual({ line: 1, column: 0 });
  });

  it('should correctly remove backslash using deleteAndNewLine action', () => {
    const { result } = renderHook(() => useTextInput({ initialValue: 'hello\\' }));

    // Cursor should be at end: { line: 0, column: 6 } (after the backslash)
    expect(result.current.cursor).toEqual({ line: 0, column: 6 });
    expect(result.current.value).toBe('hello\\');

    // Use the combined action
    act(() => {
      result.current.deleteAndNewLine();
    });

    // The backslash should be removed and newline added
    expect(result.current.value).toBe('hello\n');
    expect(result.current.cursor).toEqual({ line: 1, column: 0 });
  });

  describe('visual navigation with width', () => {
    // 25-char line with width=10 wraps into 3 visual lines
    const longLine = '0123456789012345678901234';

    it('should move cursor down within wrapped line', () => {
      const { result } = renderHook(() => useTextInput({ initialValue: longLine, width: 10 }));

      // Start at end of line (column 25)
      expect(result.current.cursor).toEqual({ line: 0, column: 25 });

      // Move to column 5 (visual row 0) - each move needs its own act()
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.moveCursor('left');
        });
      }
      expect(result.current.cursor).toEqual({ line: 0, column: 5 });

      // Move down - should go to visual row 1, column 5 → buffer column 15
      act(() => {
        result.current.moveCursor('down');
      });
      expect(result.current.cursor).toEqual({ line: 0, column: 15 });
    });

    it('should move cursor up within wrapped line', () => {
      const { result } = renderHook(() => useTextInput({ initialValue: longLine, width: 10 }));

      // Start at end of line (column 25)
      expect(result.current.cursor).toEqual({ line: 0, column: 25 });

      // Move to column 15 (visual row 1, visual col 5)
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.moveCursor('left');
        });
      }
      expect(result.current.cursor).toEqual({ line: 0, column: 15 });

      // Move up - should go to visual row 0, column 5 → buffer column 5
      act(() => {
        result.current.moveCursor('up');
      });
      expect(result.current.cursor).toEqual({ line: 0, column: 5 });
    });

    it('should move cursor between buffer lines crossing wrapped visual lines', () => {
      const { result } = renderHook(() => useTextInput({ initialValue: longLine + '\nhello', width: 10 }));

      // Cursor starts at end of 'hello' (line 1, column 5)
      expect(result.current.cursor).toEqual({ line: 1, column: 5 });

      // Move up - should go to last visual row of first line (visual row 2, col 5 → buffer col 25)
      act(() => {
        result.current.moveCursor('up');
      });
      // Visual row 2 only has 5 chars, so col 5 clamps to end of line
      expect(result.current.cursor).toEqual({ line: 0, column: 25 });
    });

    it('should use buffer-line movement when width is not provided', () => {
      const { result } = renderHook(() => useTextInput({ initialValue: longLine + '\nhello' }));

      // Cursor starts at end of 'hello' (line 1, column 5)
      expect(result.current.cursor).toEqual({ line: 1, column: 5 });

      // Move up without width - should go to line 0, column 5 (buffer line movement)
      act(() => {
        result.current.moveCursor('up');
      });
      expect(result.current.cursor).toEqual({ line: 0, column: 5 });
    });
  });
});

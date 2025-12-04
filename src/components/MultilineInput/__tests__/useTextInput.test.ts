import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTextInput } from '../useTextInput';

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
});

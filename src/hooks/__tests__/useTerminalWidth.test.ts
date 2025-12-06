import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminalWidth } from '../useTerminalWidth.js';
import { EventEmitter } from 'events';

// Mock stdout
const mockStdout = new EventEmitter();
(mockStdout as any).columns = 80;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({
      stdout: mockStdout,
    }),
  };
});

describe('useTerminalWidth', () => {
  beforeEach(() => {
    (mockStdout as any).columns = 80;
    mockStdout.removeAllListeners();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns default terminal width', () => {
    const { result } = renderHook(() => useTerminalWidth());
    expect(result.current).toBe(80);
  });

  it('returns prop width when provided', () => {
    const { result } = renderHook(() => useTerminalWidth(100));
    expect(result.current).toBe(100);
  });

  it('updates width on resize', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTerminalWidth());

    expect(result.current).toBe(80);

    // Simulate resize
    (mockStdout as any).columns = 120;
    act(() => {
      mockStdout.emit('resize');
    });

    // Wait for debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(120);

    vi.useRealTimers();
  });

  it('does not update when prop width is provided', () => {
    const { result } = renderHook(() => useTerminalWidth(50));

    expect(result.current).toBe(50);

    // Simulate resize - should still use prop width
    (mockStdout as any).columns = 120;
    act(() => {
      mockStdout.emit('resize');
    });

    // Still returns prop width
    expect(result.current).toBe(50);
  });

  it('cleans up resize listener on unmount', () => {
    const { unmount } = renderHook(() => useTerminalWidth());

    expect(mockStdout.listenerCount('resize')).toBe(1);

    unmount();

    expect(mockStdout.listenerCount('resize')).toBe(0);
  });

  it('debounces multiple rapid resize events', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTerminalWidth());

    expect(result.current).toBe(80);

    // Simulate rapid resize events
    (mockStdout as any).columns = 100;
    act(() => {
      mockStdout.emit('resize');
    });

    (mockStdout as any).columns = 120;
    act(() => {
      mockStdout.emit('resize');
    });

    (mockStdout as any).columns = 140;
    act(() => {
      mockStdout.emit('resize');
    });

    // Still at initial width because debounce hasn't fired yet
    expect(result.current).toBe(80);

    // Wait for debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Now updated to the last value
    expect(result.current).toBe(140);

    vi.useRealTimers();
  });

  it('accepts custom debounce delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTerminalWidth(undefined, 50));

    expect(result.current).toBe(80);

    // Simulate resize
    (mockStdout as any).columns = 100;
    act(() => {
      mockStdout.emit('resize');
    });

    expect(result.current).toBe(80);

    // Wait for custom debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe(100);

    vi.useRealTimers();
  });

  it('cancels pending debounce on unmount', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useTerminalWidth());

    // Simulate resize
    (mockStdout as any).columns = 100;
    act(() => {
      mockStdout.emit('resize');
    });

    // Unmount before debounce fires
    unmount();

    // Advance time past debounce delay
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // No errors should occur
    expect(true).toBe(true);

    vi.useRealTimers();
  });
});

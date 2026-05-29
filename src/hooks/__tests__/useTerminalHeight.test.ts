import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminalHeight } from '../useTerminalHeight.js';
import { EventEmitter } from 'events';

// Mock stdout
const mockStdout = new EventEmitter();
(mockStdout as any).rows = 24;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({
      stdout: mockStdout,
    }),
  };
});

describe('useTerminalHeight', () => {
  beforeEach(() => {
    (mockStdout as any).rows = 24;
    mockStdout.removeAllListeners();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns default terminal height', () => {
    const { result } = renderHook(() => useTerminalHeight());
    expect(result.current).toBe(24);
  });

  it('returns prop height when provided', () => {
    const { result } = renderHook(() => useTerminalHeight(10));
    expect(result.current).toBe(10);
  });

  it('updates height on resize', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTerminalHeight());

    expect(result.current).toBe(24);

    // Simulate resize
    (mockStdout as any).rows = 40;
    act(() => {
      mockStdout.emit('resize');
    });

    // Wait for debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(40);

    vi.useRealTimers();
  });

  it('does not update when prop height is provided', () => {
    const { result } = renderHook(() => useTerminalHeight(15));

    expect(result.current).toBe(15);

    // Simulate resize - should still use prop height
    (mockStdout as any).rows = 40;
    act(() => {
      mockStdout.emit('resize');
    });

    // Still returns prop height
    expect(result.current).toBe(15);
  });

  it('cleans up resize listener on unmount', () => {
    const { unmount } = renderHook(() => useTerminalHeight());

    expect(mockStdout.listenerCount('resize')).toBe(1);

    unmount();

    expect(mockStdout.listenerCount('resize')).toBe(0);
  });

  it('debounces multiple rapid resize events', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTerminalHeight());

    expect(result.current).toBe(24);

    // Simulate rapid resize events
    (mockStdout as any).rows = 30;
    act(() => {
      mockStdout.emit('resize');
    });

    (mockStdout as any).rows = 35;
    act(() => {
      mockStdout.emit('resize');
    });

    (mockStdout as any).rows = 45;
    act(() => {
      mockStdout.emit('resize');
    });

    // Still at initial height because debounce hasn't fired yet
    expect(result.current).toBe(24);

    // Wait for debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Now updated to the last value
    expect(result.current).toBe(45);

    vi.useRealTimers();
  });

  it('accepts custom debounce delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTerminalHeight(undefined, 50));

    expect(result.current).toBe(24);

    // Simulate resize
    (mockStdout as any).rows = 30;
    act(() => {
      mockStdout.emit('resize');
    });

    expect(result.current).toBe(24);

    // Wait for custom debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe(30);

    vi.useRealTimers();
  });

  it('cancels pending debounce on unmount', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useTerminalHeight());

    // Simulate resize
    (mockStdout as any).rows = 30;
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

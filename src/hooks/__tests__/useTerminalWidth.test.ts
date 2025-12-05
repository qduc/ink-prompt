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

  it('updates width on resize', () => {
    const { result } = renderHook(() => useTerminalWidth());

    expect(result.current).toBe(80);

    // Simulate resize
    (mockStdout as any).columns = 120;
    act(() => {
      mockStdout.emit('resize');
    });

    expect(result.current).toBe(120);
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
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MultilineInput } from '../index.js';
import { EventEmitter } from 'events';

// Create event emitters for standard streams
const mockStdout = new EventEmitter();
(mockStdout as any).columns = 80;

const mockStdin = new EventEmitter();

let capturedUseInputHandler: ((input: string, key: any) => void) | null = null;

vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useStdout: () => ({
      stdout: mockStdout,
    }),
    useStdin: () => ({
      stdin: mockStdin,
      isRawModeSupported: true,
    }),
    useInput: (handler: any) => {
      capturedUseInputHandler = handler;
    },
  };
});

describe('MultilineInput Meta Key handling', () => {
  beforeEach(() => {
    capturedUseInputHandler = null;
    mockStdin.removeAllListeners();
    vi.clearAllMocks();
  });

  it('correctly maps Alt+\\ (buffer start) even when Ink fails to parse key.meta', () => {
    const onCursorChange = vi.fn();
    
    // Initial value is "hello", cursor is at offset 5 (end)
    render(
      <MultilineInput 
        value="hello" 
        onCursorChange={onCursorChange} 
        isActive={true} 
      />
    );

    expect(capturedUseInputHandler).not.toBeNull();

    // 1. Simulate the raw stdin data event and useInput handler in act
    act(() => {
      mockStdin.emit('data', Buffer.from('\x1b\\'));
      capturedUseInputHandler!('\\', { meta: false });
    });

    // The cursor should have moved to buffer start (offset 0)
    expect(onCursorChange).toHaveBeenLastCalledWith(0);
  });

  it('correctly maps Alt+/ (buffer end) even when Ink fails to parse key.meta', () => {
    const onCursorChange = vi.fn();
    
    // We render and override cursor to start (offset 0)
    render(
      <MultilineInput 
        value="hello" 
        onCursorChange={onCursorChange} 
        cursorOverride={0}
        isActive={true} 
      />
    );

    expect(capturedUseInputHandler).not.toBeNull();

    // Clear initial cursor change calls to avoid confusion
    onCursorChange.mockClear();

    // 1. Simulate the raw stdin data event and useInput handler in act
    act(() => {
      mockStdin.emit('data', Buffer.from('\x1b/'));
      capturedUseInputHandler!('/', { meta: false });
    });

    // The cursor should have moved to buffer end (offset 5)
    expect(onCursorChange).toHaveBeenLastCalledWith(5);
  });

  it('does not touch key.meta if it is not a 2-char escape sequence', () => {
    const onChange = vi.fn();
    
    render(
      <MultilineInput 
        value="" 
        onChange={onChange}
        isActive={true} 
      />
    );

    expect(capturedUseInputHandler).not.toBeNull();

    onChange.mockClear();

    // Simulate typing a slash character (normal '/')
    act(() => {
      mockStdin.emit('data', Buffer.from('/'));
      capturedUseInputHandler!('/', { meta: false });
    });

    // It should be treated as a normal character insertion
    expect(onChange).toHaveBeenLastCalledWith('/');
  });

  it('correctly inserts a newline when Shift+Enter xterm escape sequence [27;2;13~ is received', () => {
    const onChange = vi.fn();
    
    render(
      <MultilineInput 
        value="first" 
        onChange={onChange} 
        isActive={true} 
      />
    );

    expect(capturedUseInputHandler).not.toBeNull();

    act(() => {
      mockStdin.emit('data', Buffer.from('\x1b[27;2;13~'));
      capturedUseInputHandler!('[27;2;13~', {});
    });

    expect(onChange).toHaveBeenLastCalledWith('first\n');
  });
});

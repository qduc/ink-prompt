import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../clipboard/index.js', () => ({
  createClipboardReader: vi.fn(() => ({
    read: vi.fn(),
  })),
}));

describe('useClipboardPaste', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('isPasting toggles correctly during paste', async () => {
    const { createClipboardReader } = await import('../clipboard/index.js');
    (createClipboardReader as any).mockReturnValue({
      read: vi.fn(() => new Promise(() => {})), // never resolves
    });

    const { useClipboardPaste } = await import('../useClipboardPaste.js');
    const { result } = renderHook(() => useClipboardPaste({ enableImagePaste: true }));

    expect(result.current.isPasting).toBe(false);

    // Start paste and advance timers within act
    let r: any;
    await act(async () => {
      const promise = result.current.paste();
      vi.advanceTimersByTime(2000);
      r = await promise;
    });

    expect(r.kind).toBe('empty');
    expect(result.current.isPasting).toBe(false);
  });

  it('returns text kind when clipboard has text', async () => {
    const { createClipboardReader } = await import('../clipboard/index.js');
    (createClipboardReader as any).mockReturnValue({
      read: vi.fn(() =>
        Promise.resolve({ kind: 'text', value: 'hello world' })
      ),
    });

    const { useClipboardPaste } = await import('../useClipboardPaste.js');
    const { result } = renderHook(() => useClipboardPaste({ enableImagePaste: true }));

    let pasteResult: any;
    await act(async () => {
      pasteResult = await result.current.paste();
    });

    expect(pasteResult.kind).toBe('text');
    expect(pasteResult.value).toBe('hello world');
  });

  it('returns empty when clipboard is empty', async () => {
    const { createClipboardReader } = await import('../clipboard/index.js');
    (createClipboardReader as any).mockReturnValue({
      read: vi.fn(() => Promise.resolve({ kind: 'empty' })),
    });

    const { useClipboardPaste } = await import('../useClipboardPaste.js');
    const { result } = renderHook(() => useClipboardPaste({ enableImagePaste: true }));

    let pasteResult: any;
    await act(async () => {
      pasteResult = await result.current.paste();
    });

    expect(pasteResult.kind).toBe('empty');
  });

  it('calls onPasteError on validation failure', async () => {
    const onPasteError = vi.fn();
    const { createClipboardReader } = await import('../clipboard/index.js');
    (createClipboardReader as any).mockReturnValue({
      read: vi.fn(() =>
        Promise.resolve({
          kind: 'image',
          mimeType: 'image/png',
          bytes: Buffer.from([0, 1, 2, 3]),
        })
      ),
    });

    const { useClipboardPaste } = await import('../useClipboardPaste.js');
    const { result } = renderHook(() =>
      useClipboardPaste({ enableImagePaste: true, onPasteError, acceptedMimeTypes: ['image/jpeg'] })
    );

    let pasteResult: any;
    await act(async () => {
      pasteResult = await result.current.paste();
    });

    expect(pasteResult.kind).toBe('empty');
    expect(onPasteError).toHaveBeenCalledWith('clipboard-unsupported-type');
  });

  it('returns image kind for valid image', async () => {
    const { createClipboardReader } = await import('../clipboard/index.js');
    (createClipboardReader as any).mockReturnValue({
      read: vi.fn(() =>
        Promise.resolve({
          kind: 'image',
          mimeType: 'image/png',
          bytes: Buffer.from('89504e470d0a1a0a', 'hex'),
        })
      ),
    });

    const { useClipboardPaste } = await import('../useClipboardPaste.js');
    const { result } = renderHook(() => useClipboardPaste({ enableImagePaste: true }));

    let pasteResult: any;
    await act(async () => {
      pasteResult = await result.current.paste();
    });

    expect(pasteResult.kind).toBe('image');
    expect(pasteResult.imageRef.mimeType).toBe('image/png');
    expect(pasteResult.imageRef.displayNumber).toBe(1);
  });

  it('rejects image paste when existing images reach max count', async () => {
    const onPasteError = vi.fn();
    const { createClipboardReader } = await import('../clipboard/index.js');
    (createClipboardReader as any).mockReturnValue({
      read: vi.fn(() =>
        Promise.resolve({
          kind: 'image',
          mimeType: 'image/png',
          bytes: Buffer.from('89504e470d0a1a0a', 'hex'),
        })
      ),
    });

    const { useClipboardPaste } = await import('../useClipboardPaste.js');
    const { result } = renderHook(() =>
      useClipboardPaste({
        enableImagePaste: true,
        maxImageCount: 1,
        existingImages: [
          { id: 'img1', data: '', mimeType: 'image/png', byteSize: 8, displayNumber: 1 },
        ],
        onPasteError,
      })
    );

    let pasteResult: any;
    await act(async () => {
      pasteResult = await result.current.paste();
    });

    expect(pasteResult.kind).toBe('empty');
    expect(onPasteError).toHaveBeenCalledWith('too-many-images');
  });

  it('handles clipboard read error', async () => {
    const onPasteError = vi.fn();
    const { createClipboardReader } = await import('../clipboard/index.js');
    (createClipboardReader as any).mockReturnValue({
      read: vi.fn(() => Promise.reject(new Error('clipboard error'))),
    });

    const { useClipboardPaste } = await import('../useClipboardPaste.js');
    const { result } = renderHook(() => useClipboardPaste({ enableImagePaste: true, onPasteError }));

    let pasteResult: any;
    await act(async () => {
      pasteResult = await result.current.paste();
    });

    expect(pasteResult.kind).toBe('empty');
    expect(onPasteError).toHaveBeenCalledWith('clipboard-read-error');
  });
});

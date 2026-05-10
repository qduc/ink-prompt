import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTextInput } from '../useTextInput.js';
import { createSentinel, getPlaceholderText } from '../ImageSentinel.js';
import type { ImageRef } from '../ImageTypes.js';

describe('useTextInput with images', () => {
  const makeImageRef = (id: string, displayNumber: number): ImageRef => ({
    id,
    data: 'base64data',
    mimeType: 'image/png',
    byteSize: 100,
    displayNumber,
  });

  describe('insertImage', () => {
    it('adds sentinel to text and image to map', () => {
      const { result } = renderHook(() => useTextInput());
      const imgRef = makeImageRef('img1', 1);

      act(() => {
        result.current.insertImage(imgRef);
      });

      const sentinel = createSentinel('img1', 1);
      expect(result.current.value).toBe(sentinel);
      expect(result.current.getImages()).toEqual([imgRef]);
    });

    it('assigns correct displayNumber', () => {
      const { result } = renderHook(() => useTextInput());
      const img1 = makeImageRef('img1', 1);
      const img2 = makeImageRef('img2', 2);

      act(() => { result.current.insertImage(img1); });
      act(() => { result.current.insertImage(img2); });

      const images = result.current.getImages();
      expect(images).toHaveLength(2);
      expect(images[0].displayNumber).toBe(1);
      expect(images[1].displayNumber).toBe(2);
    });
  });

  describe('deleteChar removes image and sentinel', () => {
    it('removes sentinel and image from map on backspace', () => {
      const { result } = renderHook(() => useTextInput());
      const imgRef = makeImageRef('img1', 1);

      act(() => { result.current.insertImage(imgRef); });
      const sentinel = createSentinel('img1', 1);
      // Cursor is at end of sentinel
      expect(result.current.cursor.column).toBe(sentinel.length);

      act(() => {
        result.current.delete();
      });

      expect(result.current.value).toBe('');
      expect(result.current.getImages()).toEqual([]);
    });
  });

  describe('deleteForward removes image and sentinel', () => {
    it('removes sentinel and image from map on delete key', () => {
      const { result } = renderHook(() => useTextInput());
      const imgRef = makeImageRef('img1', 1);

      act(() => { result.current.insertImage(imgRef); });

      // Move cursor to before the sentinel
      act(() => { result.current.moveCursor('left'); });
      act(() => { result.current.moveCursor('left'); });
      // Cursor should now be before the sentinel
      expect(result.current.cursor.column).toBe(0);

      act(() => {
        result.current.deleteForward();
      });

      // Should have deleted the whole sentinel
      expect(result.current.value).toBe('');
      expect(result.current.getImages()).toEqual([]);
    });
  });

  describe('undo/redo with images', () => {
    it('undo restores deleted image', () => {
      const { result } = renderHook(() => useTextInput({ undoDebounceMs: 0 }));
      const imgRef = makeImageRef('img1', 1);

      act(() => { result.current.insertImage(imgRef); });
      expect(result.current.getImages()).toHaveLength(1);

      act(() => { result.current.delete(); });
      expect(result.current.getImages()).toHaveLength(0);

      act(() => { result.current.undo(); });
      expect(result.current.getImages()).toHaveLength(1);
      expect(result.current.getImages()[0].displayNumber).toBe(1);
    });

    it('redo re-applies image insert', () => {
      const { result } = renderHook(() => useTextInput({ undoDebounceMs: 0 }));
      const imgRef = makeImageRef('img1', 1);

      act(() => { result.current.insertImage(imgRef); });
      act(() => { result.current.undo(); });
      expect(result.current.getImages()).toHaveLength(0);

      act(() => { result.current.redo(); });
      expect(result.current.getImages()).toHaveLength(1);
      expect(result.current.getImages()[0].displayNumber).toBe(1);
    });
  });

  describe('setText cleans up orphaned sentinels', () => {
    it('removes images whose sentinels are no longer in text', () => {
      const { result } = renderHook(() => useTextInput());
      const img1 = makeImageRef('img1', 1);
      const img2 = makeImageRef('img2', 2);

      act(() => { result.current.insertImage(img1); });
      act(() => { result.current.insertImage(img2); });

      expect(result.current.getImages()).toHaveLength(2);

      // setText to a value that only contains img1's sentinel
      const sentinel1 = createSentinel('img1', 1);
      act(() => {
        result.current.setText(sentinel1 + ' extra');
      });

      const images = result.current.getImages();
      expect(images).toHaveLength(1);
      expect(images[0].id).toBe('img1');
    });
  });
});

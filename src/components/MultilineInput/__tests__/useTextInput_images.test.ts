import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTextInput } from '../useTextInput.js';
import { createBlockMarker } from '../BlockMarker.js';
import type { ImageRef } from '../ImageTypes.js';

describe('useTextInput with images', () => {
  const makeImageRef = (id: string, displayNumber?: number): ImageRef => ({
    id,
    data: 'base64data',
    mimeType: 'image/png',
    byteSize: 100,
    displayNumber: displayNumber || 1,
  });

  describe('insertImage', () => {
    it('adds sentinel to text and image to map', () => {
      const { result } = renderHook(() => useTextInput());
      const imgRef = makeImageRef('img1');

      act(() => {
        result.current.insertImage(imgRef);
      });

      expect(result.current.getImages()).toHaveLength(1);
      expect(result.current.getImages()[0].id).toBe('img1');

      const line = result.current.buffer.lines[0];
      expect(line).toContain(createBlockMarker('i', 'img1', 1));
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

    it('continues numbering after controlled images are synced', () => {
      const { result } = renderHook(() => useTextInput());

      act(() => {
        result.current.setImages([makeImageRef('img5', 5)]);
      });
      act(() => {
        result.current.insertImage(makeImageRef('img6', 6));
      });

      expect(result.current.getImages().map((img) => img.displayNumber)).toEqual([5, 6]);
      expect(result.current.buffer.lines[0]).toContain(createBlockMarker('i', 'img6', 6));
    });
  });

  describe('deleteChar removes image and sentinel', () => {
    it('removes sentinel and image from map on backspace', () => {
      const { result } = renderHook(() => useTextInput());
      const imgRef = makeImageRef('img1');

      act(() => { result.current.insertImage(imgRef); });

      const markerLen = createBlockMarker('i', 'img1', 1).length;
      expect(result.current.cursor.column).toBe(markerLen);

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
      const imgRef = makeImageRef('img1');

      act(() => { result.current.insertImage(imgRef); });

      act(() => { result.current.moveCursor('left'); });
      act(() => { result.current.moveCursor('left'); });
      expect(result.current.cursor.column).toBe(0);

      act(() => {
        result.current.deleteForward();
      });

      expect(result.current.value).toBe('');
      expect(result.current.getImages()).toEqual([]);
    });
  });

  describe('undo/redo with images', () => {
    it('undo restores deleted image', () => {
      const { result } = renderHook(() => useTextInput({ undoDebounceMs: 0 }));
      const imgRef = makeImageRef('img1');

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
      const imgRef = makeImageRef('img1');

      act(() => { result.current.insertImage(imgRef); });
      act(() => { result.current.undo(); });
      expect(result.current.getImages()).toHaveLength(0);

      act(() => { result.current.redo(); });
      expect(result.current.getImages()).toHaveLength(1);
      expect(result.current.getImages()[0].displayNumber).toBe(1);
    });
  });

  describe('setText cleans up orphaned sentinels', () => {
    it('setText clears block entries', () => {
      const { result } = renderHook(() => useTextInput());
      const img1 = makeImageRef('img1');

      act(() => { result.current.insertImage(img1); });
      expect(result.current.getImages()).toHaveLength(1);

      act(() => { result.current.setText('new text'); });

      expect(result.current.getImages()).toHaveLength(0);
      expect(result.current.value).toBe('new text');
    });
  });
});

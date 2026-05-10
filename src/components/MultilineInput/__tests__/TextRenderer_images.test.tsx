import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TextRenderer, wrapLines } from '../TextRenderer.js';
import { createSentinel } from '../ImageSentinel.js';
import type { ImageRef } from '../ImageTypes.js';
import type { Buffer, Cursor } from '../types.js';

describe('TextRenderer with images', () => {
  const sentinel1 = createSentinel('img1', 1);
  const sentinel2 = createSentinel('img2', 2);
  const images: Record<string, ImageRef> = {
    img1: { id: 'img1', data: '', mimeType: 'image/png', byteSize: 100, displayNumber: 1 },
    img2: { id: 'img2', data: '', mimeType: 'image/png', byteSize: 100, displayNumber: 2 },
  };

  describe('wrapLines', () => {
    it('renders normal text unchanged when no sentinels', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 5 };
      const result = wrapLines(buffer, cursor, 80, {});

      expect(result.visualLines).toEqual(['hello']);
      expect(result.cursorVisualRow).toBe(0);
      expect(result.cursorVisualCol).toBe(5);
    });

    it('renders sentinel placeholder text in visual lines', () => {
      const buffer: Buffer = { lines: [sentinel1] };
      const cursor: Cursor = { line: 0, column: sentinel1.length };
      const result = wrapLines(buffer, cursor, 80, images);

      expect(result.visualLines).toEqual(['[Pasted Image #1]']);
      expect(result.cursorVisualRow).toBe(0);
      expect(result.cursorVisualCol).toBe(17);
    });

    it('renders text around sentinel placeholder', () => {
      const buffer: Buffer = { lines: [`hello ${sentinel1} world`] };
      const cursor: Cursor = { line: 0, column: 0 };
      const result = wrapLines(buffer, cursor, 80, images);

      expect(result.visualLines).toEqual(['hello [Pasted Image #1] world']);
    });

    it('does not split sentinel placeholder text while wrapping', () => {
      const buffer: Buffer = { lines: [`aa ${sentinel1}`] };
      const cursor: Cursor = { line: 0, column: `aa ${sentinel1}`.length };
      const result = wrapLines(buffer, cursor, 10, images);

      expect(result.visualLines).toEqual(['aa', '[Pasted Image #1]']);
      expect(result.cursorVisualRow).toBe(1);
      expect(result.cursorVisualCol).toBe('[Pasted Image #1]'.length);
    });
  });

  describe('TextRenderer component', () => {
    it('renders sentinel as dimmed placeholder text', () => {
      const buffer: Buffer = { lines: [sentinel1] };
      const cursor: Cursor = { line: 0, column: sentinel1.length };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} images={images} showCursor={false} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
    });

    it('renders multiple sentinels', () => {
      const buffer: Buffer = { lines: [`${sentinel1} ${sentinel2}`] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} images={images} showCursor={false} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
      expect(container.textContent).toContain('[Pasted Image #2]');
    });

    it('renders cursor before sentinel', () => {
      const buffer: Buffer = { lines: [sentinel1] };
      const cursor: Cursor = { line: 0, column: 0 }; // before sentinel

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} images={images} showCursor={true} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
    });

    it('renders cursor after sentinel', () => {
      const buffer: Buffer = { lines: [sentinel1] };
      const cursor: Cursor = { line: 0, column: sentinel1.length }; // after sentinel

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} images={images} showCursor={true} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
    });
  });
});

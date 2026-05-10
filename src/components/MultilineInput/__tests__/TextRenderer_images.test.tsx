import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TextRenderer, wrapLines } from '../TextRenderer.js';
import { createBlockMarker } from '../BlockMarker.js';
import type { BlockState } from '../BlockTypes.js';
import type { Buffer, Cursor } from '../types.js';

function makeBlockState(entries: Array<{ id: string; displayNumber: number }>): BlockState {
  const map = new Map();
  for (const e of entries) {
    map.set(e.id, {
      kind: 'image' as const,
      id: e.id,
      displayNumber: e.displayNumber,
      data: '',
      mimeType: 'image/png',
      byteSize: 100,
    });
  }
  return { entries: map, nextPasteNumber: 1, nextImageNumber: 3 };
}

describe('TextRenderer with images', () => {
  const sentinel1 = createBlockMarker('i', 'img1', 1);
  const sentinel2 = createBlockMarker('i', 'img2', 2);
  const blockState = makeBlockState([
    { id: 'img1', displayNumber: 1 },
    { id: 'img2', displayNumber: 2 },
  ]);

  describe('wrapLines', () => {
    it('renders normal text unchanged when no sentinels', () => {
      const buffer: Buffer = { lines: ['hello'] };
      const cursor: Cursor = { line: 0, column: 5 };
      const result = wrapLines(buffer, cursor, 80);

      expect(result.visualLines).toEqual(['hello']);
      expect(result.cursorVisualRow).toBe(0);
      expect(result.cursorVisualCol).toBe(5);
    });

    it('renders sentinel placeholder text in visual lines', () => {
      const buffer: Buffer = { lines: [sentinel1] };
      const cursor: Cursor = { line: 0, column: sentinel1.length };
      const result = wrapLines(buffer, cursor, 80);

      expect(result.visualLines).toEqual(['[Pasted Image #1]']);
      expect(result.cursorVisualRow).toBe(0);
      expect(result.cursorVisualCol).toBe(17);
    });

    it('renders text around sentinel placeholder', () => {
      const buffer: Buffer = { lines: [`hello ${sentinel1} world`] };
      const cursor: Cursor = { line: 0, column: 0 };
      const result = wrapLines(buffer, cursor, 80);

      expect(result.visualLines).toEqual(['hello [Pasted Image #1] world']);
    });

    it('does not split sentinel placeholder text while wrapping', () => {
      const buffer: Buffer = { lines: [`aa ${sentinel1}`] };
      const cursor: Cursor = { line: 0, column: `aa ${sentinel1}`.length };
      const result = wrapLines(buffer, cursor, 10);

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
        <TextRenderer buffer={buffer} cursor={cursor} blockState={blockState} showCursor={false} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
    });

    it('renders multiple sentinels', () => {
      const buffer: Buffer = { lines: [`${sentinel1} ${sentinel2}`] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} blockState={blockState} showCursor={false} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
      expect(container.textContent).toContain('[Pasted Image #2]');
    });

    it('renders cursor before sentinel', () => {
      const buffer: Buffer = { lines: [sentinel1] };
      const cursor: Cursor = { line: 0, column: 0 };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} blockState={blockState} showCursor={true} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
    });

    it('renders cursor after sentinel', () => {
      const buffer: Buffer = { lines: [sentinel1] };
      const cursor: Cursor = { line: 0, column: sentinel1.length };

      const { container } = render(
        <TextRenderer buffer={buffer} cursor={cursor} blockState={blockState} showCursor={true} />
      );

      expect(container.textContent).toContain('[Pasted Image #1]');
    });
  });
});

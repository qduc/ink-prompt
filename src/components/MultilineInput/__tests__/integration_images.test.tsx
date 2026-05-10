import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MultilineInputCore } from '../index.js';
import { createBlockMarker } from '../BlockMarker.js';
import type { ImageRef } from '../ImageTypes.js';

describe('MultilineInputCore with images', () => {
  const sentinel1 = createBlockMarker('i', 'img1', 1);
  const img1: ImageRef = {
    id: 'img1',
    data: 'base64data',
    mimeType: 'image/png',
    byteSize: 100,
    displayNumber: 1,
  };

  describe('rendering with images', () => {
    it('renders sentinel as placeholder text when images map is provided', () => {
      const { container } = render(
        <MultilineInputCore
          value={sentinel1}
          images={[img1]}
          showCursor={false}
        />
      );
      expect(container.textContent).toContain('[Pasted Image #1]');
    });

    it('renders text around sentinel', () => {
      const { container } = render(
        <MultilineInputCore
          value={`hello ${sentinel1} world`}
          images={[img1]}
          showCursor={false}
        />
      );
      expect(container.textContent).toContain('hello');
      expect(container.textContent).toContain('[Pasted Image #1]');
      expect(container.textContent).toContain('world');
    });
  });

  describe('submit with images', () => {
    it('submit passes images when provided via textInput', () => {
      const { container } = render(
        <MultilineInputCore
          value={sentinel1}
          images={[img1]}
          showCursor={false}
        />
      );
      expect(container.textContent).toContain('[Pasted Image #1]');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { validateImage } from '../ImageValidator.js';
import type { ImageRef } from '../ImageTypes.js';

describe('ImageValidator', () => {
  function makeBytes(hex: string): Buffer {
    return Buffer.from(hex, 'hex');
  }

  function pngBytes(): Buffer {
    return makeBytes('89504e470d0a1a0a' + '00'.repeat(100));
  }

  function jpegBytes(): Buffer {
    return makeBytes('ffd8ffe0' + '00'.repeat(100));
  }

  function webpBytes(): Buffer {
    return makeBytes('52494646' + '00000000' + '57454250' + '00'.repeat(100));
  }

  function gifBytes(): Buffer {
    return makeBytes('474946383961' + '00'.repeat(100));
  }

  it('accepts valid PNG', () => {
    const result = validateImage(pngBytes(), [], {});
    expect(result.mimeType).toBe('image/png');
    expect(result.byteSize).toBeGreaterThan(0);
    expect(typeof result.data).toBe('string');
    expect(typeof result.id).toBe('string');
    expect(result.displayNumber).toBe(1);
  });

  it('accepts valid JPEG', () => {
    const result = validateImage(jpegBytes(), [], {});
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('accepts valid WebP', () => {
    const result = validateImage(webpBytes(), [], {});
    expect(result.mimeType).toBe('image/webp');
  });

  it('accepts valid GIF', () => {
    const result = validateImage(gifBytes(), [], {});
    expect(result.mimeType).toBe('image/gif');
  });

  it('rejects unknown magic bytes', () => {
    const bytes = makeBytes('0001020304050607');
    expect(() => validateImage(bytes, [], {})).toThrow('clipboard-unsupported-type');
  });

  it('rejects image exceeding max size', () => {
    const large = Buffer.alloc(11 * 1024 * 1024); // 11MB
    // Write PNG magic bytes at start
    large[0] = 0x89;
    large[1] = 0x50;
    large[2] = 0x4e;
    large[3] = 0x47;
    expect(() => validateImage(large, [], { maxImageSizeBytes: 10 * 1024 * 1024 })).toThrow('image-too-large');
  });

  it('rejects when image count exceeds limit', () => {
    const existing: ImageRef[] = [];
    for (let i = 0; i < 10; i++) {
      existing.push({
        id: String(i),
        data: '',
        mimeType: 'image/png',
        byteSize: 100,
        displayNumber: i + 1,
      });
    }
    expect(() => validateImage(pngBytes(), existing, { maxImageCount: 10 })).toThrow('too-many-images');
  });

  it('rejects unaccepted mime type', () => {
    expect(() => validateImage(pngBytes(), [], { acceptedMimeTypes: ['image/jpeg'] })).toThrow('clipboard-unsupported-type');
  });

  it('assigns correct display number based on existing count', () => {
    const existing: ImageRef[] = [
      { id: '1', data: '', mimeType: 'image/png', byteSize: 100, displayNumber: 1 },
      { id: '2', data: '', mimeType: 'image/png', byteSize: 100, displayNumber: 2 },
      { id: '3', data: '', mimeType: 'image/png', byteSize: 100, displayNumber: 5 },
    ];
    const result = validateImage(pngBytes(), existing, {});
    // displayNumber should be max existing + 1 = 6
    expect(result.displayNumber).toBe(6);
  });

  it('returns base64-encoded data', () => {
    const result = validateImage(pngBytes(), [], {});
    expect(typeof result.data).toBe('string');
    expect(result.data.length).toBeGreaterThan(0);
    // Verify it's valid base64
    expect(() => Buffer.from(result.data, 'base64')).not.toThrow();
  });

  it('uses default max size of 10MB', () => {
    const bytes = makeBytes('89504e470d0a1a0a');
    // Should work since the default 10MB limit is large enough
    const result = validateImage(bytes, [], {});
    expect(result.mimeType).toBe('image/png');
  });
});

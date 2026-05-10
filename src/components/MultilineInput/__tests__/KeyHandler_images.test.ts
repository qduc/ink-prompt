import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKey, KeyHandlerActions } from '../KeyHandler.js';
import type { Buffer, Key } from '../types.js';

describe('KeyHandler with images', () => {
  let actions: KeyHandlerActions;
  let buffer: Buffer;
  let pasteFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pasteFn = vi.fn();
    actions = {
      insert: vi.fn(),
      delete: vi.fn(),
      deleteForward: vi.fn(),
      newLine: vi.fn(),
      deleteAndNewLine: vi.fn(),
      moveCursor: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      setText: vi.fn(),
      submit: vi.fn(),
      paste: pasteFn as () => void,
    };
    buffer = { lines: [''] };
  });

  describe('Ctrl+V handling', () => {
    it('calls actions.paste when Ctrl+V is pressed and paste action exists', () => {
      handleKey({ ctrl: true }, 'v', buffer, actions);
      expect(pasteFn).toHaveBeenCalled();
      expect(actions.insert).not.toHaveBeenCalled();
    });

    it('falls through to text insertion when paste action is not provided', () => {
      const { paste: _, ...actionsWithoutPaste } = actions;
      handleKey({ ctrl: true }, 'v', buffer, actionsWithoutPaste as KeyHandlerActions);
      // Should fall through to normal insertion
    });
  });

  describe('other keys are unaffected', () => {
    it('Ctrl+Z still calls undo', () => {
      handleKey({ ctrl: true }, 'z', buffer, actions);
      expect(actions.undo).toHaveBeenCalled();
      expect(pasteFn).not.toHaveBeenCalled();
    });

    it('regular text insertion still works', () => {
      handleKey({}, 'a', buffer, actions);
      expect(actions.insert).toHaveBeenCalledWith('a');
      expect(pasteFn).not.toHaveBeenCalled();
    });
  });
});

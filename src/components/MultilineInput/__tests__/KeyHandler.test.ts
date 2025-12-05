import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKey, KeyHandlerActions } from '../KeyHandler.js';
import { Buffer, Key } from '../types.js';

describe('KeyHandler', () => {
  let actions: KeyHandlerActions;
  let buffer: Buffer;

  beforeEach(() => {
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
    };
    buffer = { lines: [''] };
  });

  describe('Navigation', () => {
    it('handles ArrowUp', () => {
      handleKey({ upArrow: true }, 'up', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('up');
    });

    it('handles ArrowDown', () => {
      handleKey({ downArrow: true }, 'down', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('down');
    });

    it('handles ArrowLeft', () => {
      handleKey({ leftArrow: true }, 'left', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('left');
    });

    it('handles ArrowRight', () => {
      handleKey({ rightArrow: true }, 'right', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('right');
    });

    it('handles Home key via escape sequence', () => {
      // Home key comes as escape sequence, not key.home
      handleKey({}, '', buffer, actions, undefined, '\x1b[H');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineStart');
    });

    it('handles Home key via alternative escape sequence', () => {
      handleKey({}, '', buffer, actions, undefined, '\x1bOH');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineStart');
    });

    it('handles Ctrl+A as Home alternative', () => {
      handleKey({ ctrl: true }, 'a', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('lineStart');
    });

    it('handles End key via escape sequence', () => {
      // End key comes as escape sequence, not key.end
      handleKey({}, '', buffer, actions, undefined, '\x1b[F');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineEnd');
    });

    it('handles End key via alternative escape sequence', () => {
      handleKey({}, '', buffer, actions, undefined, '\x1bOF');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineEnd');
    });

    it('handles Ctrl+E as End alternative', () => {
      handleKey({ ctrl: true }, 'e', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('lineEnd');
    });
  });

  describe('Boundary Arrow', () => {
    describe('Left boundary', () => {
      it('calls onBoundaryArrow("left") when cursor is at position 0', () => {
        buffer = { lines: ['hello'] };
        const cursor = { line: 0, column: 0 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ leftArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).toHaveBeenCalledWith('left');
        expect(actions.moveCursor).not.toHaveBeenCalled();
      });

      it('does not call onBoundaryArrow when cursor can move left', () => {
        buffer = { lines: ['hello'] };
        const cursor = { line: 0, column: 3 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ leftArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('left');
      });

      it('does not call onBoundaryArrow when at start of line but previous line exists', () => {
        buffer = { lines: ['first', 'second'] };
        const cursor = { line: 1, column: 0 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ leftArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('left');
      });
    });

    describe('Right boundary', () => {
      it('calls onBoundaryArrow("right") when cursor is at end of text', () => {
        buffer = { lines: ['hello'] };
        const cursor = { line: 0, column: 5 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ rightArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).toHaveBeenCalledWith('right');
        expect(actions.moveCursor).not.toHaveBeenCalled();
      });

      it('does not call onBoundaryArrow when cursor can move right', () => {
        buffer = { lines: ['hello'] };
        const cursor = { line: 0, column: 2 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ rightArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('right');
      });

      it('does not call onBoundaryArrow when at end of line but next line exists', () => {
        buffer = { lines: ['first', 'second'] };
        const cursor = { line: 0, column: 5 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ rightArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('right');
      });
    });

    describe('Up boundary', () => {
      it('calls onBoundaryArrow("up") when cursor is on first line', () => {
        buffer = { lines: ['hello'] };
        const cursor = { line: 0, column: 2 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ upArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).toHaveBeenCalledWith('up');
        expect(actions.moveCursor).not.toHaveBeenCalled();
      });

      it('does not call onBoundaryArrow when previous line exists', () => {
        buffer = { lines: ['first', 'second'] };
        const cursor = { line: 1, column: 2 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ upArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('up');
      });

      it('considers visual rows when width is provided - cursor on first visual row', () => {
        // "hello world" with width 5 wraps to:
        // "hello" (visual row 0)
        // " worl" (visual row 1)
        // "d" (visual row 2)
        buffer = { lines: ['hello world'] };
        const cursor = { line: 0, column: 2 }; // On first visual row
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ upArrow: true }, '', buffer, actions, cursor, undefined, 5);

        expect(onBoundaryArrow).toHaveBeenCalledWith('up');
        expect(actions.moveCursor).not.toHaveBeenCalled();
      });

      it('considers visual rows when width is provided - cursor on second visual row', () => {
        // "hello world" with width 5 wraps to visual rows
        buffer = { lines: ['hello world'] };
        const cursor = { line: 0, column: 7 }; // On second visual row (after first wrap)
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ upArrow: true }, '', buffer, actions, cursor, undefined, 5);

        // Can move up within the same buffer line (to previous visual row)
        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('up');
      });
    });

    describe('Down boundary', () => {
      it('calls onBoundaryArrow("down") when cursor is on last line', () => {
        buffer = { lines: ['hello'] };
        const cursor = { line: 0, column: 2 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ downArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).toHaveBeenCalledWith('down');
        expect(actions.moveCursor).not.toHaveBeenCalled();
      });

      it('does not call onBoundaryArrow when next line exists', () => {
        buffer = { lines: ['first', 'second'] };
        const cursor = { line: 0, column: 2 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ downArrow: true }, '', buffer, actions, cursor);

        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('down');
      });

      it('considers visual rows when width is provided - cursor on last visual row', () => {
        // "hello world" with width 5 wraps to visual rows
        buffer = { lines: ['hello world'] };
        const cursor = { line: 0, column: 10 }; // On last visual row (at 'd')
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ downArrow: true }, '', buffer, actions, cursor, undefined, 5);

        expect(onBoundaryArrow).toHaveBeenCalledWith('down');
        expect(actions.moveCursor).not.toHaveBeenCalled();
      });

      it('considers visual rows when width is provided - cursor on first visual row', () => {
        // "hello world" with width 5 wraps to visual rows
        buffer = { lines: ['hello world'] };
        const cursor = { line: 0, column: 2 }; // On first visual row
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ downArrow: true }, '', buffer, actions, cursor, undefined, 5);

        // Can move down within the same buffer line (to next visual row)
        expect(onBoundaryArrow).not.toHaveBeenCalled();
        expect(actions.moveCursor).toHaveBeenCalledWith('down');
      });
    });

    describe('No callback provided', () => {
      it('moves cursor normally when onBoundaryArrow is not set', () => {
        buffer = { lines: ['hello'] };
        const cursor = { line: 0, column: 0 };
        // actions.onBoundaryArrow is not set

        handleKey({ leftArrow: true }, '', buffer, actions, cursor);

        expect(actions.moveCursor).toHaveBeenCalledWith('left');
      });
    });

    describe('Empty buffer', () => {
      it('calls onBoundaryArrow for all directions in empty buffer', () => {
        buffer = { lines: [''] };
        const cursor = { line: 0, column: 0 };
        const onBoundaryArrow = vi.fn();
        actions.onBoundaryArrow = onBoundaryArrow;

        handleKey({ upArrow: true }, '', buffer, actions, cursor);
        expect(onBoundaryArrow).toHaveBeenCalledWith('up');

        onBoundaryArrow.mockClear();
        handleKey({ downArrow: true }, '', buffer, actions, cursor);
        expect(onBoundaryArrow).toHaveBeenCalledWith('down');

        onBoundaryArrow.mockClear();
        handleKey({ leftArrow: true }, '', buffer, actions, cursor);
        expect(onBoundaryArrow).toHaveBeenCalledWith('left');

        onBoundaryArrow.mockClear();
        handleKey({ rightArrow: true }, '', buffer, actions, cursor);
        expect(onBoundaryArrow).toHaveBeenCalledWith('right');
      });
    });
  });

  describe('Editing', () => {
    it('handles Backspace', () => {
      handleKey({ backspace: true }, 'backspace', buffer, actions);
      expect(actions.delete).toHaveBeenCalled();
    });

    it('handles Delete (forward delete)', () => {
      handleKey({ delete: true }, '', buffer, actions);
      expect(actions.deleteForward).toHaveBeenCalled();
    });

    it('treats DEL (0x7f) raw input as backspace even if reported as delete', () => {
      handleKey({ delete: true }, '', buffer, actions, undefined, '');
      expect(actions.delete).toHaveBeenCalled();
      expect(actions.deleteForward).not.toHaveBeenCalled();
    });

    it('handles Ctrl+J (NewLine)', () => {
      handleKey({ ctrl: true }, 'j', buffer, actions);
      expect(actions.newLine).toHaveBeenCalled();
    });

    it('handles regular text insertion', () => {
      handleKey({}, 'a', buffer, actions);
      expect(actions.insert).toHaveBeenCalledWith('a');
    });

    it('ignores control keys without text', () => {
      handleKey({ ctrl: true }, '', buffer, actions);
      expect(actions.insert).not.toHaveBeenCalled();
    });
  });

  describe('History', () => {
    it('handles Ctrl+Z (Undo)', () => {
      handleKey({ ctrl: true }, 'z', buffer, actions);
      expect(actions.undo).toHaveBeenCalled();
    });

    it('handles Ctrl+Y (Redo)', () => {
      handleKey({ ctrl: true }, 'y', buffer, actions);
      expect(actions.redo).toHaveBeenCalled();
    });
  });

  describe('Submission', () => {
    it('handles Enter as submit by default', () => {
      buffer = { lines: ['hello'] };
      handleKey({ return: true }, 'return', buffer, actions);
      expect(actions.submit).toHaveBeenCalled();
      expect(actions.newLine).not.toHaveBeenCalled();
    });

    it('handles Enter as newline if line ends with backslash', () => {
      buffer = { lines: ['hello\\'] };
      const cursor = { line: 0, column: 6 };

      handleKey({ return: true }, 'return', buffer, actions, cursor);

      // It should use the combined deleteAndNewLine action
      expect(actions.deleteAndNewLine).toHaveBeenCalledTimes(1);
      expect(actions.delete).not.toHaveBeenCalled();
      expect(actions.newLine).not.toHaveBeenCalled();
      expect(actions.submit).not.toHaveBeenCalled();
    });

    it('handles Enter as newline if line ends with backslash (multiple lines)', () => {
        const cursor = { line: 1, column: 7 };
        buffer = { lines: ['first', 'second\\'] };

        handleKey({ return: true }, 'return', buffer, actions, cursor);

        expect(actions.deleteAndNewLine).toHaveBeenCalledTimes(1);
        expect(actions.delete).not.toHaveBeenCalled();
        expect(actions.newLine).not.toHaveBeenCalled();
        expect(actions.submit).not.toHaveBeenCalled();
    });
  });
});

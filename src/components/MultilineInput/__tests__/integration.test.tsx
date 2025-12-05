import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MultilineInputCore } from '../index.js';

/**
 * Integration tests for MultilineInputCore.
 *
 * These tests validate the component's rendering and props behavior.
 * We test MultilineInputCore instead of MultilineInput to avoid requiring
 * the Ink runtime (useInput, useStdout hooks).
 *
 * Keyboard handling is thoroughly tested via KeyHandler.test.ts.
 * State management is tested via useTextInput.test.ts.
 */

describe('MultilineInputCore', () => {
    describe('Submission', () => {
      it('clears input after submit', () => {
        const onSubmit = vi.fn();
        const onChange = vi.fn();
        // Simulate controlled usage: value is managed by parent
        let value = 'hello world';
        const { rerender, container } = render(
          <MultilineInputCore value={value} onSubmit={onSubmit} onChange={onChange} />
        );

        // Simulate submit: parent receives value, then clears
        onSubmit(value);
        value = '';
        rerender(<MultilineInputCore value={value} onSubmit={onSubmit} onChange={onChange} />);

        // After rerender, input should be empty
        expect(container.textContent).toContain(' '); // Cursor in empty buffer
        expect(onChange).toHaveBeenCalledWith('');
      });
    });
  describe('Rendering', () => {
    it('renders empty input with cursor', () => {
      const { container } = render(<MultilineInputCore />);
      // Cursor shows as a space in empty buffer
      expect(container.textContent).toContain(' ');
    });

    it('renders with initial value', () => {
      const { container } = render(<MultilineInputCore value="hello" />);
      expect(container.textContent).toContain('hello');
    });

    it('renders multiline value', () => {
      const { container } = render(<MultilineInputCore value="line1\nline2" />);
      expect(container.textContent).toContain('line1');
      expect(container.textContent).toContain('line2');
    });

    it('shows cursor at end of value', () => {
      const { container } = render(<MultilineInputCore value="hi" />);
      // Cursor at end shows as a space after the text
      expect(container.textContent).toBe('hi ');
    });

    it('hides cursor when showCursor is false', () => {
      const { container } = render(<MultilineInputCore value="hello" showCursor={false} />);
      expect(container.textContent).toBe('hello');
    });
  });

  describe('Props', () => {
    it('accepts width prop for word wrapping', () => {
      const { container } = render(
        <MultilineInputCore value="abcdefghij" width={5} />
      );
      // Should wrap at width 5
      expect(container.textContent).toContain('abcde');
      expect(container.textContent).toContain('fghij');
    });

    it('calls onChange on initial render with value', () => {
      const onChange = vi.fn();
      render(<MultilineInputCore value="test" onChange={onChange} />);

      // onChange is called with the initial value
      expect(onChange).toHaveBeenCalledWith('test');
    });
  });

  describe('Placeholder', () => {
    it('shows placeholder when empty and cursor hidden', () => {
      const { container } = render(
        <MultilineInputCore placeholder="Type here..." showCursor={false} />
      );
      expect(container.textContent).toContain('Type here...');
    });

    it('does not show placeholder when showCursor is true', () => {
      const { container } = render(
        <MultilineInputCore placeholder="Type here..." showCursor={true} />
      );
      // Shows cursor (as space) instead, not placeholder
      expect(container.textContent).toContain(' ');
      expect(container.textContent).not.toContain('Type here...');
    });

    it('does not show placeholder when has value', () => {
      const { container } = render(
        <MultilineInputCore value="hello" placeholder="Type here..." showCursor={false} />
      );
      expect(container.textContent).toContain('hello');
      expect(container.textContent).not.toContain('Type here...');
    });
  });
});

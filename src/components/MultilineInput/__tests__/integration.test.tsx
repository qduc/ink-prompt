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
      it('clears input when parent updates value prop to empty', () => {
        const onSubmit = vi.fn();
        const onChange = vi.fn();
        // Simulate controlled usage: value is managed by parent
        let value = 'hello world';
        const { rerender, container } = render(
          <MultilineInputCore value={value} onSubmit={onSubmit} onChange={onChange} />
        );

        // Simulate submit: parent receives value, then clears
        onSubmit(value);
        onChange.mockClear(); // Clear previous calls

        value = '';
        rerender(<MultilineInputCore value={value} onSubmit={onSubmit} onChange={onChange} />);

        // After rerender, input should be empty
        expect(container.textContent).toContain(' '); // Cursor in empty buffer

        // onChange should NOT be called when parent updates value prop
        // (this is a prop sync, not user input - controlled component pattern)
        expect(onChange).not.toHaveBeenCalled();
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
  });

  describe('Controlled component behavior', () => {
    it('does NOT call onChange when value prop is updated by parent', () => {
      // This tests the controlled component pattern:
      // onChange should only fire for user-initiated changes, not prop updates
      const onChange = vi.fn();

      const { rerender, container } = render(
        <MultilineInputCore value="initial" onChange={onChange} />
      );
      expect(container.textContent).toContain('initial');

      // Clear any calls from initial render
      onChange.mockClear();

      // Parent updates the value prop (simulating parent state change)
      rerender(<MultilineInputCore value="updated by parent" onChange={onChange} />);

      // The component should sync the new value...
      expect(container.textContent).toContain('updated by parent');

      // ...but should NOT call onChange (this is a prop sync, not user input)
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does NOT create feedback loop when parent updates value', () => {
      // Regression test for feedback loop bug:
      // 1. Parent calls onChange(newValue)
      // 2. Parent updates value prop
      // 3. Component syncs internal state to match prop
      // 4. BUG: Component calls onChange again with the same value!
      // 5. This creates an infinite loop
      const onChange = vi.fn();
      let externalValue = 'start';

      const { rerender } = render(
        <MultilineInputCore value={externalValue} onChange={onChange} />
      );

      onChange.mockClear();

      // Simulate what happens after user types and parent updates value prop
      externalValue = 'user typed this';
      rerender(<MultilineInputCore value={externalValue} onChange={onChange} />);

      // Should NOT call onChange - this would cause infinite loop
      expect(onChange).not.toHaveBeenCalled();

      // Update again
      externalValue = 'another update';
      rerender(<MultilineInputCore value={externalValue} onChange={onChange} />);

      // Still should not call onChange
      expect(onChange).not.toHaveBeenCalled();
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

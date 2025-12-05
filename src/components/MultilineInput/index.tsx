import React, { useEffect, useCallback, useRef } from 'react';
import { useInput, useStdin, Box, Text } from 'ink';
import { useTerminalWidth } from '../../hooks/useTerminalWidth.js';
import { useTextInput } from './useTextInput.js';
import { handleKey, KeyHandlerActions } from './KeyHandler.js';
import { TextRenderer } from './TextRenderer.js';
import { createBuffer } from './TextBuffer.js';
import { log } from '../../utils/logger.js';

export interface MultilineInputProps {
  /**
   * Controlled text value. When provided, the component becomes controlled
   * and the value is managed externally.
   */
  value?: string;
  /**
   * Called when the text content changes due to user input. Receives the
   * new text value as a parameter.
   */
  onChange?: (value: string) => void;
  /**
   * Called when the user submits the input (typically by pressing Enter
   * without a backslash at the end). Receives the final text value.
   */
  onSubmit?: (value: string) => void;
  /**
   * Placeholder text displayed when the input is empty and the cursor
   * is not shown.
   */
  placeholder?: string;
  /**
   * Whether to display the cursor. Defaults to true.
   */
  showCursor?: boolean;
  /**
   * Terminal width for word wrapping. If not provided, uses the terminal's
   * current width with resize support.
   */
  width?: number;
  /**
   * Whether the input is active and focused, allowing keyboard input.
   * Defaults to true.
   */
  isActive?: boolean;
  /**
   * Called whenever the cursor position changes. Receives the flat
   * character offset as a parameter.
   */
  onCursorChange?: (offset: number) => void;
  /**
   * Optional external cursor position override. When set, forces the
   * cursor to the specified flat character offset.
   */
  cursorOverride?: number;
  /**
   * Called when an arrow key is pressed but cursor is at a boundary.
   * - 'up': cursor is on the first/topmost line
   * - 'down': cursor is on the last/bottommost line
   * - 'left': cursor is at position 0 (start of text)
   * - 'right': cursor is at end of text (after last character)
   */
  onBoundaryArrow?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Props for the core component (without Ink-specific hooks)
 * This allows testing the rendering logic separately.
 */
export interface MultilineInputCoreProps {
  /**
   * Controlled text value. When provided, the component becomes controlled
   * and the text is managed externally.
   */
  value?: string;
  /**
   * Called when the text content changes. Receives the new text value
   * as a parameter.
   */
  onChange?: (value: string) => void;
  /**
   * Called when the user submits the input (typically by pressing Enter
   * without a backslash at the end).
   */
  onSubmit?: (value: string) => void;
  /**
   * Placeholder text displayed when the input is empty and the cursor
   * is not shown.
   */
  placeholder?: string;
  /**
   * Whether to display the cursor. Defaults to true.
   */
  showCursor?: boolean;
  /**
   * Terminal width for word wrapping. If not provided, uses the terminal's
   * current width.
   */
  width?: number;
  /**
   * Called whenever the cursor position changes. Receives the flat
   * character offset as a parameter.
   */
  onCursorChange?: (offset: number) => void;
  /**
   * Optional external cursor position override. When set, forces the
   * cursor to the specified flat character offset.
   */
  cursorOverride?: number;
  /**
   * Called when an arrow key is pressed but cursor is at a boundary.
   * - 'up': cursor is on the first/topmost line
   * - 'down': cursor is on the last/bottommost line
   * - 'left': cursor is at position 0 (start of text)
   * - 'right': cursor is at end of text (after last character)
   */
  onBoundaryArrow?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Core rendering component that can be tested without Ink runtime.
 * Does not include useInput/useStdout hooks.
 */
export const MultilineInputCore: React.FC<MultilineInputCoreProps> = ({
  value,
  onChange,
  placeholder,
  showCursor = true,
  width = 80,
  onCursorChange,
  cursorOverride,
}) => {
  const textInput = useTextInput({ initialValue: value ?? '' });

  // Track whether a value change is from syncing props (not user input)
  const isSyncingFromProps = useRef(false);

  // Handle cursor override
  useEffect(() => {
    if (cursorOverride !== undefined) {
      textInput.setCursorOffset(cursorOverride);
    }
  }, [cursorOverride]);

  // Notify parent of cursor change
  // Use a ref to avoid dependency on onCursorChange callback identity
  const onCursorChangeRef = useRef(onCursorChange);
  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    if (onCursorChangeRef.current) {
      onCursorChangeRef.current(textInput.cursorOffset);
    }
  }, [textInput.cursorOffset]);


  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== textInput.value) {
      isSyncingFromProps.current = true;
      textInput.setText(value);
    }
  }, [value]);

  // Notify parent of changes - but only for user-initiated changes
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (isSyncingFromProps.current) {
      // This change was from syncing props, not user input - don't call onChange
      isSyncingFromProps.current = false;
      return;
    }
    onChangeRef.current?.(textInput.value);
  }, [textInput.value]);

  // Create buffer for TextRenderer
  const buffer = createBuffer(textInput.value);

  // Show placeholder if empty and no cursor shown
  const isEmpty = textInput.value === '';
  const showPlaceholder = isEmpty && placeholder && !showCursor;

  if (showPlaceholder) {
    return <div style={{ opacity: 0.5 }}>{placeholder}</div>;
  }

  return (
    <TextRenderer
      buffer={buffer}
      cursor={textInput.cursor}
      width={width}
      showCursor={showCursor}
    />
  );
};

/**
 * Full MultilineInput with Ink keyboard handling.
 * This component uses Ink-specific hooks and must be rendered in an Ink context.
 */
export const MultilineInput: React.FC<MultilineInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  showCursor = true,
  width,
  isActive = true,
  onCursorChange,
  cursorOverride,
  onBoundaryArrow,
}) => {

  // Get terminal width from Ink (with resize support) if not provided
  const terminalWidth = useTerminalWidth(width);

  // Track raw input for detecting Home/End keys
  const { stdin } = useStdin();
  const lastRawInput = useRef<string>('');

  // Listen for raw stdin data to capture escape sequences
  useEffect(() => {
    if (!stdin || !isActive) return;

    const handleData = (data: Buffer) => {
      lastRawInput.current = data.toString();
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin, isActive]);

  const textInput = useTextInput({ initialValue: value ?? '', width: terminalWidth });

  // Handle cursor override
  useEffect(() => {
    if (cursorOverride !== undefined) {
      textInput.setCursorOffset(cursorOverride);
    }
  }, [cursorOverride]);

  // Notify parent of cursor change
  const onCursorChangeRef = useRef(onCursorChange);
  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    onCursorChangeRef.current?.(textInput.cursorOffset);
  }, [textInput.cursorOffset]);

  // Track whether a value change is from syncing props (not user input)
  const isSyncingFromProps = useRef(false);

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== textInput.value) {
      isSyncingFromProps.current = true;
      textInput.setText(value);
    }
  }, [value]);

  // Notify parent of changes - but only for user-initiated changes
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (isSyncingFromProps.current) {
      // This change was from syncing props, not user input - don't call onChange
      isSyncingFromProps.current = false;
      return;
    }
    onChangeRef.current?.(textInput.value);
  }, [textInput.value]);

  // Create buffer for TextRenderer and KeyHandler
  const buffer = createBuffer(textInput.value);

  // Create submit handler
  const handleSubmit = useCallback(() => {
    onSubmit?.(textInput.value);
    textInput.setText(''); // Clear input after submit
  }, [onSubmit, textInput.value, textInput.setText]);

  // Create actions for KeyHandler
  const actions: KeyHandlerActions = {
    insert: textInput.insert,
    delete: textInput.delete,
    deleteForward: textInput.deleteForward,
    newLine: textInput.newLine,
    deleteAndNewLine: textInput.deleteAndNewLine,
    moveCursor: textInput.moveCursor,
    undo: textInput.undo,
    redo: textInput.redo,
    setText: textInput.setText,
    submit: handleSubmit,
    onBoundaryArrow,
  };

  // Handle keyboard input
  useInput((input: string, key: any) => {
    log(`[USEINPUT] input="${input.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" key=${JSON.stringify(key)} rawLen=${lastRawInput.current?.length || 0}`);
    handleKey(key, input, buffer, actions, textInput.cursor, lastRawInput.current, terminalWidth);
  }, { isActive });

  // Show placeholder if empty and no cursor shown
  const isEmpty = textInput.value === '';
  const showPlaceholder = isEmpty && placeholder && !showCursor;

  if (showPlaceholder) {
    return (
      <Box>
        <Text dimColor>{placeholder}</Text>
      </Box>
    );
  }

  return (
    <TextRenderer
      buffer={buffer}
      cursor={textInput.cursor}
      width={terminalWidth}
      showCursor={showCursor}
    />
  );
};

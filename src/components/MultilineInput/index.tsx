import React, { useEffect, useCallback } from 'react';
import { useTextInput } from './useTextInput';
import { handleKey, KeyHandlerActions } from './KeyHandler';
import { TextRenderer } from './TextRenderer';
import { createBuffer } from './TextBuffer';

export interface MultilineInputProps {
  /** Controlled text value */
  value?: string;
  /** Called when text changes */
  onChange?: (value: string) => void;
  /** Called when user submits (Enter without backslash) */
  onSubmit?: (value: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether to show the cursor (defaults to true) */
  showCursor?: boolean;
  /** Terminal width for word wrapping */
  width?: number;
  /** Whether input is active/focused (defaults to true) */
  isActive?: boolean;
}

/**
 * Props for the core component (without Ink-specific hooks)
 * This allows testing the rendering logic separately.
 */
export interface MultilineInputCoreProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  showCursor?: boolean;
  width?: number;
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
}) => {
  const textInput = useTextInput({ initialValue: value ?? '' });

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== textInput.value) {
      textInput.setText(value);
    }
  }, [value]);

  // Notify parent of changes
  useEffect(() => {
    onChange?.(textInput.value);
  }, [textInput.value, onChange]);

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
}) => {
  // Import Ink hooks dynamically to avoid import-time errors in tests
  const { useInput, useStdout, Box, Text } = require('ink');

  // Get terminal width from Ink if not provided
  const { stdout } = useStdout();
  const terminalWidth = width ?? stdout?.columns ?? 80;

  const textInput = useTextInput({ initialValue: value ?? '' });

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== textInput.value) {
      textInput.setText(value);
    }
  }, [value]);

  // Notify parent of changes
  useEffect(() => {
    onChange?.(textInput.value);
  }, [textInput.value, onChange]);

  // Create buffer for TextRenderer and KeyHandler
  const buffer = createBuffer(textInput.value);

  // Create submit handler
  const handleSubmit = useCallback(() => {
    onSubmit?.(textInput.value);
  }, [onSubmit, textInput.value]);

  // Create actions for KeyHandler
  const actions: KeyHandlerActions = {
    insert: textInput.insert,
    delete: textInput.delete,
    newLine: textInput.newLine,
    moveCursor: textInput.moveCursor,
    undo: textInput.undo,
    redo: textInput.redo,
    setText: textInput.setText,
    submit: handleSubmit,
  };

  // Handle keyboard input
  useInput((input: string, key: any) => {
    handleKey(key, input, buffer, actions, textInput.cursor);
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

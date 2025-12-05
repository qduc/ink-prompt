import React, { useEffect, useCallback, useRef } from 'react';
import { useInput, useStdout, useStdin, Box, Text } from 'ink';
import { useTextInput } from './useTextInput.js';
import { handleKey, KeyHandlerActions } from './KeyHandler.js';
import { TextRenderer } from './TextRenderer.js';
import { createBuffer } from './TextBuffer.js';
import { log } from '../../utils/logger.js';

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

  // Get terminal width from Ink if not provided
  const { stdout } = useStdout();
  const terminalWidth = width ?? stdout?.columns ?? 80;

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
  };

  // Handle keyboard input
  useInput((input: string, key: any) => {
    log(`[USEINPUT] input="${input.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" key=${JSON.stringify(key)} rawLen=${lastRawInput.current?.length || 0}`);
    handleKey(key, input, buffer, actions, textInput.cursor, lastRawInput.current);
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

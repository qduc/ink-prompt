import React, { useState } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { MultilineInput } from '../dist/index.js';

const App = () => {
  const { exit } = useApp();
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [cursorOffset, setCursorOffset] = useState(0);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    if (key.tab) {
      setIsActive((prev) => !prev);
    }
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(Text, null, 'MultilineInput playground'),
      React.createElement(
        Text,
        { dimColor: true },
        'Enter submits. Ctrl+J or trailing \\ before Enter inserts newline. Tab toggles focus. Ctrl+C exits.'
      )
    ),
    React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(
        Text,
        null,
        `Length: ${value.length} | Lines: ${value.split('\n').length} | Cursor: ${cursorOffset}`
      ),
      React.createElement(MultilineInput, {
        value,
        onChange: setValue,
        onSubmit: (nextValue) => {
          setSubmitted(nextValue);
          setValue('');
        },
        onCursorChange: setCursorOffset,
        isActive,
        width: 80,
      })
    ),
    React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(Text, { dimColor: true }, 'Submitted (most recent):'),
      React.createElement(Text, null, submitted || '(none)')
    )
  );
};

render(React.createElement(App));

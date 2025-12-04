import React, { useState, useMemo } from 'react';
import { render, Box, Text } from 'ink';
import { MultilineInput } from '../src';

const formatLines = (value: string) =>
  value === ''
    ? [<Text key="empty" dimColor>{'<empty>'}</Text>]
    : value.split('\n').map((line, index) => (
      <Text key={`${line}-${index}`}>{line === '' ? ' ' : line}</Text>
    ));

const Playground: React.FC = () => {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const currentValueLines = useMemo(() => formatLines(value), [value]);
  const submittedLines = useMemo(
    () => (submitted === null ? null : formatLines(submitted)),
    [submitted]
  );

  return (
    <Box flexDirection="column">
      <Text color="cyan">MultilineInput playground</Text>
      <Text dimColor>
        Type normally, use arrow keys to move. Press Ctrl+J or end a line with '\' before
        Enter to insert a newline. Press Enter to submit.
      </Text>

      <Box marginTop={1}>
        <MultilineInput
          value={value}
          onChange={setValue}
          onSubmit={setSubmitted}
          width={80}
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="green">Current value</Text>
        {currentValueLines}
      </Box>

      {submittedLines && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">Last submission</Text>
          {submittedLines}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to exit.</Text>
      </Box>
    </Box>
  );
};

render(<Playground />);

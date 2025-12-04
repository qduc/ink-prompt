# ink-prompt

A React Ink component library focused on terminal-friendly prompts. The first
export is `MultilineInput`, an Ink component for collecting multi-line text in
CLIs.

## Installation

```bash
npm install ink-prompt
```

## Usage

```tsx
import React from 'react';
import { render, Box, Text } from 'ink';
import { MultilineInput } from 'ink-prompt';

const App = () => {
  return (
    <Box flexDirection="column">
      <Text>Describe your change (press Enter to submit):</Text>
      <MultilineInput
        onSubmit={(value) => console.log(value)}
        width={80}
      />
    </Box>
  );
};

render(<App />);
```

`MultilineInput` supports typical editing controls:

- Arrow keys for navigation
- `Ctrl+J` or typing `\` before Enter to add a newline
- `Ctrl+Z`/`Ctrl+Y` for undo/redo
- Enter submits the current buffer

## Manual testing

A runnable Ink playground lives in `examples/basic.tsx`. Build the library once
and launch the example with:

```bash
npm run example
```

This renders the component in your terminal so you can try the editing and
submission workflow manually. Press `Ctrl+C` to exit when you're done.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Watch for changes
npm run dev

# Type check
npm run type-check
```

## License

MIT

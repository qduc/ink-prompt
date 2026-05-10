# ink-prompt

A React Ink component library for creating interactive CLI prompts. Provides
`MultilineInput` for collecting multi-line text in terminal applications.

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
      />
    </Box>
  );
};

render(<App />);
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | | External control of the text value (controlled mode) |
| `onChange` | `(value: string) => void` | | Called when text content changes |
| `onSubmit` | `(value: string) => void` | | Called when Enter is pressed (without trailing `\`) |
| `placeholder` | `string` | | Placeholder text shown when empty and cursor is hidden |
| `showCursor` | `boolean` | `true` | Whether to display the cursor |
| `width` | `number` | terminal width | Width for word wrapping (auto-resizes with terminal) |
| `isActive` | `boolean` | `true` | Whether the input accepts keyboard events |
| `onCursorChange` | `(offset: number) => void` | | Called when cursor position changes |
| `cursorOverride` | `number` | | Force cursor to a specific offset |
| `onBoundaryArrow` | `(dir) => void` | | Called when arrow key reaches a boundary |
| `undoDebounceMs` | `number` | `200` | Milliseconds of inactivity to commit undo batch (`0` = disable) |
| `pasteThreshold` | `number` | | Max paste length before text is replaced by a placeholder |
| `formatPastePlaceholder` | `(id: number) => string` | | Custom placeholder display format |

### Keyboard Controls

`MultilineInput` supports typical editing controls:

- **Arrow keys** for navigation
- `Ctrl+J` or typing `\` before **Enter** to add a newline
- `Ctrl+Z` / `Ctrl+Y` for undo/redo
- `Ctrl+A` / `Ctrl+E` for jump to line start/end
- **Home** / **End** keys for line start/end
- **Enter** submits the current buffer
- **Delete** for forward delete

### Paste Placeholders

When pasting large amounts of text, you can use `pasteThreshold` to automatically
replace the pasted content with a compact placeholder for cleaner display.

```tsx
<MultilineInput
  onSubmit={(value) => console.log(value)}
  pasteThreshold={200}            // Text >200 chars becomes a placeholder
  formatPastePlaceholder={(id) => `[Pasted block #${id}]`}  // Optional formatter
/>
```

**How it works:**
- Pasted text exceeding `pasteThreshold` is replaced with a placeholder (default: `[Paste text #N]`, customizable via `formatPastePlaceholder`)
- The full original text is preserved — `onChange` / `onSubmit` return the unmodified content
- Placeholders are **atomic**: backspace/delete removes the entire placeholder in one action
- Arrow keys skip over placeholders (cursor cannot land inside one)
- Undo/redo correctly tracks placeholder state
- Counter resets per component instance

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

# Run tests
npm test
npm run test:watch
npm run test:ui
```

## License

MIT

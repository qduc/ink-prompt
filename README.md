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
| `onSubmit` | `(value: string, images?: ImageRef[]) => void` | | Called when Enter is pressed (without trailing `\`) |
| `placeholder` | `string` | | Placeholder text shown when empty and cursor is hidden |
| `showCursor` | `boolean` | `true` | Whether to display the cursor |
| `width` | `number` | terminal width | Width for word wrapping (auto-resizes with terminal) |
| `isActive` | `boolean` | `true` | Whether the input accepts keyboard events |
| `onCursorChange` | `(offset: number) => void` | | Called when cursor position changes |
| `cursorOverride` | `number` | | Force cursor to a specific offset |
| `onBoundaryArrow` | `(direction: 'up' \| 'down' \| 'left' \| 'right') => void` | | Called when arrow key reaches a boundary |
| `undoDebounceMs` | `number` | `200` | Milliseconds of inactivity to commit undo batch (`0` = disable) |
| `pasteThreshold` | `number` | | Max paste length before text is replaced by a placeholder |
| `formatPastePlaceholder` | `(displayNumber: number) => string` | | Custom placeholder display format (1-based) |
| `enableImagePaste` | `boolean` | `false` | Enables image-aware Ctrl+V handling |
| `images` | `ImageRef[]` | | Controlled image state for pasted images |
| `onImagesChange` | `(images: ImageRef[]) => void` | | Called when images change |
| `onPasteError` | `(reason: PasteErrorReason) => void` | | Called when paste fails |
| `maxImageSizeBytes` | `number` | `10485760` | Maximum image size in bytes (default 10 MiB) |
| `maxImageCount` | `number` | `10` | Maximum number of pasted images |
| `acceptedMimeTypes` | `string[]` | | Restricts accepted image MIME types |

### Keyboard Controls

`MultilineInput` supports typical editing controls:

- **Arrow keys** for navigation
- **Shift+Enter**, `Ctrl+J`, or typing `\` before **Enter** to add a newline (Shift+Enter requires a terminal that distinguishes it — most emit `ESC + CR` or the kitty `CSI 13;2u` sequence)
- `Ctrl+Z` / `Ctrl+Y` for undo/redo
- `Ctrl+A` / `Ctrl+E` for jump to line start/end
- **Home** / **End** keys for line start/end
- `Ctrl+V` to paste text or images (when `enableImagePaste` is enabled)
- **Enter** submits the current buffer
- **Delete** for forward delete

### Paste Placeholders

When pasting large amounts of text, you can use `pasteThreshold` to automatically
replace the pasted content with a compact placeholder for cleaner display.

```tsx
<MultilineInput
  onSubmit={(value) => console.log(value)}
  pasteThreshold={200}            // Text >200 chars becomes a placeholder
  formatPastePlaceholder={(n) => `[Pasted block #${n}]`}  // Optional formatter
/>
```

**How it works:**
- Pasted text exceeding `pasteThreshold` is replaced with a placeholder (default: `[Paste text #N]`, customizable via `formatPastePlaceholder`)
- The full original text is preserved — `onChange` / `onSubmit` return the unmodified content
- Placeholders are **atomic**: backspace/delete removes the entire placeholder in one action
- Arrow keys skip over placeholders (cursor cannot land inside one)
- Undo/redo correctly tracks placeholder state
- Counter resets per component instance

## Image Paste

Image paste is opt-in through `enableImagePaste`. When enabled, `Ctrl+V`
reads the system clipboard. Text is inserted as usual; supported images are
inserted into the text buffer as placeholders such as `[Pasted Image #1]` and
returned separately through `onSubmit` or `onImagesChange`.

```tsx
import React, {useState} from 'react';
import {render, Box, Text} from 'ink';
import {MultilineInput, type ImageRef, type PasteErrorReason} from 'ink-prompt';

const App = () => {
  const [images, setImages] = useState<ImageRef[]>([]);

  return (
    <Box flexDirection="column">
      <Text>Prompt:</Text>
      <MultilineInput
        enableImagePaste
        maxImageCount={5}
        maxImageSizeBytes={5 * 1024 * 1024}
        acceptedMimeTypes={['image/png', 'image/jpeg', 'image/webp', 'image/gif']}
        images={images}
        onImagesChange={setImages}
        onPasteError={(reason: PasteErrorReason) => {
          console.error(`Paste failed: ${reason}`);
        }}
        onSubmit={(value, submittedImages) => {
          console.log(value);
          console.log(submittedImages);
        }}
        width={80}
      />
    </Box>
  );
};

render(<App />);
```

Supported image types are detected from image bytes: PNG, JPEG, WebP, and GIF.
Clipboard access is platform-specific:

- macOS: `osascript`
- Linux X11: `xclip`
- Linux Wayland: `wl-paste`
- Windows: PowerShell and `System.Windows.Forms.Clipboard`

Related props:

- `enableImagePaste?: boolean` - enables image-aware `Ctrl+V` handling.
- `images?: ImageRef[]` and `onImagesChange?: (images: ImageRef[]) => void` -
  controlled image state for pasted images.
- `onSubmit?: (value: string, images?: ImageRef[]) => void` - receives the text
  buffer and current images.
- `onPasteError?: (reason: PasteErrorReason) => void` - receives paste and
  validation failures.
- `maxImageSizeBytes?: number` - defaults to 10 MiB.
- `maxImageCount?: number` - defaults to 10.
- `acceptedMimeTypes?: string[]` - restricts accepted image MIME types.

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

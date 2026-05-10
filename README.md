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
- `Ctrl+V` to paste text, or images when image paste is enabled
- Enter submits the current buffer

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
```

## License

MIT

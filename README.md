# ink-prompt

A React Ink component for prompts.

## Installation

```bash
npm install ink-prompt
```

## Usage

```tsx
import React from 'react';
import { render } from 'ink';
import { Prompt } from 'ink-prompt';

const App = () => {
  return (
    <Prompt
      message="What is your name?"
      onSubmit={(answer) => console.log(answer)}
    />
  );
};

render(<App />);
```

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

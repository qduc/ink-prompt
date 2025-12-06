import { useState, useEffect, useRef } from 'react';
import { useStdout } from 'ink';

/**
 * Hook to get the current terminal width and listen for resize events.
 *
 * @param propWidth - Optional explicit width to use instead of terminal width
 * @param debounceMs - Optional debounce delay in milliseconds (default: 100)
 * @returns The effective width (propWidth if provided, otherwise terminal width)
 */
export function useTerminalWidth(propWidth?: number, debounceMs: number = 100): number {
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout?.columns ?? 80);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!stdout) return;

    const onResize = () => {
      // Cancel any pending debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set a new debounce timer
      debounceTimer.current = setTimeout(() => {
        setTerminalWidth(stdout.columns);
        debounceTimer.current = null;
      }, debounceMs);
    };

    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
      // Clean up any pending timer on unmount
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [stdout, debounceMs]);

  return propWidth ?? terminalWidth;
}

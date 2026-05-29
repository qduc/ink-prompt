import { useState, useEffect, useRef } from 'react';
import { useStdout } from 'ink';

/**
 * Hook to get the current terminal height and listen for resize events.
 *
 * @param propHeight - Optional explicit height to use instead of terminal height
 * @param debounceMs - Optional debounce delay in milliseconds (default: 100)
 * @returns The effective height (propHeight if provided, otherwise terminal height)
 */
export function useTerminalHeight(propHeight?: number, debounceMs: number = 100): number {
  const { stdout } = useStdout();
  const [terminalHeight, setTerminalHeight] = useState(stdout?.rows ?? 24);
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
        setTerminalHeight(stdout.rows);
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

  return propHeight ?? terminalHeight;
}

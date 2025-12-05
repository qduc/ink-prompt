import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

/**
 * Hook to get the current terminal width and listen for resize events.
 *
 * @param propWidth - Optional explicit width to use instead of terminal width
 * @returns The effective width (propWidth if provided, otherwise terminal width)
 */
export function useTerminalWidth(propWidth?: number): number {
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout?.columns ?? 80);

  useEffect(() => {
    if (!stdout) return;

    const onResize = () => {
      setTerminalWidth(stdout.columns);
    };

    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return propWidth ?? terminalWidth;
}

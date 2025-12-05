import { appendFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const LOG_FILE = process.env.INK_PROMPT_LOG_FILE || join(process.cwd(), 'ink-prompt.debug.log');

/**
 * Initialize the logger by clearing any existing log file.
 * Call this once at the start of your application.
 */
export function initLogger(): void {
  if (existsSync(LOG_FILE)) {
    unlinkSync(LOG_FILE);
  }
}

/**
 * Log a debug message to the log file.
 * @param message - The message to log
 */
export function log(message: string): void {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\n`);
  } catch (error) {
    // Silently fail to avoid crashing the application
    if (process.env.DEBUG) {
      console.error('Failed to write to log file:', error);
    }
  }
}

export default { log, initLogger };

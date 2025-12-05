import { appendFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const LOG_FILE = process.env.INK_PROMPT_LOG_FILE || join(process.cwd(), 'ink-prompt.debug.log');

// Define log levels with numeric priority
const LOG_LEVELS: Record<string, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Get current log level from env, default to ERROR (or DEBUG if you prefer)
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL?.toUpperCase() || 'ERROR';
const CURRENT_LOG_LEVEL_PRIORITY = LOG_LEVELS[CURRENT_LOG_LEVEL] ?? LOG_LEVELS.INFO;

/**
 * Initialize the logger by clearing any existing log file.
 */
export function initLogger(): void {
  if (existsSync(LOG_FILE)) {
    unlinkSync(LOG_FILE);
  }
}

/**
 * Log a message to the log file if it meets the minimum log level.
 * @param message - The message to log
 * @param level - The severity level of the message (default: INFO)
 */
export function log(message: string, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  // Check if we should log based on level priority
  if ((LOG_LEVELS[level] ?? 1) < CURRENT_LOG_LEVEL_PRIORITY) {
    return;
  }

  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} [${level}] ${message}\n`);
  } catch (error) {
    // Silently fail to avoid crashing the application
    if (process.env.DEBUG) {
      console.error('Failed to write to log file:', error);
    }
  }
}

export default { log, initLogger };

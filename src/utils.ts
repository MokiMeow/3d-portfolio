typescript
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { strict as assert } from 'assert';

// --------------------------------------------------------------------------
// Types & Constants
// --------------------------------------------------------------------------

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** Github fine‑grained PAT length: "github_pat_" (11) + 36 alphanumeric/underscore chars */
const GITHUB_PAT_PREFIX = 'github_pat_';
const GITHUB_PAT_CHARS = '[A-Za-z0-9_]';
const GITHUB_PAT_BODY_LENGTH = 36;
const GITHUB_PAT_REGEX = new RegExp(
  `^${escapeRegex(GITHUB_PAT_PREFIX)}${GITHUB_PAT_CHARS}{${GITHUB_PAT_BODY_LENGTH}}$`
);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ensure a value is a non‑empty string */
function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non‑empty string`);
  }
}

// --------------------------------------------------------------------------
// Custom Errors
// --------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class CommandExecutionError extends Error {
  public readonly command: string;
  public readonly exitCode: number | null;
  public readonly stdout: string;
  public readonly stderr: string;

  constructor(command: string, exitCode: number | null, stdout: string, stderr: string) {
    super(`Command "${command}" failed with exit code ${exitCode ?? 'N/A'}`);
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

// --------------------------------------------------------------------------
// Logger
// --------------------------------------------------------------------------

/**
 * Simple structured logger with timestamp and level.
 * In production, replace with a proper logging library (e.g. winston, pino).
 */
export class Logger {
  private static readonly LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private static currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  /** Set the minimum log level */
  static setLevel(level: LogLevel): void {
    Logger.currentLevel = level;
  }

  /** Format a log entry */
  private static format(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
    return context ? `${base} ${JSON.stringify(context)}` : base;
  }

  static debug(message: string, context?: Record<string, unknown>): void {
    if (Logger.LEVELS['debug'] >= Logger.LEVELS[Logger.currentLevel]) {
      console.debug(Logger.format('debug', message, context));
    }
  }

  static info(message: string, context?: Record<string, unknown>): void {
    if (Logger.LEVELS['info'] >= Logger.LEVELS[Logger.currentLevel]) {
      console.info(Logger.format('info', message, context));
    }
  }

  static warn(message: string, context?: Record<string, unknown>): void {
    if (Logger.LEVELS['warn'] >= Logger.LEVELS[Logger.currentLevel]) {
      console.warn(Logger.format('warn', message, context));
    }
  }

  static error(message: string, context?: Record<string, unknown>): void {
    if (Logger.LEVELS['error'] >= Logger.LEVELS[Logger.currentLevel]) {
      console.error(Logger.format('error', message, context));
    }
  }
}

// --------------------------------------------------------------------------
// Core Functions
// --------------------------------------------------------------------------

/**
 * Validates whether a token string is a real GitHub fine‑grained personal access token.
 *
 * The token must:
 * - Start with "github_pat_"
 * - Have exactly 36 alphanumeric characters or underscores following the prefix
 * - Be a non‑empty string
 *
 * @param token - The token string to validate.
 * @returns `true` if the token matches the exact GitHub PAT format.
 * @throws {ValidationError} if the input is not a non‑empty string.
 *
 * @example
 *
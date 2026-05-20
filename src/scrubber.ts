typescript
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, format, transports, Logger } from 'winston';

// ---------------------------------------------------------------------------
// Logger configuration (single instance)
// ---------------------------------------------------------------------------
const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message}${
        Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
      }`;
    }),
  ),
  transports: [new transports.Console()],
});

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ScrubberOptions {
  /** Absolute path to the git repository to scrub */
  repoPath: string;
  /** List of secret strings to replace (exact literal matches) */
  secretPatterns: string[];
  /** Whether to force-push the rewritten history */
  forcePush: boolean;
  /** Remote name (default: "origin") */
  remoteName?: string;
  /** Branch to force-push (default: "main") */
  branchName?: string;
  /** Maximum time in milliseconds for the whole scrub (default: 600000 = 10 min) */
  timeoutMs?: number;
}

export interface ScrubResult {
  success: boolean;
  message: string;
  filterRepoExitCode: number | null;
  pushExitCode: number | null;
  error?: Error;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_TIMEOUT_MS = 600_000;
const REPLACEMENT_TEXT = '***REMOVED***';
const LINE_PREFIX = 'literal:'; // git-filter-repo exact match prefix
const LINE_SEPARATOR = '==>';

// ---------------------------------------------------------------------------
// Helper: run a child process with a timeout and capture stdout/stderr
// ---------------------------------------------------------------------------

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runProcess(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    stdinData?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve, reject) => {
    const {
      cwd,
      stdinData,
      timeoutMs = 0,
      signal: externalSignal,
    } = options;

    const child: ChildProcess = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      // timeout is NOT a valid spawn option – we implement our own
      signal: externalSignal,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Timeout handling
    let timer: NodeJS.Timeout | undefined;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);
    }

    // Collect data
    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    // Write stdin if provided
    if (stdinData && child.stdin) {
      child.stdin.write(stdinData);
      child.stdin.end();
    }

    // Completion
    child.on('close', (code: number | null) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        const err = new Error(
          `Process timed out after ${timeoutMs} ms\nStderr:\n${stderr}`,
        );
        reject(err);
        return;
      }
      if (code === null) {
        reject(new Error(`Process exited with null code.\nStderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr, exitCode: code });
    });

    child.on('error', (err: Error) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: validate options
// ---------------------------------------------------------------------------

function validateOptions(options: ScrubberOptions): void {
  if (!options.repoPath || typeof options.repoPath !== 'string') {
    throw new TypeError('repoPath must be a non-empty string');
  }
  if (!Array.isArray(options.secretPatterns) || options.secretPatterns.length === 0) {
    throw new TypeError('secretPatterns must be a non-empty array of strings');
  }
  if (options.secretPatterns.some((p) => typeof p !== 'string' || p.length === 0)) {
    throw new TypeError('Each secret pattern must be a non-empty string');
  }
  if (options.forcePush !== undefined && typeof options.forcePush !== 'boolean') {
    throw new TypeError('forcePush must be a boolean');
  }
  if (options.remoteName !== undefined && typeof options.remoteName !== 'string') {
    throw new TypeError('remoteName must be a string');
  }
  if (options.branchName !== undefined && typeof options.branchName !== 'string') {
    throw new TypeError('branchName must be a string');
  }
  if (options.timeoutMs !== undefined && (typeof options.timeoutMs !== 'number' || options.timeoutMs <= 0)) {
    throw new TypeError('timeoutMs must be a positive number');
  }
}

// ---------------------------------------------------------------------------
// Main scrub function
// ---------------------------------------------------------------------------

/**
 * Scrub a git repository by replacing all occurrences of given secret patterns
 * (literal matches) in the entire commit history using `git filter-repo --replace-text`.
 *
 * After rewriting history, optionally force-push the changed branch and clean
 * up backup refs.
 *
 * @param options - Configuration for the scrub operation.
 * @returns A `ScrubResult` indicating success/failure and exit codes.
 */
export async function scrubRepository(options: ScrubberOptions): Promise<ScrubResult> {
  // -----------------------------------------------------------------------
  // 1. Input validation
  // -----------------------------------------------------------------------
  try {
    validateOptions(options);
  } catch (err) {
    logger.error('Validation failed', { error: (err as Error).message });
    return {
      success: false,
      message: (err as Error).message,
      filterRepoExitCode: null,
      pushExitCode: null,
      error: err as Error,
    };
  }

  const {
    repoPath,
    secretPatterns,
    forcePush,
    remoteName = 'origin',
    branchName = 'main',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const result: ScrubResult = {
    success: false,
    message: '',
    filterRepoExitCode: null,
    pushExitCode: null,
  };

  // Track temp file for cleanup
  let replaceTextFilePath: string | null = null;

  // -----------------------------------------------------------------------
  // 2. Verify repository exists
  // -----------------------------------------------------------------------
  try {
    const gitDir = path.join(repoPath, '.git');
    await fs.access(gitDir);
    logger.info('Repository found', { repoPath });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    const msg = error.code === 'ENOENT' ? 'Directory does not exist or is not a git repository' : error.message;
    logger.error('Repository access failed', { error: msg });
    return {
      success: false,
      message: msg,
      filterRepoExitCode: null,
      pushExitCode: null,
      error: error,
    };
  }

  // -----------------------------------------------------------------------
  // 3. Create temporary file with replacement rules
  //    Format: literal:<secret>==>***REMOVED***
  // -----------------------------------------------------------------------
  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scrub-'));
    replaceTextFilePath = path.join(tmpDir, `replace-text-${uuidv4()}`);

    const replacementLines = secretPatterns.map(
      (secret) => `${LINE_PREFIX}${secret}${LINE_SEPARATOR}${REPLACEMENT_TEXT}`,
    );
    await fs.writeFile(replaceTextFilePath, replacementLines.join('\n') + '\n', 'utf-8');
    logger.info('Replacement rules file created', { file: replaceTextFilePath });
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to create temporary replacement file', { error: error.message });
    return {
      success: false,
      message: `Could not create temporary file: ${error.message}`,
      filterRepoExitCode: null,
      pushExitCode: null,
      error,
    };
  }

  // -----------------------------------------------------------------------
  // 4. Run git filter-repo with --replace-text
  // -----------------------------------------------------------------------
  const filterRepoArgs = [
    'filter-repo',
    '--force',
    '--replace-text',
    replaceTextFilePath!, // guaranteed set
  ];

  let abortController: AbortController | undefined;
  if (timeoutMs > 0) {
    abortController = new AbortController();
  }

  try {
    logger.info('Starting git filter-repo', {
      args: filterRepoArgs,
      cwd: repoPath,
      timeoutMs,
    });

    const filterResult = await runProcess('git', filterRepoArgs, {
      cwd: repoPath,
      timeoutMs,
      signal: abortController?.signal,
    });

    result.filterRepoExitCode = filterResult.exitCode;
    if (filterResult.exitCode !== 0) {
      throw new Error(
        `git filter-repo failed with exit code ${filterResult.exitCode}\nStderr:\n${filterResult.stderr}`,
      );
    }
    logger.info('git filter-repo completed successfully');
  } catch (err) {
    // Re-throw if it's a timeout or process error (will be caught by outer catch)
    if (err instanceof Error && err.message.startsWith('Process timed out')) {
      logger.error('git filter-repo timed out', { timeoutMs, error: err.message });
      result.success = false;
      result.message = err.message;
      result.error = err;
      return result;
    }
    // If exit code was captured, assign it even on error
    const error = err as Error;
    logger.error('git filter-repo failed', { error: error.message });
    result.success = false;
    result.message = error.message;
    result.error = error;
    // Exit codes already set if captured
    return result;
  } finally {
    // -----------------------------------------------------------------------
    // 5. Clean up temporary file
    // -----------------------------------------------------------------------
    if (replaceTextFilePath) {
      try {
        await fs.rm(path.dirname(replaceTextFilePath), { recursive: true, force: true });
      } catch (err) {
        logger.warn('Could not delete temporary directory', {
          dir: path.dirname(replaceTextFilePath),
          error: (err as Error).message,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // 6. Force-push (optional)
  // -----------------------------------------------------------------------
  if (forcePush) {
    try {
      logger.info('Force-pushing rewritten history', { remote: remoteName, branch: branchName });

      const pushResult = await runProcess('git', ['push', remoteName, branchName, '--force'], {
        cwd: repoPath,
        timeoutMs,
      });

      result.pushExitCode = pushResult.exitCode;
      if (pushResult.exitCode !== 0) {
        throw new Error(
          `git push --force failed with exit code ${pushResult.exitCode}\nStderr:\n${pushResult.stderr}`,
        );
      }
      logger.info('Force push completed');
    } catch (err) {
      const error = err as Error;
      logger.error('Force push failed', { error: error.message });
      result.success = false;
      result.message = error.message;
      result.error = error;
      return result;
    }
  }

  // -----------------------------------------------------------------------
  // 7. Clean up backup refs left by git filter-repo
  // -----------------------------------------------------------------------
  const backupRefsPath = path.join(repoPath, '.git', 'refs', 'original');
  try {
    await fs.rm(backupRefsPath, { recursive: true, force: true });
    logger.info('Cleaned up backup refs');
  } catch (err) {
    logger.warn('Could not remove backup refs', {
      path: backupRefsPath,
      error: (err as Error).message,
    });
  }

  // -----------------------------------------------------------------------
  // 8. Return success
  // -----------------------------------------------------------------------
  result.success = true;
  result.message = 'Repository scrubbed successfully';
  logger.info('Scrub operation finished successfully');
  return result;
}
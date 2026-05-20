typescript
#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { existsSync } from 'fs';
import { scrubRepository } from './scrubber';
import { updateGitignore } from './gitignore';
import { Logger } from './utils'; // Assume utils exports a Logger that supports setLevel

/**
 * Initialize logger from utils module with default info level.
 * The Logger class must expose methods: debug, info, warn, error, setLevel.
 */
const logger = new Logger();
logger.setLevel('info');

/**
 * Validate that the provided directory path exists and is a Git repository.
 * @param repoPath - Path to the repository
 * @throws {Error} if path does not exist or is not a Git repo
 */
function validateRepoPath(repoPath: string): void {
  const resolvedPath = path.resolve(repoPath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Repository path does not exist: ${resolvedPath}`);
  }
  const gitDir = path.join(resolvedPath, '.git');
  if (!existsSync(gitDir)) {
    throw new Error(`Path is not a Git repository (no .git directory): ${resolvedPath}`);
  }
}

/**
 * Validate that the pattern string is a non-empty string and a valid regex.
 * @param pattern - Regex pattern string
 * @throws {Error} if pattern is invalid
 */
function validatePattern(pattern: string): void {
  if (!pattern || typeof pattern !== 'string') {
    throw new Error('Pattern must be a non-empty string');
  }
  try {
    // Attempt to compile the regex
    new RegExp(pattern);
  } catch (e) {
    throw new Error(`Invalid regex pattern: ${(e as Error).message}`);
  }
}

/**
 * CLI entry point for secret remediation tool.
 * Parses repository path and secret pattern, then orchestrates
 * git history scrubbing and .gitignore updates.
 */
async function main(): Promise<void> {
  const parser = yargs(hideBin(process.argv))
    .usage('Usage: $0 scrub [options]')
    .command(
      'scrub',
      'Remove a secret pattern from git history and update .gitignore',
      (yargs) => {
        return yargs
          .option('repo', {
            alias: 'r',
            type: 'string',
            demandOption: true,
            description: 'Path to the Git repository',
          })
          .option('pattern', {
            alias: 'p',
            type: 'string',
            demandOption: true,
            description: 'Secret pattern to scrub (e.g., github_pat_[a-f0-9]{22})',
          })
          .option('force', {
            alias: 'f',
            type: 'boolean',
            default: false,
            description: 'Skip confirmation prompts',
          })
          .option('verbose', {
            alias: 'v',
            type: 'boolean',
            default: false,
            description: 'Enable verbose logging',
          });
      },
      async (args: {
        repo: string;
        pattern: string;
        force: boolean;
        verbose: boolean;
      }) => {
        // Apply verbose level early
        if (args.verbose) {
          logger.setLevel('debug');
          logger.debug('Verbose mode enabled');
        }

        try {
          // Validate inputs before proceeding
          validateRepoPath(args.repo);
          validatePattern(args.pattern);

          logger.info(`Starting scrub on repository: ${args.repo}`);
          logger.info(`Using pattern: ${args.pattern}`);

          // Perform scrub and update .gitignore
          await scrubRepository(args.repo, args.pattern, args.force);
          await updateGitignore(args.repo);

          logger.info('Secret remediation completed successfully.');
        } catch (error) {
          // Differentiate between known failures and unexpected errors
          if (error instanceof Error) {
            logger.error(`Scrub failed: ${error.message}`);
          } else {
            logger.error(`Scrub failed with non-Error object: ${String(error)}`);
          }
          // Exit with failure code
          process.exitCode = 1;
        }
      }
    )
    .demandCommand(1, 'Please provide a valid command. Use "scrub" to begin.')
    .help()
    .alias('help', 'h')
    .strict();

  // Parse and execute
  await parser.parse();
}

// Global error handler for uncaught exceptions/rejections in async main()
main().catch((error: unknown) => {
  if (error instanceof Error) {
    logger.error(`Unhandled error: ${error.message}`);
  } else {
    logger.error(`Unhandled error: ${String(error)}`);
  }
  process.exitCode = 1;
});
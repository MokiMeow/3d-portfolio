typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

/**
 * Maximum time allowed for git operations and CLI execution.
 */
const TIMEOUT_MS = 60_000;

/**
 * Base directory for temporary test repositories.
 */
const PARENT_TMP_DIR = path.resolve(__dirname, '..', '..', 'tmp-test-repos');

/**
 * Path to the precompiled CLI entrypoint.
 * @note This must be built before running tests (e.g. `npm run build`).
 */
const CLI_ENTRY = path.resolve(__dirname, '..', '..', 'dist', 'index.js');

/**
 * Name of the file that will contain the test secret.
 */
const SECRET_FILENAME = 'process.env';

/**
 * A realistic‑looking GitHub PAT that will be committed and then scrubbed.
 */
const TEST_SECRET = 'github_pat_11ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh';

/**
 * RegExp pattern passed to the CLI scrub command.
 */
const SCRUB_PATTERN = 'github_pat_[a-zA-Z0-9_-]+';

/**
 * Integration test suite for the secret‑scrubber CLI.
 */
describe('Secret scrubber integration', () => {
  /**
   * Absolute path to the current test's temporary git repository.
   */
  let testDir: string;

  /**
   * Whether the previous test was interrupted – used to skip cleanup on setup failure.
   */
  let cleanupNeeded = false;

  // -------------------------------------------------------------------------
  //  Helpers
  // -------------------------------------------------------------------------

  /**
   * Safely initialises a temporary git repository with one committed secret file.
   * @param target - Directory to create the repository in.
   */
  async function initTestRepo(target: string): Promise<void> {
    await fs.mkdir(target, { recursive: true });
    try {
      await execAsync('git init', { cwd: target });
      await execAsync('git config user.email test@example.com', { cwd: target });
      await execAsync('git config user.name "Test"', { cwd: target });

      const secretFile = path.join(target, SECRET_FILENAME);
      await fs.writeFile(secretFile, `GITHUB_TOKEN=${TEST_SECRET}\n`);
      await execAsync(`git add "${SECRET_FILENAME}"`, { cwd: target });
      await execAsync(`git commit -m "add ${SECRET_FILENAME} with secret"`, {
        cwd: target,
      });

      // Ensure no .gitignore exists initially
      const gitignore = path.join(target, '.gitignore');
      if (
        await fs
          .access(gitignore)
          .then(() => true)
          .catch(() => false)
      ) {
        await fs.rm(gitignore);
      }
    } catch (err) {
      // Cleanup on init failure
      await fs.rm(target, { recursive: true, force: true });
      throw new Error(`Failed to initialise test repository: ${(err as Error).message}`);
    }
  }

  /**
   * Runs the CLI scrub command against the current test directory.
   * @returns Combined stdout & stderr from the command.
   */
  async function runScrubCli(): Promise<string> {
    // Ensure CLI binary exists before running
    try {
      await fs.access(CLI_ENTRY);
    } catch {
      throw new Error(
        `CLI entry point not found at "${CLI_ENTRY}". Run the build step first (e.g. npm run build).`
      );
    }

    const cmd = `node "${CLI_ENTRY}" scrub --repo "${testDir}" --pattern "${SCRUB_PATTERN}" --force`;
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10 MB buffer
    });
    return `${stdout}\n${stderr}`;
  }

  // -------------------------------------------------------------------------
  //  Setup / Teardown
  // -------------------------------------------------------------------------

  beforeEach(async () => {
    // Create a unique directory for this test run
    testDir = path.join(PARENT_TMP_DIR, `scrub-test-${randomUUID()}`);
    cleanupNeeded = true;
    await initTestRepo(testDir);
  });

  afterEach(async () => {
    if (cleanupNeeded && testDir) {
      await fs.rm(testDir, { recursive: true, force: true }).catch((err) => {
        console.warn(`[cleanup] Failed to remove test directory: ${(err as Error).message}`);
      });
    }
  });

  // -------------------------------------------------------------------------
  //  Tests
  // -------------------------------------------------------------------------

  /**
   * Verifies that the CLI scrub command:
   * - Removes the secret from all git history.
   * - Updates .gitignore to ignore the secret file.
   * - Does not emit errors.
   */
  it('should remove the secret from git history and update .gitignore', async () => {
    // Act
    const output = await runScrubCli();

    // Assert no error in CLI output
    expect(output).not.toMatch(/error/i);

    // Assert .gitignore now ignores the secret file
    const gitignorePath = path.join(testDir, '.gitignore');
    await expect(fs.access(gitignorePath)).resolves.not.toThrow();
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    expect(gitignoreContent).toContain(SECRET_FILENAME);

    // Assert the secret string is no longer present in the latest commit
    const { stdout: logOut } = await execAsync('git log --oneline', {
      cwd: testDir,
      timeout: TIMEOUT_MS,
    });
    expect(logOut).not.toMatch(/secret/i);

    // Assert the specific PAT token is absent from the entire git history
    const { stdout: grepOut } = await execAsync(
      `git log --all -p | grep "${TEST_SECRET}" || true`,
      { cwd: testDir, timeout: TIMEOUT_MS }
    );
    expect(grepOut).toBe('');
  });

  /**
   * Verifies that the CLI produces a clear error when the binary is missing.
   */
  it('should fail gracefully when CLI binary is missing', async () => {
    // Temporarily rename the binary to simulate missing file
    const backupPath = CLI_ENTRY + '.backup';
    await fs.rename(CLI_ENTRY, backupPath).catch(() => {});
    try {
      await expect(runScrubCli()).rejects.toThrow(/CLI entry point not found/);
    } finally {
      // Restore the binary
      await fs.rename(backupPath, CLI_ENTRY).catch(() => {});
    }
  });

  /**
   * Verifies that the test helper fails fast if git is not installed.
   */
  it('should fail fast if git is not available', async () => {
    const originalPath = process.env.PATH;
    // Temporarily remove git from PATH
    process.env.PATH = '/usr/bin:/bin';
    try {
      await expect(initTestRepo(testDir + '-nogit')).rejects.toThrow();
    } finally {
      process.env.PATH = originalPath;
    }
  });
});
import * as fs from 'fs/promises';
import * as path from 'path';
import { ensureGitignoreProcessEnv } from '../src/gitignore';

describe('ensureGitignoreProcessEnv', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(require('os').tmpdir(), 'gitignore-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates .gitignore with process.env when file does not exist', async () => {
    await ensureGitignoreProcessEnv(tempDir);
    const content = await fs.readFile(path.join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toBe('process.env\n');
  });

  it('appends process.env to existing .gitignore without it', async () => {
    const gitignorePath = path.join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, 'node_modules/\n', 'utf-8');
    await ensureGitignoreProcessEnv(tempDir);
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    expect(lines).toContain('process.env');
    expect(lines[lines.length - 2]).toBe('process.env'); // before trailing newline
  });

  it('does not duplicate process.env if already present', async () => {
    const gitignorePath = path.join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, 'process.env\nnode_modules/\n', 'utf-8');
    await ensureGitignoreProcessEnv(tempDir);
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim() === 'process.env');
    expect(lines).toHaveLength(1);
  });

  it('handles .gitignore without trailing newline', async () => {
    const gitignorePath = path.join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, 'node_modules/', 'utf-8'); // no trailing newline
    await ensureGitignoreProcessEnv(tempDir);
    const content = await fs.readFile(gitignorePath, 'utf-8');
    expect(content).toContain('process.env\n');
  });

  it('log message when process.env already present', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const gitignorePath = path.join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, 'process.env\n', 'utf-8');
    await ensureGitignoreProcessEnv(tempDir);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("'process.env' already present")
    );
    consoleSpy.mockRestore();
  });
});
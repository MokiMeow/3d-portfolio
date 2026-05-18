import { validateGitHubPat, executeCommand, CommandResult, log } from '../src/utils';
import { exec } from 'child_process';
import { promisify } from 'util';

jest.mock('child_process');
const mockedExec = exec as jest.MockedFunction<typeof exec>;

describe('validateGitHubPat', () => {
  it('should return true for a valid GitHub PAT format', () => {
    expect(validateGitHubPat('github_pat_abc123DEF456_xyz')).toBe(true);
  });

  it('should return false for an invalid token (no prefix)', () => {
    expect(validateGitHubPat('pat_abc123')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(validateGitHubPat('')).toBe(false);
  });

  it('should return false for a token with less than 10 characters after prefix', () => {
    expect(validateGitHubPat('github_pat_abc')).toBe(false);
  });

  it('should return true for a token with underscores and hyphens', () => {
    expect(validateGitHubPat('github_pat_aBcDeFgHiJkLmNoPqRsTuVwXyZ-123')).toBe(true);
  });
});

describe('executeCommand', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return stdout and stderr on success', async () => {
    const mockStdout = 'output';
    const mockStderr = '';
    (mockedExec as unknown as jest.Mock).mockImplementation((cmd, callback: any) => {
      callback(null, { stdout: mockStdout, stderr: mockStderr });
    });
    const result = await executeCommand('echo hello');
    expect(result.stdout).toBe(mockStdout);
    expect(result.stderr).toBe(mockStderr);
  });

  it('should throw an error if command fails', async () => {
    const mockError = new Error('Command failed');
    (mockError as any).stderr = 'error details';
    (mockedExec as unknown as jest.Mock).mockImplementation((cmd, callback: any) => {
      callback(mockError, { stdout: '', stderr: 'error details' });
    });
    await expect(executeCommand('false')).rejects.toThrow('Command failed: false\nerror details');
  });
});

describe('log', () => {
  it('should log info message to console.log', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    log('info', 'test message');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log error message to console.error', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    log('error', 'test error');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
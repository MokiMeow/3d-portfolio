import { scrubRepository, ScrubberOptions, ScrubResult } from '../src/scrubber';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';

jest.mock('child_process');
jest.mock('fs/promises');

const mockedSpawn = jest.mocked(spawn);
const mockedFsAccess = jest.mocked(fs.access);
const mockedFsWriteFile = jest.mocked(fs.writeFile);
const mockedFsReadFile = jest.mocked(fs.readFile);

function createMockProcess(stdin?: NodeJS.WritableStream, stderr?: NodeJS.ReadableStream, onEvent?: jest.Mock): ChildProcess {
  const process = {
    stdin: stdin || { write: jest.fn(), end: jest.fn() } as any,
    stderr: stderr || { on: jest.fn() } as any,
    on: onEvent || jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    exitCode: null,
    killed: false,
    pid: 1234,
    connected: true,
  } as unknown as ChildProcess;
  return process;
}

describe('scrubRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should scrub repository with forcePush=false and filter-repo succeeds', async () => {
    // Arrange
    const options: ScrubberOptions = {
      repoPath: '/some/repo',
      secretPatterns: ['github_pat_[a-f0-9]{22}'],
      forcePush: false,
      branchName: 'main',
      remoteName: 'origin',
    };
    const mockStdin = { write: jest.fn(), end: jest.fn() };
    const mockStderr = { on: jest.fn() };
    const mockOn = jest.fn();
    const mockProcess = createMockProcess(mockStdin as any, mockStderr as any, mockOn);
    // when filter-repo closes with code 0
    mockOn.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        callback(0);
      }
    });
    mockedSpawn.mockReturnValue(mockProcess);
    mockedFsAccess.mockResolvedValue(undefined);

    // Act
    const result: ScrubResult = await scrubRepository(options);

    // Assert
    expect(mockedFsAccess).toHaveBeenCalledWith('/some/repo/.git');
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    expect(mockedSpawn).toHaveBeenCalledWith('git', expect.arrayContaining(['filter-repo', '--force', '--replace-text', '< /dev/stdin', '--path-match', 'github_pat_[a-f0-9]{22}']), expect.objectContaining({ cwd: '/some/repo' }));
    expect(mockStdin.write).toHaveBeenCalledWith('github_pat_[a-f0-9]{22}\n');
    expect(mockStdin.end).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.filterRepoExitCode).toBe(0);
    expect(result.pushExitCode).toBeNull();
  });

  it('should scrub repository and force push when forcePush=true', async () => {
    const options: ScrubberOptions = {
      repoPath: '/another/repo',
      secretPatterns: ['secret'],
      forcePush: true,
      branchName: 'feature',
      remoteName: 'upstream',
    };
    const mockStdin1 = { write: jest.fn(), end: jest.fn() };
    const mockStderr1 = { on: jest.fn() };
    const mockOn1 = jest.fn();
    const mockProcess1 = createMockProcess(mockStdin1 as any, mockStderr1 as any, mockOn1);
    mockOn1.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') callback(0);
    });

    const mockProcess2 = createMockProcess(); // push process, no need to hook events
    const mockOn2 = jest.fn();
    mockOn2.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') callback(0);
    });
    mockProcess2.on = mockOn2;

    mockedSpawn.mockReturnValueOnce(mockProcess1).mockReturnValueOnce(mockProcess2);
    mockedFsAccess.mockResolvedValue(undefined);

    const result = await scrubRepository(options);

    expect(mockedSpawn).toHaveBeenCalledTimes(2);
    expect(mockedSpawn).toHaveBeenNthCalledWith(1, 'git', expect.any(Array), expect.any(Object));
    expect(mockedSpawn).toHaveBeenNthCalledWith(2, 'git', ['push', 'upstream', 'feature', '--force'], expect.objectContaining({ cwd: '/another/repo', stdio: 'inherit' }));
    expect(result.success).toBe(true);
    expect(result.filterRepoExitCode).toBe(0);
    expect(result.pushExitCode).toBe(0);
  });

  it('should reject when filter-repo fails', async () => {
    const options: ScrubberOptions = {
      repoPath: '/fail/repo',
      secretPatterns: ['pattern'],
      forcePush: false,
    };
    const mockStdin = { write: jest.fn(), end: jest.fn() };
    const mockStderr = { on: jest.fn() };
    const mockOn = jest.fn();
    const mockProcess = createMockProcess(mockStdin as any, mockStderr as any, mockOn);
    mockOn.mockImplementation((event: string, callback: Function) => {
      if (event === 'close') {
        // simulate non-zero exit (failure)
        setImmediate(() => {
          mockProcess.exitCode = 1;
          callback(1);
        });
      }
    });
    // Make the 'error' event on stderr emit something to simulate error output
    const stderrDataHandler = jest.fn();
    mockStderr.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'data') {
        handler(Buffer.from('some error'));
      }
    });
    mockedSpawn.mockReturnValue(mockProcess);
    mockedFsAccess.mockResolvedValue(undefined);

    // The function should reject due to non-zero exit
    await expect(scrubRepository(options)).rejects.toThrow(/git filter-repo failed with exit code 1/);
    expect(mockStdin.write).toHaveBeenCalled();
  });

  it('should throw if .git directory does not exist', async () => {
    const options: ScrubberOptions = {
      repoPath: '/nonexistent',
      secretPatterns: ['test'],
      forcePush: false,
    };
    const fsError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockedFsAccess.mockRejectedValue(fsError);

    await expect(scrubRepository(options)).rejects.toThrow();
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('should pass secret patterns accurately via stdin', async () => {
    const options: ScrubberOptions = {
      repoPath: '/test/repo',
      secretPatterns: ['pat1', 'pat2', 'pat3'],
      forcePush: false,
    };
    const mockStdin = { write: jest.fn(), end: jest.fn() };
    const mockProcess = createMockProcess(mockStdin as any, { on: jest.fn() } as any, jest.fn((event, cb) => { if (event === 'close') cb(0); }));
    mockedSpawn.mockReturnValue(mockProcess);
    mockedFsAccess.mockResolvedValue(undefined);

    await scrubRepository(options);

    expect(mockStdin.write).toHaveBeenCalledWith('pat1\npat2\npat3\n');
  });
});
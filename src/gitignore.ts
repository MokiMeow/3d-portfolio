import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Reads or creates a .gitignore file in the specified directory, ensures that
 * 'process.env' is added as an ignored entry, and writes the file back.
 *
 * @param targetDir - The directory containing the .gitignore file (defaults to process.cwd()).
 * @returns A promise that resolves when the file has been updated.
 * @throws If reading or writing fails.
 */
export async function ensureGitignoreProcessEnv(targetDir?: string): Promise<void> {
  const dir = targetDir ?? process.cwd();
  const gitignorePath = path.join(dir, '.gitignore');

  let content: string;
  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      // File does not exist - create it with just the entry
      await fs.writeFile(gitignorePath, 'process.env\n', 'utf-8');
      console.info(`Created .gitignore with 'process.env' entry in ${dir}`);
      return;
    }
    throw err;
  }

  // Split into lines and trim whitespace for comparison.
  const lines = content.split(/\r?\n/);
  const hasProcessEnv = lines.some((line) => line.trim() === 'process.env');

  if (!hasProcessEnv) {
    // Append a newline (if file doesn't end with one) and the ignore pattern
    const normalizedContent = content.endsWith('\n') ? content : content + '\n';
    const updatedContent = normalizedContent + 'process.env\n';
    await fs.writeFile(gitignorePath, updatedContent, 'utf-8');
    console.info(`Added 'process.env' to .gitignore in ${dir}`);
  } else {
    console.info(`'process.env' already present in .gitignore in ${dir}`);
  }
}

/**
 * Type guard to check if an error is a Node.js system error with a code property.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';
}
export type MacApp = 'finder' | 'terminal' | 'editor' | 'notes' | 'settings';
export type DisplayMode = 'Standard' | 'Wide' | 'Ultrawide';

export const MAC_APPS: { id: MacApp; name: string; icon: string; color: string }[] = [
  { id: 'finder', name: 'Finder', icon: '◒', color: '#348fe7' },
  { id: 'terminal', name: 'Terminal', icon: '>_', color: '#24312d' },
  { id: 'editor', name: 'Code', icon: '〈〉', color: '#5267c6' },
  { id: 'notes', name: 'Scratchpad', icon: '▤', color: '#bd9437' },
  { id: 'settings', name: 'Displays', icon: '⚙', color: '#727784' },
];

// Finder and Terminal share an invented filesystem. Nothing reaches the visitor's Mac.
export const HOME = '/Users/mohith';
export const FILES: Record<string, string> = {
  [HOME + '/Desktop/read-me.txt']: 'Welcome to the virtual Mac.\nEverything here stays inside this window.\nTry Terminal: help, fortune, or cat Documents/chai.txt.',
  [HOME + '/Documents/chai.txt']: 'Remember to drink the chai before it becomes iced chai.\nThis is a dependency, not a preference.',
  [HOME + '/Documents/meeting-notes.md']: '# Meeting notes\nThis could have been a commit message.\nAction item: fewer action items.',
  [HOME + '/Projects/fix-it-later/fix-it-later.ts']:
    "// A very sustainable strategy.\nconst chai = 'essential';\n\n"
    + "async function fixItLater() {\n  await takeABreak(chai);\n  return { bugs: 'tomorrow' };\n}\n\n"
    + "// tomorrow is a moving target\nfixItLater();",
  [HOME + '/Projects/fix-it-later/life.spec.ts']:
    "describe('life', () => {\n  it('should finish before chai gets cold', () => {\n"
    + "    expect(chai.temperature).toBe('warm');\n  });\n});\n\n// Tests: 1 passed. Morale: cautiously green.",
  [HOME + '/Projects/fix-it-later/package.json']: '{\n  "name": "fix-it-later",\n  "scripts": { "dev": "take-a-break" },\n  "dependencies": { "chai": "essential" }\n}',
  [HOME + '/Downloads/why-is-this-happening.txt']: 'Have you tried turning it off and having chai?\nAbout several million opinions. None quite yours.',
};
/** 3D models in ~/Models. Drag one out of the window and it lands in your space. */
export const MODEL_FILES: Record<string, { id: 'walle' | 'headset' | 'turntable' | 'controller' | 'ps5' | 'watch'; name: string }> = {
  [HOME + '/Models/WALL·E.usdz']: { id: 'walle', name: 'WALL·E' },
  [HOME + '/Models/Vision Pro.usdz']: { id: 'headset', name: 'Vision Pro' },
  [HOME + '/Models/Turntable.usdz']: { id: 'turntable', name: 'Record Turntable' },
  [HOME + '/Models/DualSense.usdz']: { id: 'controller', name: 'DualSense' },
  [HOME + '/Models/PlayStation 5.usdz']: { id: 'ps5', name: 'PlayStation 5' },
  [HOME + '/Models/Apple Watch Ultra.usdz']: { id: 'watch', name: 'Apple Watch Ultra' },
};
for (const [path, model] of Object.entries(MODEL_FILES)) FILES[path] = `${model.name}
3D model (USDZ)

Drag it out of the window, or double-click it, to bring it into your space.`;
const DIRECTORIES = [HOME, ...['Desktop', 'Documents', 'Downloads', 'Projects', 'Projects/fix-it-later', 'Models'].map(name => HOME + '/' + name)];

export function resolvePath(input: string, cwd = HOME): string {
  const path = input.startsWith('~') ? HOME + input.slice(1) : input.startsWith('/') ? input : cwd + '/' + input;
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return '/' + parts.join('/');
}
export function isDirectory(path: string): boolean { return DIRECTORIES.includes(path); }
export function listDirectory(path: string): { name: string; path: string; folder: boolean }[] {
  const prefix = path + '/';
  return [...DIRECTORIES, ...Object.keys(FILES)]
    .filter(item => item.startsWith(prefix) && !item.slice(prefix.length).includes('/'))
    .map(item => ({ name: item.slice(prefix.length), path: item, folder: isDirectory(item) }));
}

export function runCommand(command: string, cwd: string, seconds: number): { text: string; cwd?: string; clear?: boolean; exit?: boolean } {
  const tokens = command.match(/"[^"]*"|'[^']*'|\S+/g)?.map(token => token.replace(/^['"]|['"]$/g, '')) ?? [];
  const [name, ...args] = tokens;
  const argument = args.join(' ');
  switch (name) {
    case undefined: return { text: '' };
    case 'help': return { text: 'Simulated chai-shell. No commands reach your computer.\n'
      + 'ls [path]  cd [path]  cat <file>  pwd  whoami  date\n'
      + 'echo <text>  clear  git status  npm run dev  uptime\n'
      + 'fortune  sudo <command>  help  exit\nUse ↑ and ↓ for command history.' };
    case 'ls': {
      const path = resolvePath(argument || '.', cwd);
      return { text: isDirectory(path) ? listDirectory(path).map(item => item.name + (item.folder ? '/' : '')).join('  ') : 'ls: no such directory: ' + argument };
    }
    case 'cd': {
      const path = resolvePath(argument || '~', cwd);
      return isDirectory(path) ? { text: '', cwd: path } : { text: 'cd: no such directory: ' + argument };
    }
    case 'cat': return { text: FILES[resolvePath(argument, cwd)] ?? 'cat: no such file: ' + (argument || '(file required)') };
    case 'pwd': return { text: cwd };
    case 'whoami': return { text: 'mohith (virtual user)' };
    case 'date': return { text: new Date().toLocaleString() };
    case 'echo': return { text: argument };
    case 'clear': return { text: '', clear: true };
    case 'git': return { text: argument === 'status'
      ? 'On branch main\nChanges not staged for commit:\n  modified: fix-it-later.ts\nNothing committed. Much contemplated.'
      : 'Only git status is simulated. Your repository is untouched.' };
    case 'npm': return { text: argument === 'run dev'
      ? '> fix-it-later dev\n  Local: http://localhost:chai\n  Ready in one sensible break.\nSimulated server. No process was started.'
      : 'Try npm run dev. No packages will be installed.' };
    case 'uptime': return { text: Math.floor(seconds / 60) + ' minutes, ' + seconds % 60 + ' seconds connected. Load average: one thought at a time.' };
    case 'fortune': return { text: ['The bug disappears when someone watches. It is shy.', 'Your future self would appreciate a comment.',
      'A clean build is a small, quiet victory.', 'Drink water. The compiler can wait.'][Math.floor(Math.random() * 4)] ?? 'Take a break.' };
    case 'sudo': return { text: 'Permission denied. Amma is the administrator. Did you eat?' };
    case 'exit': return { text: 'Session closed. Chai remains open.', exit: true };
    default: return { text: 'chai-shell: command not found: ' + name + '. Try help.' };
  }
}

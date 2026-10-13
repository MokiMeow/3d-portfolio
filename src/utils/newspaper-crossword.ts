export type CrosswordDirection = 'across' | 'down';
export type CrosswordEntry = { id: string; number: number; direction: CrosswordDirection; answer: string; clue: string; cells: number[] };

// Every run has a clue; every answer crosses another. No downloads or game loop.
export const CROSSWORD_ROWS = [
  'ORBIT####',
  '####E#R##',
  '###MASALA',
  'CODE##I#P',
  '###M##NAP',
  'BYTE#L#U#',
  'U####O#T#',
  'G###ROBOT',
  '#####P###',
] as const;
export const CROSSWORD_SIZE = CROSSWORD_ROWS[0].length;
export const CROSSWORD_SOLUTION = CROSSWORD_ROWS.join('').split('');
const clues: Record<string, string> = {
  ORBIT: 'A planet’s usual round, with no traffic signals',
  TEA: 'A three-letter excuse to take a break',
  RAIN: 'Bengaluru’s occasional surprise shower',
  MASALA: 'The spice mix doing the heavy lifting',
  MEME: 'A joke that travels faster than your auto',
  APP: 'A little programme on your phone',
  CODE: 'What a programmer writes (besides excuses)',
  NAP: 'A meeting with your pillow',
  AUTO: 'Three wheels, one meter, many negotiations',
  BYTE: 'Eight bits, or a computer’s tiny mouthful',
  BUG: 'An insect — or an uninvited software feature',
  LOOP: 'What repeats, repeats, repeats…',
  ROBOT: 'WALL-E is a particularly lovable one',
};
export const CROSSWORD_ENTRIES: CrosswordEntry[] = [];
let number = 0;
for (let row = 0; row < CROSSWORD_SIZE; row++) {
  for (let col = 0; col < CROSSWORD_SIZE; col++) {
    const index = row * CROSSWORD_SIZE + col;
    if (CROSSWORD_SOLUTION[index] === '#') continue;
    const across = (col === 0 || CROSSWORD_ROWS[row][col - 1] === '#') && col + 1 < CROSSWORD_SIZE && CROSSWORD_ROWS[row][col + 1] !== '#';
    const down = (row === 0 || CROSSWORD_ROWS[row - 1][col] === '#') && row + 1 < CROSSWORD_SIZE && CROSSWORD_ROWS[row + 1][col] !== '#';
    if (!across && !down) continue;
    number++;
    for (const direction of ['across', 'down'] as const) {
      if (!(direction === 'across' ? across : down)) continue;
      const cells: number[] = [];
      let r = row, c = col;
      while (r < CROSSWORD_SIZE && c < CROSSWORD_SIZE && CROSSWORD_ROWS[r][c] !== '#') {
        cells.push(r * CROSSWORD_SIZE + c);
        if (direction === 'across') c++; else r++;
      }
      const answer = cells.map(i => CROSSWORD_SOLUTION[i]).join('');
      CROSSWORD_ENTRIES.push({ id: `${number}-${direction}`, number, direction, answer, clue: clues[answer], cells });
    }
  }
}
export function restoreCrossword(value: unknown): string[] {
  return CROSSWORD_SOLUTION.map((solution, index) => {
    const candidate = Array.isArray(value) ? value[index] : '';
    return solution !== '#' && typeof candidate === 'string' && /^[a-z]$/i.test(candidate) ? candidate.toUpperCase() : '';
  });
}
export function scoreCrossword(letters: readonly string[]) {
  let correct = 0, wrong = 0, empty = 0;
  CROSSWORD_SOLUTION.forEach((solution, i) => {
    if (solution === '#') return;
    if (!letters[i]) empty++;
    else if (letters[i] === solution) correct++;
    else wrong++;
  });
  return { correct, wrong, empty, solved: wrong === 0 && empty === 0 };
}
/** Arrow navigation skips blocks but never wraps into another row or column. */
export function crosswordNeighbour(index: number, key: string): number {
  const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  const move = moves[key];
  if (!move) return index;
  let row = Math.floor(index / CROSSWORD_SIZE), col = index % CROSSWORD_SIZE;
  while (true) {
    row += move[0]; col += move[1];
    if (row < 0 || col < 0 || row >= CROSSWORD_SIZE || col >= CROSSWORD_SIZE) return index;
    const next = row * CROSSWORD_SIZE + col;
    if (CROSSWORD_SOLUTION[next] !== '#') return next;
  }
}

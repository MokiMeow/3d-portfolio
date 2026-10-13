const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/utils/newspaper-crossword.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exported });
const { CROSSWORD_ENTRIES: entries, CROSSWORD_ROWS: rows, CROSSWORD_SOLUTION: solution,
  restoreCrossword, scoreCrossword, crosswordNeighbour } = exported;

test('every printed answer is clued, crosses another, and belongs to one connected puzzle', () => {
  assert.equal(entries.length, 13);
  assert.ok(rows.every(row => row.length === 9));
  const covered = new Set();
  for (const entry of entries) {
    assert.ok(entry.clue && entry.clue.length > 10, `Missing clue: ${entry.answer}`);
    assert.equal(entry.cells.map(i => solution[i]).join(''), entry.answer);
    assert.ok(entry.cells.some(i => entries.some(other => other.id !== entry.id && other.cells.includes(i))), `Isolated answer: ${entry.answer}`);
    entry.cells.forEach(i => covered.add(i));
  }
  assert.equal(covered.size, solution.filter(letter => letter !== '#').length);
  const connected = new Set([entries[0].id]);
  for (let pass = 0; pass < entries.length; pass++) {
    for (const entry of entries) {
      if (entries.some(other => connected.has(other.id) && other.cells.some(i => entry.cells.includes(i)))) connected.add(entry.id);
    }
  }
  assert.equal(connected.size, entries.length);
  // Independently scan every horizontal and vertical run to catch accidental unclued words.
  for (const direction of ['across', 'down']) {
    for (let line = 0; line < 9; line++) {
      const indices = Array.from({ length: 9 }, (_, i) => direction === 'across' ? line * 9 + i : i * 9 + line);
      let run = [];
      for (const i of [...indices, -1]) {
        if (i >= 0 && solution[i] !== '#') run.push(i);
        else {
          if (run.length > 1) assert.ok(entries.some(e => e.direction === direction && String(e.cells) === String(run)), `Unclued run: ${run}`);
          run = [];
        }
      }
    }
  }
});

test('saved progress accepts letters only and never writes into black squares', () => {
  const data = ['o', 'R', '<script>', 3, 't', 'A'];
  const restored = restoreCrossword(data);
  assert.equal(restored.length, 81);
  assert.equal(restored[0], 'O');
  assert.equal(restored[1], 'R');
  assert.equal(restored[2], '');
  assert.equal(restored[3], '');
  assert.equal(restored[4], 'T');
  assert.equal(restored[5], '');
  for (const corrupt of [null, {}, 'ORBIT', 7]) assert.ok(restoreCrossword(corrupt).every(letter => letter === ''));
});

test('checking distinguishes wrong letters from unfinished and completed grids', () => {
  const blank = restoreCrossword(null);
  assert.equal(scoreCrossword(blank).solved, false);
  blank[0] = 'X';
  assert.equal(scoreCrossword(blank).wrong, 1);
  blank[0] = 'O';
  assert.equal(scoreCrossword(blank).correct, 1);
  const filled = restoreCrossword(solution);
  assert.equal(scoreCrossword(filled).solved, true);
  filled[0] = '';
  assert.equal(scoreCrossword(filled).empty, 1);
  assert.equal(scoreCrossword(filled).solved, false);
});

test('arrows skip black cells without wrapping or leaving the grid', () => {
  assert.equal(crosswordNeighbour(0, 'ArrowLeft'), 0);
  assert.equal(crosswordNeighbour(0, 'ArrowUp'), 0);
  assert.equal(crosswordNeighbour(4, 'ArrowRight'), 4);
  assert.equal(crosswordNeighbour(13, 'ArrowRight'), 15);
  assert.equal(crosswordNeighbour(0, 'ArrowDown'), 27);
  assert.equal(crosswordNeighbour(77, 'ArrowDown'), 77);
  assert.equal(crosswordNeighbour(4, 'Enter'), 4);
});

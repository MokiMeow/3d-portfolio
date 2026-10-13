const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/experiences/home/sound.ts');
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exported = {};
vm.runInNewContext(source, {
  exports: exported,
  require: (name) => name.includes('blueprint') ? { ExperienceBasedBlueprint: class {} } : {},
});
function sound(source, actualPlayback, uiPlayback) {
  const subject = Object.create(exported.Sound.prototype);
  subject._muted = false;
  subject._music = { value: { source, playing: uiPlayback } };
  subject.listener = { context: { state: 'running' } };
  subject._lofi_audio = { isPlaying: actualPlayback, pause() { this.isPlaying = false; } };
  return subject;
}
test('initial room music drives the platter even before the UI flag catches up', () => {
  const room = sound('room', true, false);
  assert.equal(room.musicPlaying, true);
  room._lofi_audio.isPlaying = false;
  room._music.value.playing = true;
  assert.equal(room.musicPlaying, false);
});
test('external music follows provider playback and pause, independently of room audio', () => {
  const external = sound('external', false, true);
  assert.equal(external.musicPlaying, true);
  external.pauseMusic();
  assert.equal(external.musicPlaying, false);
  external._music.value.playing = true;
  assert.equal(external.musicPlaying, true);
  external._muted = true;
  assert.equal(external.musicPlaying, false);
});
test('a suspended audio context or paused room track cannot keep the record running', () => {
  const room = sound('room', true, true);
  room.listener.context.state = 'suspended';
  assert.equal(room.musicPlaying, false);
  room.listener.context.state = 'running';
  room._shouldPlayLofi = true;
  room.pauseMusic();
  assert.equal(room.musicPlaying, false);
  assert.equal(room._shouldPlayLofi, false);
});

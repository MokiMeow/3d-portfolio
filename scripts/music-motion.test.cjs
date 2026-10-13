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
  require: (name) => name.includes('blueprint') ? { ExperienceBasedBlueprint: class {} } : { events: { CHANGED: 'changed' } },
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

test('entry playback and both transports reach the deck before a room is selected', () => {
  function load(relative) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, relative), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, require: () => ({
      ExperienceBasedBlueprint: class {}, SceneComponentBlueprint: class {},
    }) });
    return exports;
  }
  const { World } = load('../src/experiences/home/world/index.ts');
  const { Scene1Component } = load('../src/experiences/home/world/scene-1.component.ts');
  const room = Object.create(Scene1Component.prototype);
  const playback = sound('room', true, false);
  const frames = [];
  const anchor = {};
  playback._lofi_audio.parent = anchor;
  room._experience = { sound: playback };
  room._ready = { value: false };
  room._appTime = { delta: 16 };
  room._atelier = { root: { visible: true }, recordAnchor: anchor,
    setSound: (on, immediate) => frames.push([on, immediate]), update() {} };
  const world = Object.create(World.prototype);
  world.scene1 = room;
  // No manager/current room exists yet: this was the entry animation gap.
  world.update();
  assert.deepEqual(frames.pop(), [true, true]);
  room._ready.value = true;
  playback.pauseMusic(); world.update();
  assert.deepEqual(frames.pop(), [false, false]);
  playback._lofi_audio.isPlaying = true; world.update();
  assert.deepEqual(frames.pop(), [true, false]);
  playback._music.value.source = 'external';
  playback._music.value.playing = true; world.update();
  assert.deepEqual(frames.pop(), [true, false]);
  playback.pauseMusic(); world.update();
  assert.deepEqual(frames.pop(), [false, false]);
});

test('the sound indicator follows actual startup playback, not only master volume', () => {
  const room = sound('room', true, false);
  room.update();
  assert.equal(room._music.value.playing, true);
  room._lofi_audio.isPlaying = false;
  room.update();
  assert.equal(room._music.value.playing, false);
});

test('a paused startup soundtrack resumes in one click even while the scene is unmuted', async () => {
  const room = sound('room', false, false);
  let started = 0;
  room.startFromGesture = async () => { started++; };
  room._setVolume = value => { room._muted = value === 0; };
  await room.toggleMusic();
  assert.equal(started, 1);
});

test('entry starts a delayed lo-fi download without opening the player, and the same transport pauses and resumes it', async () => {
  const room = sound('room', false, false);
  room._muted = true;
  room._music.value.open = false;
  room.emit = () => {};
  room.listener.context.state = 'suspended';
  room.listener.context.resume = async () => { room.listener.context.state = 'running'; };
  room.listener.setMasterVolume = () => {};
  room._lofi_audio.play = function () { this.isPlaying = true; };
  let resolveAudio;
  const loaded = new Promise(resolve => { resolveAudio = resolve; });
  room._loadLofi = () => loaded;
  const entering = room.startFromGesture();
  assert.equal(room.musicPlaying, false);
  resolveAudio(room._lofi_audio);
  await entering;
  room.update();
  assert.equal(room.musicPlaying, true);
  assert.equal(room._music.value.playing, true);
  assert.equal(room._music.value.open, false);
  await room.toggleMusic();
  assert.equal(room.musicPlaying, false);
  await room.toggleMusic();
  assert.equal(room.musicPlaying, true);
  assert.equal(room._music.value.open, false);
});

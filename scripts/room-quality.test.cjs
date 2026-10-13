const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Group } = require('three');
function load(name) {
  const file = path.resolve(__dirname, '../src/utils', name + '.ts');
  const mod = new Module(file, module);
  mod.paths = module.paths;
  const req = mod.require.bind(mod);
  mod.require = id => id.startsWith('./') ? load(id.slice(2)) : req(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, file);
  return mod.exports;
}
const { createRecordCue } = load('record-cue');
const { RECORD_ARM } = load('room-mechanics');
function deck() {
  const arm = new Group(); arm.position.y = RECORD_ARM.liftedY;
  return { arm, cue: createRecordCue(arm) };
}
test('late lo-fi start lowers actual arm after lift and sweep, pause parks it', () => {
  const { arm, cue } = deck();
  cue.setPlaying(true); cue.update(160);
  assert.equal(arm.rotation.y, 0);
  assert.ok(arm.position.y > RECORD_ARM.liftedY);
  cue.update(520);
  assert.equal(arm.rotation.y, RECORD_ARM.playingAngle);
  assert.ok(arm.position.y > RECORD_ARM.playingY);
  cue.update(240);
  assert.equal(arm.position.y, RECORD_ARM.playingY);
  cue.setPlaying(false); cue.update(920);
  assert.equal(arm.rotation.y, 0);
  assert.equal(arm.position.y, RECORD_ARM.liftedY);
});
test('initial, interrupted and resumed-background playback always settles on the disc', () => {
  const { arm, cue } = deck();
  cue.setPlaying(true, true);
  assert.equal(arm.rotation.y, RECORD_ARM.playingAngle);
  cue.setPlaying(false); cue.update(300);
  cue.setPlaying(true); cue.update(2000);
  assert.equal(arm.position.y, RECORD_ARM.playingY);
  assert.equal(arm.rotation.y, RECORD_ARM.playingAngle);
  arm.rotation.y = 0; cue.setPlaying(true); cue.update(16);
  assert.equal(arm.rotation.y, RECORD_ARM.playingAngle);
});
test('hello happens with the native arm raised and extension safely returns to rest', () => {
  const { companionWave } = load('companion-wave');
  const arm = new Group(), extension = new Group(); extension.position.z = .111;
  let greeted = 0;
  const wave = companionWave(arm, extension, () => {
    greeted++; assert.ok(arm.rotation.x < -.95, 'raise the hand before saying hello');
  }).pause();
  wave.time(.5, false); assert.equal(greeted, 0);
  wave.time(.7, false); assert.equal(greeted, 1);
  assert.ok(extension.position.z > .14);
  wave.time(wave.duration(), false);
  assert.equal(arm.rotation.x, 0);
  assert.equal(extension.position.z, .111);
  wave.kill();
});
test('retina sharpness is preserved within a bounded render budget', () => {
  const { roomPixelRatio } = load('render-quality');
  assert.equal(roomPixelRatio(390, 844, 3), 2);
  assert.equal(roomPixelRatio(1536, 872, 1.25), 1.25);
  const ratio = roomPixelRatio(1920, 1080, 2);
  assert.ok(1920 * 1080 * ratio ** 2 <= 3_200_001);
});

test('ordinary room rendering keeps native antialiasing; outlines use the composer', () => {
  const vm = require('node:vm');
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/experiences/home/composer.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, document: { hidden: false }, require: () => ({ ExperienceBasedBlueprint: class {} }) });
  const subject = Object.create(exports.Composer.prototype);
  let direct = 0, effects = 0;
  subject._appRender = { enabled: true, instance: { setRenderTarget() {}, setViewport() {}, render() { direct++; } } };
  subject._appCamera = { instance: {} }; subject._appSizes = { width: 1280, height: 720 };
  subject._experience = { app: { scene: {} } }; subject._activeDevice = { value: null };
  subject._passes = { outline: { enabled: false } };
  subject._effect = { passes: [{}], render() { effects++; } };
  subject.update(); assert.equal(direct, 1); assert.equal(effects, 0);
  subject._passes.outline.enabled = true;
  subject.update(); assert.equal(direct, 1); assert.equal(effects, 1);
  subject._activeDevice.value = 'phone';
  subject.update(); assert.equal(direct, 1); assert.equal(effects, 1);
});

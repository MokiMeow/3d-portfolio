const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const { Texture, LoadingManager } = require('three');

function loadTS(relative, overrides = {}) {
  const file = path.resolve(__dirname, '../src', relative);
  const compiled = new Module(file, module);
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = id => {
    if (id in overrides) return overrides[id];
    if (id.endsWith('?url')) return id;
    if (id.startsWith('~/')) return loadTS(id.slice(2) + '.ts', overrides);
    if (id.startsWith('.')) return loadTS(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id)) + '.ts', overrides);
    return originalRequire(id);
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  return compiled.exports;
}

test('the room becomes enterable even when every video and audio request is stalled', async t => {
  const quickEvents = { STARTED: Symbol(), PROGRESSED: Symbol(), LOADED: Symbol() };
  const events = loadTS('static/event.static.ts');
  const videos = [];
  const saved = { window: global.window, document: global.document, AudioBuffer: global.AudioBuffer };
  global.window = { matchMedia: () => Object.assign(new EventTarget(), { matches: false }) };
  global.document = Object.assign(new EventTarget(), {
    hidden: false,
    createElement: () => {
      const video = Object.assign(new EventTarget(), { readyState: 0, load() {}, pause() {}, removeAttribute() {}, remove() {}, play: () => Promise.resolve() });
      videos.push(video);
      return video;
    },
  });
  global.AudioBuffer = class {};

  // Only the network boundary is simulated: geometry and images finish,
  // while media never invokes a readiness callback (mobile data saver).
  const resources = Object.assign(new EventEmitter(), {
    items: {}, sources: [], loadingManager: new LoadingManager(),
    loaders: { audioLoader: { load() {} } },
    setDracoLoader() {},
    setSources(sources) { this.sources = sources; },
    startLoading() {
      this.emit(quickEvents.STARTED);
      queueMicrotask(() => {
        let loaded = 0;
        for (const source of this.sources) {
          if (['audio', 'video'].includes(source.type)) continue;
          const item = source.type === 'texture' ? new Texture() : { scene: {} };
          this.items[source.name] = item;
          this.emit(quickEvents.PROGRESSED, ++loaded, this.sources.length, source, item);
        }
        if (loaded === this.sources.length) this.emit(quickEvents.LOADED);
      });
    },
  });
  const experience = { app: { resources, renderer: { instance: { capabilities: { getMaxAnisotropy: () => 8 } } } }, router: Object.assign(new EventEmitter(), { currentRouteKey: 'home' }) };
  const { Loader } = loadTS('experiences/home/loader.ts', {
    '.': { HomeExperience: class { constructor() { return experience; } } },
    'quick-threejs/lib/static': { events: quickEvents },
    '~/static/event.static': events,
  });
  const loader = new Loader();
  t.after(() => { loader.destruct(); Object.assign(global, saved); });
  let ready = false;
  loader.on(events.LOADED, () => { ready = true; });
  loader.construct();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, true, 'media readiness must not gate entry');
  assert.equal(loader.progress, 100);
  for (const name of ['monitor_a_screen_record', 'monitor_b_screen_record', 'phone_screen_record']) {
    assert.ok(loader.availableTextures[name] instanceof Texture, 'a screen must have a still image before its video loads');
  }
});

for (const failure of ['error', 'timeout', 'unmount']) {
  test(`a video ${failure} retains the poster and releases the media request`, t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const originalDocument = global.document;
    const video = Object.assign(new EventTarget(), {
      readyState: 0, src: '', load() {}, paused: false,
      pause() { this.paused = true; },
      removeAttribute(name) { if (name === 'src') this.src = ''; }, remove() {},
    });
    global.document = { createElement: () => video };
    t.after(() => { global.document = originalDocument; });
    const { loadScreenVideo } = loadTS('experiences/home/screen-video.ts');
    let readyCount = 0;
    const dispose = loadScreenVideo('/screen.webm', () => readyCount++);
    if (failure === 'error') video.dispatchEvent(new Event('error'));
    if (failure === 'timeout') t.mock.timers.tick(15000);
    if (failure === 'unmount') dispose();
    video.readyState = 2;
    video.dispatchEvent(new Event('loadeddata'));
    assert.equal(readyCount, 0, 'late media must not replace the fallback after cancellation');
    assert.equal(video.src, '');
    assert.equal(video.paused, true);
    dispose();
  });
}

test('one decoded frame upgrades the screen without waiting for canplaythrough', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const originalDocument = global.document;
  const video = Object.assign(new EventTarget(), {
    readyState: 1, src: '', load() {}, pause() {}, removeAttribute() {}, remove() {},
  });
  global.document = { createElement: () => video };
  t.after(() => { global.document = originalDocument; });
  const { loadScreenVideo } = loadTS('experiences/home/screen-video.ts');
  const frames = [];
  const dispose = loadScreenVideo('/screen.webm', texture => frames.push(texture));
  video.dispatchEvent(new Event('loadeddata'));
  assert.equal(frames.length, 0, 'metadata alone cannot be uploaded to the GPU');
  video.readyState = 2;
  video.dispatchEvent(new Event('loadeddata'));
  video.dispatchEvent(new Event('canplay'));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].isVideoTexture, true);
  assert.equal(frames[0].image, video);
  t.mock.timers.tick(15000);
  assert.equal(video.src, '/screen.webm', 'the watchdog must be removed after readiness');
  dispose();
});

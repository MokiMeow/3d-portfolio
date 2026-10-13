const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function harness(t, delayedSDK = false) {
  const file = path.resolve(
    __dirname,
    "../src/components/pages/home/LabGlasses.client.vue",
  );
  const source = fs
    .readFileSync(file, "utf8")
    .match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const clients = [];
  let unmount, resolveSDK;
  const api = {
    Player: class {
      constructor(_, options) {
        this.options = options;
        this.time = 0;
        this.plays = 0;
        this.pauses = 0;
        this.muted = false;
        clients.push(this);
      }
      becomeReady() {
        this.playVideo = () => this.plays++;
        this.pauseVideo = () => this.pauses++;
        this.getCurrentTime = () => this.time;
        this.seekTo = (time) => {
          this.time = time;
        };
        this.mute = () => {
          this.muted = true;
        };
        this.unMute = () => {
          this.muted = false;
        };
        this.options.events.onReady();
      }
      destroy() {
        this.destroyed = true;
      }
    },
  };
  const sdk = delayedSDK
    ? new Promise((resolve) => (resolveSDK = resolve))
    : Promise.resolve(api);
  const context = {
    exports: {},
    require: (name) =>
      name.includes("music-providers")
        ? { loadYouTube: () => sdk }
        : {
            HomeExperience: class {
              sound = { pauseMusic() {} };
            },
          },
    ref: (value) => ({ value }),
    onMounted() {},
    onBeforeUnmount: (fn) => (unmount = fn),
    document: {
      hidden: false,
      createElement: () => ({}),
      removeEventListener() {},
    },
    window: { location: { origin: "https://example.test" } },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  const output = ts.transpileModule(
    source +
      "\nexport const testing = {start,pause,playing,ready,failed,leftLens,rightLens,sync};",
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(output, context);
  const state = context.exports.testing;
  state.leftLens.value = state.rightLens.value = { replaceChildren() {} };
  t.after(() => unmount());
  return { state, clients, unmount, resolve: () => resolveSDK(api) };
}

test("both lenses wait for readiness, share transport, and only the left supplies audio", async (t) => {
  const { state, clients } = harness(t);
  await state.start();
  assert.equal(clients.length, 2);
  clients[0].becomeReady();
  assert.equal(clients[0].plays, 0);
  clients[1].becomeReady();
  assert.equal(clients[0].plays, 1);
  assert.equal(clients[1].plays, 1);
  assert.equal(clients[0].muted, false);
  assert.equal(clients[1].muted, true);
  clients[0].time = 8;
  clients[1].time = 5;
  state.sync();
  assert.equal(clients[1].time, 8);
  state.pause();
  assert.equal(clients[0].pauses, 1);
  assert.equal(clients[1].pauses, 1);
});

test("an embed error before readiness safely releases both players and ignores late callbacks", async (t) => {
  const { state, clients } = harness(t);
  await state.start();
  assert.doesNotThrow(() => state.pause());
  clients[0].options.events.onError({ data: 150 });
  assert.equal(state.failed.value, true);
  assert.ok(clients.every((p) => p.destroyed));
  clients.forEach((p) => p.becomeReady());
  assert.equal(state.ready.value, false);
  assert.ok(clients.every((p) => p.plays === 0));
});

test("closing while the SDK loads never constructs a hidden player afterward", async (t) => {
  const { state, clients, unmount, resolve } = harness(t, true);
  const pending = state.start();
  unmount();
  resolve();
  await pending;
  assert.equal(clients.length, 0);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const file = path.resolve(__dirname, "../src/utils/camera-damping.ts");
const compiled = new Module(file, module);
compiled._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  file,
);
const { cameraDamping } = compiled.exports;

test("a resumed or invalid frame never overshoots the camera target", () => {
  for (const delta of [0, 16.67, 100, 8000, 3600000, Infinity, NaN, -1]) {
    const weight = cameraDamping(0.005, delta);
    assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1);
    const next = 5 + (20 - 5) * weight;
    assert.ok(next >= 5 && next <= 20);
  }
});
test("30, 60 and 120 fps converge to the same position after a second", () => {
  const results = [30, 60, 120].map((fps) => {
    let position = 0;
    for (let frame = 0; frame < fps; frame++)
      position += (20 - position) * cameraDamping(0.005, 1000 / fps);
    return position;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-10);
});

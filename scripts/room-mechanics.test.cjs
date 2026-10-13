const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const file = path.resolve(__dirname, "../src/utils/room-mechanics.ts");
const compiled = new Module(file, module);
compiled._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  file,
);
const {
  RECORD_ARM: a,
  dockTrackPose,
  dockSurfaceHeight,
  zoomRadius,
  panUnitsPerPixel,
} = compiled.exports;
test("lowered stylus touches the record grooves, not the plinth or label", () => {
  const x =
    a.x + 0.14 * Math.cos(a.playingAngle) + 0.5 * Math.sin(a.playingAngle);
  const z =
    a.z - 0.14 * Math.sin(a.playingAngle) + 0.5 * Math.cos(a.playingAngle);
  const radius = Math.hypot(x + 0.25, z);
  assert.ok(radius > 0.119 && radius < 0.292);
  assert.ok(Math.abs(a.playingY - 0.058 - 1.128) < 0.003);
  assert.ok(a.liftedY - 0.058 > 1.15);
});
test("whole tread clears the deck and ramp in both directions of travel", () => {
  for (let z = 0; z <= 1.65; z += 0.005) {
    const pose = dockTrackPose(z);
    for (let i = 0; i <= 100; i++) {
      const local = -0.278 + (i / 100) * 0.556;
      const bottom = pose.y - local * Math.sin(pose.pitch);
      assert.ok(
        bottom + 0.0001 >= dockSurfaceHeight(z + local * Math.cos(pose.pitch)),
        `tread intersects at ${z}`,
      );
    }
  }
  assert.ok(Math.abs(dockTrackPose(0).pitch) < 1e-8);
  assert.ok(Math.abs(dockTrackPose(1.6).pitch) < 1e-8);
});
test("zoom stays proportional and panning remains controllable at close range", () => {
  assert.equal(zoomRadius(2, 100) / 2, zoomRadius(20, 100) / 20);
  assert.ok(zoomRadius(2, -10000) > 1.4);
  assert.ok(Math.abs(zoomRadius(zoomRadius(8, 100), -100) - 8) < 1e-9);
  assert.ok(
    Math.abs(
      panUnitsPerPixel(2, 45, 800) * 10 - panUnitsPerPixel(20, 45, 800),
    ) < 1e-12,
  );
});

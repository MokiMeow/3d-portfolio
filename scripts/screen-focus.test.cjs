const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  ts = require("typescript");
const {
  Group,
  Mesh,
  PlaneGeometry,
  Vector3,
  PerspectiveCamera,
} = require("three");
const file = path.resolve(__dirname, "../src/utils/screen-focus.ts"),
  compiled = new Module(file, module);
compiled.paths = module.paths;
compiled._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: 1, target: 9 },
  }).outputText,
  file,
);
const { screenFocusPose } = compiled.exports;
test("focus follows a hinged screen after it opens without moving the screen mesh", () => {
  const hinge = new Group(),
    screen = new Mesh(new PlaneGeometry(1.5, 1));
  hinge.position.set(-0.12, 1.9, 0.67);
  hinge.add(screen);
  screen.position.y = 0.55;
  const closed = screenFocusPose(screen, 1.5, 35);
  const original = screen.position.clone();
  hinge.rotation.x = -1.1;
  hinge.rotation.y = 0.55;
  const opened = screenFocusPose(screen, 1.5, 35);
  assert.ok(closed.target.distanceTo(opened.target) > 0.3);
  assert.ok(screen.position.equals(original));
  const normal = new Vector3(0, 0, 1).transformDirection(screen.matrixWorld);
  assert.ok(
    opened.position.clone().sub(opened.target).normalize().dot(normal) >
      0.99999,
  );
});
test("the full laptop display fits portrait and landscape viewports", () => {
  for (const aspect of [0.46, 1, 1.8]) {
    const screen = new Mesh(new PlaneGeometry(1.5, 1));
    screen.position.set(0.2, 2, 0.7);
    screen.rotation.x = -0.15;
    screen.rotation.y = 0.6;
    const pose = screenFocusPose(screen, aspect, 35),
      camera = new PerspectiveCamera(35, aspect, 0.01, 100);
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    camera.updateMatrixWorld(true);
    const center = pose.target.clone().project(camera);
    assert.ok(Math.abs(center.x) < 1e-6 && Math.abs(center.y) < 1e-6);
    for (const x of [-0.75, 0.75])
      for (const y of [-0.5, 0.5]) {
        const corner = screen
          .localToWorld(new Vector3(x, y, 0))
          .project(camera);
        assert.ok(
          Math.abs(corner.x) < 0.95 && Math.abs(corner.y) < 0.95,
          `${aspect}: ${corner.toArray()}`,
        );
      }
  }
});

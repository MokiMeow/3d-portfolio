const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const file = path.resolve(__dirname, "../src/utils/music-link.ts");
const compiled = new Module(file, module);
compiled._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  file,
);
const { parseMusicLink } = compiled.exports;
test("YouTube share, music and shorts links resolve to the video without tracking parameters", () => {
  for (const url of [
    "https://youtu.be/dQw4w9WgXcQ?si=shared",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=unused",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ])
    assert.deepEqual(parseMusicLink(url), {
      kind: "youtube",
      id: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
});
test("Spotify international and podcast links preserve the entity, strip share tracking", () => {
  assert.equal(
    parseMusicLink(
      "https://open.spotify.com/intl-en/track/4cOdK2wGLETKBW3PvgPWqT?si=test",
    ).id,
    "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
  );
  assert.equal(
    parseMusicLink("https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5")
      .kind,
    "spotify",
  );
});
test("unsafe schemes, lookalike hosts and malformed provider IDs are rejected", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com/music.mp3",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=bad",
    "https://open.spotify.com/track/not-an-id",
    "https://user:secret@example.com/audio.mp3",
    '<iframe src="x">',
  ])
    assert.equal(parseMusicLink(url), null, url);
});
test("direct audio links keep signed query strings needed to play", () => {
  const url = "https://example.com/episode.mp3?signature=sample";
  assert.deepEqual(parseMusicLink(url), { kind: "audio", id: url, url });
});

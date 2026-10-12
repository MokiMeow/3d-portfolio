# Interactive lab additions

The pre-expansion checkpoint is `aaef38c` on `station-redo`. The original room,
lighting, camera tour, furniture and Skills scene remain in place.

## Exploring

- **Home drawers:** click any of the three wood fronts to open or close it. The
  top drawer starts partly open, as in the original model. The footer's drawer
  icon provides keyboard-accessible controls as well.
- **Contact phone:** click the handset. Camera requests video access only after
  Enable camera; photos stay local until the visitor chooses Save. Leaving the
  app, closing the phone or hiding the page stops the camera. Chrome opens real
  web addresses/searches in a new browser tab. Messages is a local, scripted
  conversation, with no AI API, message delivery or ongoing service cost.
- **Smart glasses:** click the glasses, then Play for the official Rick Astley
  YouTube embed. Open on YouTube is always available during playback. Embedded
  playback depends on the browser and YouTube; the Codex in-app browser returned
  a player error during testing. Camera permission also remained pending in
  that browser, so live hardware capture has not been verified there.
- **Pocket terminal:** click the small pad, or use the footer object menu. Try
  `help`, `whoami`, `projects`, `coffee`, `status`, or `fortune`. This is a local
  interactive toy and never executes shell commands.
- **Contact controller:** tap for a short physical rock; its LED moves with it.
- **Contact free camera:** continuous horizontal orbit, with no stop after one
  revolution. Vertical limits keep the camera above the display platform.

Flash UI is replaced by **Inference Score**, linked to `MokiMeow/nutllm`. This
interprets the spoken “Nutella” as NutLLM, consistent with the existing portfolio.
The Discord plaque uses a crisp white Clyde mark on its blurple face.

## Media and performance

`mohith-github.webm` and `mohith-code.webm` are muted 768 × 432, 15 fps WebM loops
composed from actual browser/editor captures: the public MokiMeow GitHub profile
and this lab's TypeScript/Vue source displayed in VS Code for the Web. They are
edited walkthroughs, not live feeds. Together they are about 633 KB.

Screen videos pause off the Home route, when the page is hidden, and for reduced
motion. WebGL and portal rendering hold the last room frame while a device dialog
is open. Devices load on demand. YouTube is mounted only after Play and removed
when the glasses close. Drawer meshes are separated once during construction,
share the original UV/normal buffers, and preserve the baked materials. No new
lighting passes, physics engine, runtime dependencies or background AI calls
were added. Short drawer/controller motion respects reduced motion.

## Checks

```sh
node --test scripts/mesh-parts.test.cjs
pnpm typecheck
pnpm build
```

The geometry tests check triangle preservation, indexed/non-indexed inputs,
UV/normal preservation, world transforms, ray picking after a part moves, and
cleanup. Browser checks cover drawer open/close, continuous contact orbit,
phone/messages, script-URL rejection, device modal isolation, terminal commands,
and a 390-pixel layout. Actual low-end-device frame rates were not measured.

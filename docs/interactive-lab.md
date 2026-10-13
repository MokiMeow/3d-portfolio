# Interactive lab additions

The pre-expansion checkpoint is `aaef38c` on `station-redo`. The original room,
lighting, furniture and Skills scene remain in place. The Home camera tour now
frames the connected rooms.

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
Discord now uses the original, freestanding Clyde silhouette with beveled edges
and eye cutouts. The square backing has been removed. Its missing baked-mesh
normals are generated once before applying the blue face shading.

## Connected atelier

Home now includes the drawing/printing area and a connected reading/listening
nook from the start. There is no separate entry, room mode or view-tab panel.
The existing footer stays visible: its pencil icon opens a small drawing menu;
the objects also respond directly in the guided view. The camera icon unlocks
continuous horizontal orbit, with a wider zoom/pan range. The guided camera
fits the full floor plan at portrait widths.

Both extensions use the measured original tile level (y=0.339813), a continuous
foundation and matching wall heights. Tile faces use the source atlas and copied
UVs at full resolution, with the original 1.5345 × 1.521 spacing and grout width. The
printer and paper storage sit against the back wall. The listening nook has a
clear passage, low bookcase, record console, seating and a reading light.
The original wall switch dims the new rooms through the same night uniform.
Exterior backing surfaces, continuous coping, plinths and window reveals close
the original cutaway for rear views. The old invisible scenery depth masks have
been removed. Scenery fragments are clipped to sightlines passing through the
actual window opening, so they cannot punch holes into the walls during orbit.

- The drawing table and framed print cycle through Orbit, Rhythm and Field.
- Ceramic ink wells cycle Clay & ink, Moss & cream and Blue hour palettes.
- The ruler switches between composition and construction outlines.
- The press animates a paper print. **Save this print** downloads the current
  original composition as a 1400 × 980 PNG; nothing is uploaded.
- The turntable and speaker grilles control the existing lab audio. Its audio
  source sits at the record console.
- The reading light toggles its bulb and soft floor glow.
- The drawing actions have keyboard-accessible, 44-pixel-high footer controls.
  Menus close on Escape, outside click, or when another footer menu opens.

The furniture, joinery, rug, plant, artwork and lighting accents are procedural.
Geometry is constructed once with Home. Floor tiles are instanced, static
furniture is batched by material, and animated/clickable pieces stay independent.
Texture samples are made once from assets already loaded for the original room.
There are no new model downloads, shadow-map passes or dependencies. Added
furniture uses MeshStandardMaterial, a hemisphere and two directional lights,
with a small PMREM probe generated once from RoomEnvironment. Baked materials
on the original room keep their existing colour pipeline. Textures use bounded
anisotropic filtering; linen and plaster maps are shared. Metal highlights,
turned ceramics, cloth folds and welts, leaf veins, printer controls and vents,
book covers/pages/spines, joinery and turntable components remain legible nearby.
Anime.js drives printing and small object responses. Reduced motion disables
those decorative responses and record rotation, and completes printing instantly.

## Media and performance

`mohith-github.webm` and `mohith-code.webm` are muted 768 × 432, 15 fps WebM loops
composed from actual browser/editor captures: the public MokiMeow GitHub profile
and this lab's TypeScript/Vue source displayed in VS Code for the Web. They are
edited walkthroughs, not live feeds. Together they are about 633 KB.

Screen videos pause off the Home route, when the page is hidden, and for reduced
motion. WebGL and portal rendering hold the last room frame while a device dialog
is open. Phone, glasses and terminal interfaces are bundled with their dialog,
so opening a device cannot request an old, separately named child chunk. The
previous blank dialog was reproduced as a missing JavaScript chunk from a stale
preview server after a rebuild. An error boundary provides a reload action if
device rendering fails. Always restart the production server after rebuilding.
YouTube is mounted only after Play and removed
when the glasses close. Drawer meshes are separated once during construction,
share the original UV/normal buffers, and preserve the baked materials. No new
lighting passes, physics engine, runtime dependencies or background AI calls
were added. Short drawer/controller motion respects reduced motion.

## Checks

```sh
node --test scripts/mesh-parts.test.cjs scripts/camera-damping.test.cjs
pnpm typecheck
pnpm build
```

The geometry tests check triangle preservation, indexed/non-indexed inputs,
UV/normal preservation, world transforms, ray picking after a part moves, and
cleanup. Browser checks cover drawer open/close, continuous contact orbit,
phone/messages, script-URL rejection, device modal isolation, terminal commands,
and a 390-pixel layout. Additional checks cover direct atelier object picking,
shared artwork updates, physical printing and PNG download. The integrated-room
revision also checks Home rotation, the shared light switch, a 390-pixel portrait
layout and the compact footer menu.
Camera damping tests cover long/invalid frame deltas and equivalent convergence
at 30/60/120 fps. Actual low-end-device frame rates were not measured.

Checkpoints: `9158707` before these fixes and `ef5f5dd` for the standalone
Discord/device fixes, before the atelier expansion.

Room integration checkpoint: `374e191` preserves the previous atelier version.

Detail correction checkpoint: `b087580` preserves the integrated room before
the material/geometry pass. The Home free-camera minimum radius is now 1.5.
Visual inspection covers eight azimuths plus top/low rear views, the floor join,
and close-ups of the drafting desk, printer, turntable, sofa, lamp, books, plant,
ceramics and framed artwork. Temporary audit UI and portrait wrappers are removed
from the delivered build.

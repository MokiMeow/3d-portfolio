# Room companion and record player

Every scene starts in free orbit. Drag rotates, the wheel/pinch zooms, and right-drag or two fingers pan. The Home footer reset button returns to the opening composition. Other scenes retain their optional guided-camera toggle.

## Music

Click the record deck or its footer icon. YouTube video links, Spotify tracks/albums/playlists/shows/episodes, and direct HTTPS audio files are accepted. Providers are loaded on demand using their official iframe APIs. Switching sources pauses the room radio; closing the panel stops playback and destroys the embed. The physical record and tonearm follow actual playback state, including provider pause events and scene mute.

YouTube embedding restrictions and Spotify preview/account restrictions still apply. The video remains visible while playing. There are no service credentials, proxy downloads, or recurring API costs. Unsupported/unavailable links receive an explanation and an original-link escape hatch.

References: [YouTube iframe API](https://developers.google.com/youtube/iframe_api_reference), [Spotify iframe API](https://developer.spotify.com/documentation/embeds/references/iframe-api).

## WALL-E

Source: the user's `Desktop/bounty/3D-Assets/21-WALL-E/wall-e-2008-animated.glb`. The original file is unchanged. The web derivative is `src/public/models/wall-e-companion.glb` (4,806,144 bytes versus 85,044,604 bytes originally).

Prepared offline with glTF Transform 4, Sharp and Meshoptimizer: deduplicate, weld, simplify (ratio 0.45 / error 0.0005), join compatible meshes without flattening articulation nodes, prune, WebP textures capped at 1024px / quality 88, then Meshopt compression. The result retains 16 named articulation controls, 91 meshes and the supplied animation clip. Runtime gestures use the head, neck, eyes and arm controls; they do not run the full clip indefinitely.

The companion greets once on entry, returns to its low dock, and gently follows the view with its head. Click it or its small binocular control to greet again, dock, or inspect it. The dock itself is clickable. Lights-off and navigation away trigger a farewell. Captions accompany optional browser speech synthesis; this is the device's available voice, not the film character's voice. Mute stops speech. Reduced motion removes the idle/wave animation and movement transitions.

The model is loaded separately, its materials share the room environment, and its contact shadow is a small texture rather than another realtime shadow pass. Loading errors do not prevent entering the room. Scene teardown releases geometry, materials, textures, timers and animation timelines.

## Couch

The lounge sofa keeps its footprint with a slimmer walnut frame, raised legs, soft oat cushions with seam piping, sage armrests and a darker accent pillow. Existing lamp, side table, blanket and room materials remain.

## Exterior charging bay and optical correction

The source model was inspected in Blender 5.2. The dark pupil, optical baffles,
bronze bezel, violet optical well and clear cover were already present. The
previous runtime lifted the material factors and treated colour maps as linear,
then placed a 20%-opaque white surface over the lens. This washed out its depth.
The companion now preserves glTF PBR factors and texture colour-space tags and
converts the **lit result** for this room's legacy linear-output renderer.
A front-facing 5.5%-opacity clearcoat cover preserves highlights without adding
a full-scene transmission render. The original GLB is unchanged.

The dock is outside the original room at x=1.15, z=4.62, on a ground-level apron.
Its 1.88 × 2.64 footprint has two recessed tread cradles, grip ribs, bronze guide
rails, a sloped approach, rear contacts, replaceable service plates, recessed
vents, cable boots/conduit, isolation key, voltage display, numbered tag and
hex fasteners. WALL-E follows the ramp height on its short greeting route, then
backs into the cradles. Static hardware is batched into six material meshes;
labels and status strips stay separate. No new lights, shadows or dependencies.

The record console uses warm paper, sage metal and charcoal vinyl. The main
play/pause control is separate from the link form, and both the drawn record
and physical deck follow playback. Closing stops playback; minimizing retains
the provider video. Opening the console does not summon the phone keyboard.
The panel scrolls within short screens and supports reduced motion.

The compositor and camera gesture measurements now subscribe to the actual
`quick-threejs` RESIZED event symbol. A previous string event left the
postprocessing buffer at its old dimensions after a phone/desktop resize.
This is checked by resizing the browser in both directions and inspecting
close-up rendering and pointer interaction afterward.

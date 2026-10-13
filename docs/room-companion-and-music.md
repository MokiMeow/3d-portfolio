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

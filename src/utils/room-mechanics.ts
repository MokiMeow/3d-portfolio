/** Measurements shared by the geometry and its motion, in room units. */
export const RECORD_ARM = {
  x: 0.43,
  z: -0.22,
  playingY: 1.187,
  liftedY: 1.225,
  playingAngle: -1.38,
};
export const DOCK_SURFACE = {
  deck: 0.197,
  ground: 0.035,
  start: 0.61,
  end: 1.24,
};
export function dockSurfaceHeight(z: number) {
  const t = Math.max(
    0,
    Math.min(
      1,
      (z - DOCK_SURFACE.start) / (DOCK_SURFACE.end - DOCK_SURFACE.start),
    ),
  );
  return DOCK_SURFACE.deck + (DOCK_SURFACE.ground - DOCK_SURFACE.deck) * t;
}
/** Support the entire rigid tread across both ramp transitions, not only its centre. */
export function dockTrackPose(z: number, halfLength = 0.278) {
  const pitch = Math.atan2(
    dockSurfaceHeight(z - halfLength) - dockSurfaceHeight(z + halfLength),
    halfLength * 2,
  );
  let y = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const localZ = -halfLength + (i / 24) * halfLength * 2;
    y = Math.max(
      y,
      dockSurfaceHeight(z + localZ * Math.cos(pitch)) +
        localZ * Math.sin(pitch),
    );
  }
  return { y: y + 0.002, pitch };
}
export function zoomRadius(radius: number, wheelPixels: number) {
  return (
    radius * Math.exp(Math.max(-0.35, Math.min(0.35, wheelPixels * 0.0015)))
  );
}
export function panUnitsPerPixel(
  radius: number,
  fovDegrees: number,
  height: number,
) {
  return (
    (2 * radius * Math.tan((fovDegrees * Math.PI) / 360)) / Math.max(1, height)
  );
}

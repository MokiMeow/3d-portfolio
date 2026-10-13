import { Mesh, Vector3 } from "three";

/** Frame the current screen plane from its front, including its parent's hinge. */
export function screenFocusPose(screen: Mesh, aspect: number, fov: number) {
  screen.updateWorldMatrix(true, false);
  screen.geometry.computeBoundingBox();
  const bounds = screen.geometry.boundingBox!;
  const target = screen.localToWorld(bounds.getCenter(new Vector3()));
  const size = bounds.getSize(new Vector3());
  const scale = screen.getWorldScale(new Vector3());
  const halfHeight =
    Math.max(size.y * scale.y, (size.x * scale.x) / Math.max(0.35, aspect)) / 2;
  const distance = (halfHeight * 1.22) / Math.tan((fov * Math.PI) / 360);
  const normal = new Vector3(0, 0, 1).transformDirection(screen.matrixWorld);
  return { target, position: target.clone().addScaledVector(normal, distance) };
}

import { Mesh, PerspectiveCamera, Vector3 } from "three";

/** The focused camera faces the display head-on, so its DOM surface can use
 * an equivalent 2D transform. This avoids Chromium's hit-testing failures
 * on the very large CSS3D camera translations used by the distant rooms. */
export function screenCssTransform(
  screen: Mesh, camera: PerspectiveCamera, width: number, height: number,
  elementWidth: number, elementHeight: number,
) {
  screen.updateWorldMatrix(true, false);
  camera.updateMatrixWorld(true);
  if (!screen.geometry.boundingBox) screen.geometry.computeBoundingBox();
  const bounds = screen.geometry.boundingBox!;
  const project = (x: number, y: number) => {
    const p = screen.localToWorld(new Vector3(x, y, 0)).project(camera);
    return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
  };
  const tl = project(bounds.min.x, bounds.max.y);
  const tr = project(bounds.max.x, bounds.max.y);
  const bl = project(bounds.min.x, bounds.min.y);
  return [
    (tr.x - tl.x) / elementWidth, (tr.y - tl.y) / elementWidth,
    (bl.x - tl.x) / elementHeight, (bl.y - tl.y) / elementHeight, tl.x, tl.y,
  ];
}

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

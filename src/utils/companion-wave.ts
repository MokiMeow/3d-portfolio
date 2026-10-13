import gsap from "gsap";
import type { Object3D } from "three";

/** Native shoulder and telescoping rail; a readable greeting, not an inspection. */
export function companionWave(arm: Object3D, extension: Object3D | undefined, hello: () => void) {
  const rest = arm.rotation.x, rail = extension?.position.z ?? 0;
  const wave = gsap.timeline({ defaults: { ease: "sine.inOut" } });
  wave.to(arm.rotation, { x: rest - 1.12, duration: .65 }, 0);
  if (extension) wave.to(extension.position, { z: rail + .035, duration: .55 }, .1);
  wave.call(hello, [], .58);
  wave.to(arm.rotation, { x: rest - .94, duration: .24 }, .8)
    .to(arm.rotation, { x: rest - 1.2, duration: .3 }, 1.04)
    .to(arm.rotation, { x: rest - .94, duration: .3 }, 1.34)
    .to(arm.rotation, { x: rest - 1.12, duration: .28 }, 1.64)
    .to(arm.rotation, { x: rest, duration: .75 }, 2.4);
  if (extension) wave.to(extension.position, { z: rail, duration: .65 }, 2.45);
  return wave;
}

import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Shape,
  SplineCurve,
  Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface DualSenseKit {
  geo: <T extends BufferGeometry>(geometry: T) => T;
  surface: (options: ConstructorParameters<typeof MeshPhysicalMaterial>[0]) => MeshPhysicalMaterial;
  glow: (hex: string) => MeshBasicMaterial;
  canvasTexture: (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => CanvasTexture;
}

/**
 * A DualSense-style controller, modelled in millimetres: x across, y up, the player at +z and the triggers at -z.
 * The origin sits under the middle of the controller at the lowest point of the grips, so it rests on a surface.
 * Built once; every copy shares the same geometry and materials.
 */
export function dualSenseFactory(kit: DualSenseKit) {
  const { geo, surface, glow, canvasTexture } = kit;
  const white = surface({ color: 0xf1f1ee, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const whiteGloss = surface({ color: 0xf6f6f4, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const deck = surface({ color: 0x141518, roughness: 0.5, metalness: 0.08 });
  const piano = surface({ color: 0x0b0b0d, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
  const rubber = surface({ color: 0x2b2c31, roughness: 0.72 });
  const dpadGrey = surface({ color: 0xdedfe2, roughness: 0.32, clearcoat: 0.5 });
  const light = glow("#4f86ff");
  const amber = glow("#ff8a3d");

  // Speaker grille: a field of tiny holes on the deck between the sticks.
  const grille = canvasTexture(128, 64, ctx => {
    ctx.fillStyle = "#141518"; ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = "#050506";
    for (let y = 8; y < 60; y += 7) for (let x = 6 + ((y / 7) % 2) * 3.5; x < 124; x += 7) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
  });
  const grilleMaterial = surface({ color: 0xffffff, map: grille, roughness: 0.6 });
  // Face button caps: the four engraved symbols in pale grey on smoked caps.
  const symbol = (draw: (ctx: CanvasRenderingContext2D) => void) => surface({
    color: 0xffffff, roughness: 0.25, clearcoat: 0.6,
    map: canvasTexture(64, 64, ctx => {
      ctx.fillStyle = "#26272b"; ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = "#c9cad0"; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.lineCap = "round";
      draw(ctx);
    }),
  });
  const symbols = [
    symbol(ctx => { ctx.beginPath(); ctx.moveTo(32, 16); ctx.lineTo(48, 44); ctx.lineTo(16, 44); ctx.closePath(); ctx.stroke(); }),
    symbol(ctx => { ctx.beginPath(); ctx.arc(32, 32, 14, 0, Math.PI * 2); ctx.stroke(); }),
    symbol(ctx => { ctx.beginPath(); ctx.moveTo(19, 19); ctx.lineTo(45, 45); ctx.moveTo(45, 19); ctx.lineTo(19, 45); ctx.stroke(); }),
    symbol(ctx => { ctx.strokeRect(19, 19, 26, 26); }),
  ];
  const capSide = surface({ color: 0x232428, roughness: 0.3 });

  // The body seen from above: a wide bridge with two grips that run back toward the player.
  const outline = new Shape();
  const half: [number, number][] = [
    [0, -31], [24, -32], [44, -31], [62, -27], [74, -18], [80, -4], [81, 12], [79, 28], [75, 42], [69, 52], [60, 57], [51, 55], [45, 46], [41, 33], [34, 25], [22, 22], [0, 21],
  ];
  const points = [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [-x, z] as [number, number])];
  // A smooth closed spline through the key points, so the silhouette has no facets.
  const ring = points.map(([x, z]) => new Vector2(x, z));
  const spline = new SplineCurve([...ring, ring[0]!]);
  outline.setFromPoints(spline.getSpacedPoints(240).slice(0, -1));
  const extruded = (new ExtrudeGeometry(outline, { depth: 15, bevelEnabled: true, bevelThickness: 6, bevelSize: 5, bevelSegments: 8, curveSegments: 6 }));
  extruded.rotateX(Math.PI / 2);
  // After the turn the body spans y = 15..36 (the bevel adds 6 above and below); its top face is at 36.
  extruded.translate(0, 30, 0);
  // Split the long cap triangles so the grips can bend smoothly, then weld for smooth shading.
  extruded.deleteAttribute("uv");
  extruded.deleteAttribute("normal");
  const fine = new TessellateModifier(5, 8).modify(extruded);
  extruded.dispose();
  const bodyGeometry = geo(mergeVertices(fine, 0.01));
  fine.dispose();
  // The grips sweep down and back into the hand, and slim as they go.
  {
    const p = bodyGeometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = Math.min(1, Math.max(0, (z - 14) / 44)) * Math.min(1, Math.max(0, (Math.abs(x) - 30) / 16));
      const ease = t * t * (3 - 2 * t);
      p.setY(i, y - ease * 14 - (y - 26) * ease * 0.25);
      p.setX(i, x - Math.sign(x) * ease * 3);
    }
    bodyGeometry.computeVertexNormals();
  }
  // The black deck between the grips that carries the sticks.
  const deckShape = new Shape();
  deckShape.moveTo(-40, -6);
  deckShape.quadraticCurveTo(0, -9, 40, -6);
  deckShape.quadraticCurveTo(44, 8, 34, 22);
  deckShape.quadraticCurveTo(0, 25, -34, 22);
  deckShape.quadraticCurveTo(-44, 8, -40, -6);
  const deckGeometry = geo(new ExtrudeGeometry(deckShape, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.8, bevelSegments: 2, curveSegments: 16 }));
  deckGeometry.rotateX(Math.PI / 2);
  const touchpadGeometry = geo(new RoundedBoxGeometry(56, 3, 29, 3, 1.4));
  const barGeometry = geo(new RoundedBoxGeometry(1.4, 1.6, 25, 1, 0.6));
  const pillGeometry = geo(new RoundedBoxGeometry(3.4, 1.8, 7.5, 1, 0.9));
  const capGeometry = geo(new CylinderGeometry(4.6, 4.8, 2.6, 28));
  const stickBase = geo(new CylinderGeometry(10.5, 11, 1.4, 32));
  const stickStem = geo(new CylinderGeometry(4, 5.2, 7, 20));
  // Stick caps: a rim with a shallow dish on top.
  const stickCap = geo(new LatheGeometry([
    new Vector2(0, 3.2), new Vector2(4, 3.0), new Vector2(7, 3.6), new Vector2(8.6, 4.4), new Vector2(9.2, 3.8), new Vector2(9.3, 1.4), new Vector2(8.6, 0), new Vector2(0, 0),
  ], 32));
  const dpadGeometry = geo(new RoundedBoxGeometry(6.4, 2.2, 8.6, 2, 1.2));
  const psGeometry = geo(new CylinderGeometry(3.6, 3.6, 1.4, 24));
  const muteGeometry = geo(new RoundedBoxGeometry(7, 1.2, 2.4, 1, 0.6));
  const grilleGeometry = geo(new RoundedBoxGeometry(22, 0.6, 7, 1, 0.3));
  const shoulderGeometry = geo(new RoundedBoxGeometry(27, 5, 8, 2, 2.2));
  const triggerGeometry = geo(new RoundedBoxGeometry(22, 9, 17, 3, 3.4));
  const portGeometry = geo(new RoundedBoxGeometry(9, 3.2, 1, 1, 1));

  const add = (parent: Group, geometry: BufferGeometry, material: Material | Material[], x: number, y: number, z: number) => {
    const part = new Mesh(geometry, material);
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  };

  return function create() {
    const pad = new Group();
    pad.name = "dualsense";
    const TOP = 36;
    const body = add(pad, bodyGeometry, white, 0, 0, 0);
    add(pad, deckGeometry, deck, 0, TOP + 0.4, 0);
    add(pad, touchpadGeometry, whiteGloss, 0, TOP + 0.1, -15);
    // The light bar runs along both sides of the touchpad.
    for (const side of [-1, 1]) {
      add(pad, barGeometry, light, side * 29.4, TOP + 0.5, -15);
      add(pad, pillGeometry, piano, side * 35, TOP + 0.9, -21);
    }
    // Sticks.
    for (const side of [-1, 1]) {
      add(pad, stickBase, rubber, side * 21, TOP + 1.1, 9);
      add(pad, stickStem, rubber, side * 21, TOP + 4.6, 9);
      add(pad, stickCap, rubber, side * 21, TOP + 7.6, 9).scale.set(0.88, 1, 0.88);
    }
    add(pad, psGeometry, piano, 0, TOP + 1.6, 13);
    add(pad, muteGeometry, amber, 0, TOP + 1.3, 19);
    add(pad, grilleGeometry, grilleMaterial, 0, TOP + 1.25, 3.4);
    // D-pad on the left wing, four separate arrows.
    for (const [dx, dz, turn] of [[0, -7, 0], [0, 7, 0], [-7, 0, Math.PI / 2], [7, 0, Math.PI / 2]] as const) {
      const arrow = add(pad, dpadGeometry, dpadGrey, -48 + dx, TOP + 1.4, -1 + dz);
      arrow.rotation.y = turn;
    }
    // Face buttons on the right wing: triangle at the top, then circle, cross, square.
    [[0, -9.5], [9.5, 0], [0, 9.5], [-9.5, 0]].forEach(([dx, dz], i) => {
      const cap = add(pad, capGeometry, [capSide, symbols[i]!, capSide], 48 + dx!, TOP + 1.6, -1 + dz!);
      cap.rotation.y = Math.PI;
    });
    // Shoulder buttons and triggers along the far edge.
    for (const side of [-1, 1]) {
      add(pad, shoulderGeometry, piano, side * 52, TOP - 1, -33.5).rotation.z = side * -0.06;
      const trigger = add(pad, triggerGeometry, piano, side * 53, TOP - 12, -35);
      trigger.rotation.x = 0.45;
    }
    add(pad, portGeometry, piano, 0, TOP - 7, -36.6);
    return { group: pad, body };
  };
}

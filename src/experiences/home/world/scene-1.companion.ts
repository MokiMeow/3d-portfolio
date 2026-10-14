import {
  Box3,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Texture,
  Vector3,
  FrontSide,
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  DoubleSide,
  type Camera,
  BufferGeometry,
  type Material,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createCompanionDock } from "./scene-1.dock";
import { createBootPlant } from "./companion-plant";
import { mergeStatic } from "./merge-static";
import gsap from "gsap";
import { dockTrackPose } from "~/utils/room-mechanics";
import { companionWave } from "~/utils/companion-wave";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import type { CompanionState } from "~/common/models/companion.model";

const GROUND = 0.035,
  DOCK = new Vector3(1.15, 0.197, 4.62),
  VISIT = new Vector3(1.15, GROUND, 6.24);
/** One articulated visitor, on a short clear route, never chasing the camera. */
export function createCompanion(
  scene: Group,
  env: Texture,
  night: { value: number },
  state: CompanionState,
  ready: () => void,
) {
  const root = new Group(),
    carriage = new Group();
  root.name = "wall_e_companion";
  scene.add(root);
  root.add(carriage);
  carriage.position.copy(DOCK);
  const selectables: SelectableObject[] = [],
    geometries = new Set<BufferGeometry>(),
    materials = new Set<MeshStandardMaterial | MeshBasicMaterial>(),
    textures = new Set<Texture>();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    pendingWelcome = false,
    welcomed = false,
    sleeping = false,
    elapsed = 0,
    captionTimer: ReturnType<typeof setTimeout> | undefined;
  let motion: gsap.core.Timeline | undefined,
    robot: Group | undefined;
  let rightArm: Object3D | undefined, rightExtension: Object3D | undefined;
  let head: Object3D | undefined,
    neck: Object3D | undefined,
    upperNeck: Object3D | undefined,
    compartment: Object3D | undefined,
    bootPlant: Group | undefined,
    leftEye: Object3D | undefined,
    rightEye: Object3D | undefined;
  // A livelier WALL·E: eyes that follow the pointer, little idle glances, a dance when music plays,
  // headlights after dark and a compactor trick. All procedural, all inside his own update.
  let pointerX = 0, pointerY = 0, glance = 0, glanceAim = 0, nextIdle = 9, energy = 0, music = false, wantDance = 0;
  let lampLevel = 0, nightWatch = false, quipIndex = 0, cubeCount = 0;
  const lamps: Mesh[] = [];
  const cubes: Mesh[] = [];
  const onPointer = (event: PointerEvent) => {
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });
  const QUIPS = [
    "Directive: keep this room tidy. Progress: debatable.",
    "The plant is doing well. I water it with optimism.",
    "Psst. The TV over there has Minecraft.",
    "I counted the books. Twice. Still not read.",
    "If you find a Rubik's cube solved, it wasn't me.",
    "Have you tried the record player? It has opinions.",
    "Beep. That was a friendly beep.",
    "The newspaper on the table is fiction. Mostly.",
  ];
  const neutral = new Map<Object3D, { x: number; y: number; z: number }>();
  const neutralPositions = new Map<Object3D, Vector3>();
  const tint = (m: MeshStandardMaterial | MeshBasicMaterial) => {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCompanionNight = night;
      shader.fragmentShader =
        "uniform float uCompanionNight;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight = sRGBTransferOETF(vec4(outgoingLight * mix(vec3(1.), vec3(.07,.1,.17), uCompanionNight), 1.)).rgb;\n#include <opaque_fragment>",
      );
    };
    m.customProgramCacheKey = () => "wall-e-pbr-display-v2";
    materials.add(m);
    return m;
  };
  const chargingBay = createCompanionDock(env, night);
  const dock = chargingBay.root;
  dock.position.set(DOCK.x, 0, DOCK.z);
  root.add(dock);
  // Soft contact shade, shared floor level, no realtime shadow pass.
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const cx = c.getContext("2d")!;
  const grad = cx.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, "#00000080");
  grad.addColorStop(1, "#00000000");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 64, 64);
  const shadowTex = new CanvasTexture(c);
  textures.add(shadowTex);
  const shadowMat = new MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
  });
  materials.add(shadowMat);
  const shadowGeo = new PlaneGeometry(1.5, 1.5);
  geometries.add(shadowGeo);
  const shade = new Mesh(shadowGeo, shadowMat);
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = -0.064;
  carriage.add(shade);
  const say = (text: string) => {
    state.caption = text;
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => {
      if (!disposed) state.caption = "";
    }, 5500);
  };
  const resetPose = () => {
    if (bootPlant) {
      gsap.killTweensOf(bootPlant.position);
      bootPlant.position.z = 0.025;
    }
    state.plantOpen = false;
    if (compartment) gsap.killTweensOf(compartment.rotation);
    for (const [node, v] of neutral) node.rotation.set(v.x, v.y, v.z);
    for (const [node, v] of neutralPositions) node.position.copy(v);
  };
  function dockRobot(silent = false) {
    if (!state.ready) return;
    motion?.kill();
    resetPose();
    state.phase = "returning";
    if (!silent) say("Heading back to my charging bay.");
    motion = gsap
      .timeline({
        onComplete: () => {
          if (disposed) return;
          resetPose();
          state.phase = sleeping ? "sleeping" : "docked";
        },
      })
      .to(
        carriage.position,
        {
          x: DOCK.x,
          z: DOCK.z,
          duration: reduced.matches ? 0 : 1.6,
          ease: "power2.inOut",
        },
        reduced.matches ? 0 : 0.45,
      )
      .to(
        carriage.rotation,
        { y: 0, duration: reduced.matches ? 0 : 0.7, ease: "power2.out" },
        0,
      );
    if (robot) motion.to(robot.rotation, { z: 0, duration: 0.25 }, 0);
  }
  function greet(first = false) {
    if (!state.ready) {
      pendingWelcome = first;
      return;
    }
    sleeping = false;
    motion?.kill();
    resetPose();
    state.phase = "greeting";
    state.caption = "";
    const hello = () => say(
      first
        ? "Hello! Welcome to Mohith’s lab."
        : "Hello again. Take your time.",
    );
    motion = gsap
      .timeline({
        onComplete: () => {
          if (disposed) return;
          if (state.phase === "greeting") state.phase = "visiting";
          if (first) dockRobot(true);
        },
      })
      .to(
        carriage.position,
        {
          x: VISIT.x,
          z: VISIT.z,
          duration: reduced.matches ? 0 : 1.5,
          ease: "power2.inOut",
        },
        0,
      )
      .to(
        carriage.rotation,
        { y: -0.15, duration: reduced.matches ? 0 : 0.9, ease: "power2.out" },
        reduced.matches ? 0 : 1.5,
      );
    if (!reduced.matches && rightArm)
      motion.add(companionWave(rightArm, rightExtension, hello), 1.5);
    else motion.call(hello, [], reduced.matches ? 0 : 1.5);
    if (!reduced.matches && leftEye && rightEye) {
      motion
        .to(leftEye.rotation, { z: -0.18, duration: 0.45 }, 0.5)
        .to(rightEye.rotation, { z: 0.18, duration: 0.45 }, 0.5)
        .to(leftEye.rotation, { z: -0.1, duration: 0.6 }, 1.25)
        .to(rightEye.rotation, { z: 0.1, duration: 0.6 }, 1.25);
    }
    // A moment to read the greeting before the automatic first-visit return.
    motion.to({}, { duration: .8 });
  }
  function welcome() {
    if (welcomed) return;
    welcomed = true;
    pendingWelcome = true;
    if (state.ready) {
      pendingWelcome = false;
      greet(true);
    }
  }
  function farewell() {
    nightWatch = true;
    if (state.ready) {
      say("Lights out? I brought headlights.");
      dockRobot(true);
    }
  }
  function dance() {
    if (!state.ready || reduced.matches) return;
    motion?.kill();
    resetPose();
    state.phase = "visiting";
    wantDance = 7;
    say(music ? "This one is my jam." : "No music? I'll hum.");
  }
  /** The compactor trick: the hatch opens, a tidy cube of rubbish rolls out onto the apron. */
  function compact() {
    if (!state.ready || !compartment || !robot) return;
    motion?.kill();
    resetPose();
    state.phase = "visiting";
    cubeCount++;
    say(cubeCount === 1 ? "Directive: compact. One fresh cube, coming up." : "Cube number " + cubeCount + ". I'm on a roll.");
    const size = 0.11;
    const face = document.createElement("canvas");
    face.width = face.height = 64;
    const paint = face.getContext("2d")!;
    for (let i = 0; i < 90; i++) {
      paint.fillStyle = ["#6b5b45", "#8a7a5c", "#4f4a3e", "#a08a62", "#5d6b5a", "#b5a27a"][i % 6]!;
      paint.fillRect(Math.random() * 64, Math.random() * 64, 6 + Math.random() * 14, 3 + Math.random() * 8);
    }
    paint.strokeStyle = "#2b2620"; paint.lineWidth = 2; paint.strokeRect(1, 1, 62, 62);
    const texture = new CanvasTexture(face);
    textures.add(texture);
    const material = tint(new MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0.1, envMap: env, envMapIntensity: 0.3 }));
    const geometry = new BoxGeometry(size, size, size);
    geometries.add(geometry);
    const cube = new Mesh(geometry, material);
    const start = new Vector3();
    compartment.getWorldPosition(start);
    root.worldToLocal(start);
    cube.position.copy(start);
    cube.scale.setScalar(0.01);
    root.add(cube);
    cubes.push(cube);
    if (cubes.length > 4) { const old = cubes.shift()!; old.removeFromParent(); }
    const forward = new Vector3(0, 0, 1).applyQuaternion(carriage.quaternion);
    const land = carriage.position.clone().addScaledVector(forward, 0.42 + (cubeCount % 3) * 0.06);
    land.x += ((cubeCount % 2) * 2 - 1) * 0.12;
    gsap.timeline()
      .to(compartment.rotation, { x: (Math.PI * 95) / 180, duration: 0.5, ease: "power2.out" }, 0)
      .to(cube.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: "back.out(2)" }, 0.45)
      .to(cube.position, { x: land.x, z: land.z, duration: 0.7, ease: "power1.in" }, 0.75)
      .to(cube.position, { y: carriage.position.y + size / 2 + 0.01, duration: 0.7, ease: "bounce.out" }, 0.75)
      .to(cube.rotation, { y: Math.random() * 1.2 - 0.6, x: Math.PI / 2, duration: 0.7, ease: "power2.out" }, 0.75)
      .to(compartment.rotation, { x: 0, duration: 0.5, ease: "power2.inOut" }, 1.4);
  }
  function react(kind: "console" | "newspaper" | "music" | "art" | "lights") {
    if (!state.ready || state.caption) return;
    const lines = {
      console: ["Ooh, games. Can I be player two?", "Try the pinball. I believe in you."],
      newspaper: ["Read me the comics, please.", "The crossword answer is 'robot'. Probably."],
      music: ["Music! My treads are tapping.", "Is this lo-fi? I love lo-fi."],
      art: ["New drawing? Very modern. I'd hang it.", "That one looks like me. A bit."],
      lights: ["Lights on. Hello again, everyone.", "Ah, I can see the dust again."],
    }[kind];
    say(lines[Math.floor(Math.random() * lines.length)]!);
    glanceAim = (Math.random() - 0.5) * 0.6;
    glance = 1.4;
  }
  const interact = () => {
    state.panel = true;
    greet();
  };
  const togglePlant = () => {
    if (!compartment || !state.ready) return;
    motion?.kill();
    for (const node of [rightArm, rightExtension]) {
      if (!node) continue;
      const pose = neutral.get(node), position = neutralPositions.get(node);
      if (pose) node.rotation.set(pose.x, pose.y, pose.z);
      if (position) node.position.copy(position);
    }
    if (state.phase === "greeting" || state.phase === "returning") state.phase = "visiting";
    state.plantOpen = !state.plantOpen;
    state.panel = true;
    gsap.to(compartment.rotation, {
      x: state.plantOpen ? (Math.PI * 95) / 180 : 0,
      duration: reduced.matches ? 0 : 0.85,
      ease: "power2.inOut",
      overwrite: true,
      delay: state.plantOpen || reduced.matches ? 0 : 0.25,
    });
    // Present the boot on the lowered hatch, then tuck it safely inside before closing.
    if (bootPlant)
      gsap.to(bootPlant.position, {
        z: state.plantOpen ? 0.18 : 0.025,
        duration: reduced.matches ? 0 : 0.4,
        delay: state.plantOpen && !reduced.matches ? 0.55 : 0,
        ease: "power2.inOut",
        overwrite: true,
      });
    if (state.plantOpen) say("A little green hope.");
  };
  selectables.push({
    object: dock,
    outline: false,
    onSelect: () => dockRobot(),
  });
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
    "/models/wall-e-companion.glb",
    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((o) => {
          if (o instanceof Mesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              for (const value of Object.values(m))
                if (value instanceof Texture) value.dispose();
              m.dispose();
            }
          }
        });
        return;
      }
      robot = gltf.scene;
      robot.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(robot),
        size = bounds.getSize(new Vector3()),
        center = bounds.getCenter(new Vector3());
      const scale = 1.17 / size.y;
      const tracks = new Box3();
      robot.traverse((object) => {
        if (object instanceof Mesh && /track/i.test(object.name))
          tracks.expandByObject(object);
      });
      if (!tracks.isEmpty()) tracks.getCenter(center);
      robot.scale.multiplyScalar(scale);
      robot.position.set(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      );
      carriage.add(robot);
      bootPlant = createBootPlant();
      robot.add(bootPlant);
      selectables.push({ object: robot, outline: false, onSelect: interact });
      robot.traverse((object) => {
        const key = object.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (key === "controlheadpan") head = object;
        if (key === "controlneckpitch") neck = object;
        if (key === "controlupperneck") upperNeck = object;
        if (key === "controlcompactordoor") compartment = object;
        if (key === "controllefteyeroll") leftEye = object;
        if (key === "controlrighteyeroll") rightEye = object;
        if (key === "controlrightarmlift") rightArm = object;
        if (key === "controlrightarmextension") rightExtension = object;
        if (key.startsWith("control")) {
          neutral.set(object, {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
          });
          neutralPositions.set(object, object.position.clone());
        }
        if (object instanceof Mesh) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            if (
              !(material instanceof MeshStandardMaterial) ||
              materials.has(material)
            )
              continue;
            material.envMap = env;
            // Keep the GLTF's linear PBR factors and sRGB image tags intact.
            // This legacy room outputs linear display values: convert the lit result,
            // rather than lifting every dark material and texture before lighting.
            material.envMapIntensity = 0.55;
            if (
              material instanceof MeshPhysicalMaterial &&
              material.transmission > 0
            ) {
              material.transmission = 0;
              material.transparent = true;
              material.opacity = 0.055;
              material.side = FrontSide;
              material.clearcoat = 1;
              material.clearcoatRoughness = 0.12;
              material.depthWrite = false;
            }
            for (const value of Object.values(material))
              if (value instanceof Texture && value !== env) {
                value.anisotropy = 4;
                textures.add(value);
              }
            tint(material);
          }
        }
      });
      // The model arrives as about a hundred separate meshes. Joints that move (head, neck, eyes, arms,
      // the compactor door, the plant) stay separate; everything else merges, including inside each joint.
      const joints = new Set<Object3D>();
      robot.traverse(object => { if (object.name.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith("control")) joints.add(object); });
      if (bootPlant) joints.add(bootPlant);
      const keep = (item: BufferGeometry | Material) => {
        if (item instanceof BufferGeometry) geometries.add(item);
        else materials.add(item as MeshStandardMaterial | MeshBasicMaterial);
      };
      mergeStatic(robot, joints, keep);
      // Headlights: two soft beams from the eyes and a pool of light on the apron, all additive, no real lights.
      if (head && leftEye && rightEye) {
        const fade = document.createElement("canvas");
        fade.width = 4; fade.height = 128;
        const paint = fade.getContext("2d")!;
        const ramp = paint.createLinearGradient(0, 0, 0, 128);
        ramp.addColorStop(0, "#ffe9b822"); ramp.addColorStop(0.75, "#ffe9b8aa"); ramp.addColorStop(1, "#fff4d8ff");
        paint.fillStyle = ramp; paint.fillRect(0, 0, 4, 128);
        const beamTexture = new CanvasTexture(fade);
        textures.add(beamTexture);
        const scale = head.getWorldScale(new Vector3()).x || 1;
        const length = 0.9 / scale, radius = 0.17 / scale;
        const beamGeometry = new ConeGeometry(radius, length, 24, 1, true);
        beamGeometry.rotateX(-Math.PI / 2);
        beamGeometry.translate(0, 0, length / 2);
        geometries.add(beamGeometry);
        const beamMaterial = new MeshBasicMaterial({ map: beamTexture, color: 0xffe6b0, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
        materials.add(beamMaterial);
        for (const eye of [leftEye, rightEye]) {
          const at = eye.getWorldPosition(new Vector3());
          head.worldToLocal(at);
          const beam = new Mesh(beamGeometry, beamMaterial);
          beam.position.copy(at);
          beam.position.z += 0.02 / scale;
          beam.renderOrder = 4;
          head.add(beam);
          lamps.push(beam);
        }
        const poolCanvas = document.createElement("canvas");
        poolCanvas.width = poolCanvas.height = 64;
        const poolPaint = poolCanvas.getContext("2d")!;
        const glow = poolPaint.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, "#ffe7b0aa"); glow.addColorStop(1, "#ffe7b000");
        poolPaint.fillStyle = glow; poolPaint.fillRect(0, 0, 64, 64);
        const poolTexture = new CanvasTexture(poolCanvas);
        textures.add(poolTexture);
        const poolMaterial = new MeshBasicMaterial({ map: poolTexture, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
        materials.add(poolMaterial);
        const poolGeometry = new PlaneGeometry(0.9, 1.3);
        geometries.add(poolGeometry);
        const pool = new Mesh(poolGeometry, poolMaterial);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, 0.012, 0.95);
        carriage.add(pool);
        lamps.push(pool);
      }
      for (const joint of joints) if (joint !== bootPlant) mergeStatic(joint, new Set([...joints].filter(item => item !== joint)), keep);
      if (compartment)
        selectables.push({
          object: compartment,
          outline: false,
          onSelect: togglePlant,
        });
      state.ready = true;
      state.phase = "docked";
      ready();
      if (pendingWelcome) {
        pendingWelcome = false;
        greet(true);
      }
    },
    undefined,
    () => {
      if (!disposed) {
        state.failed = true;
        state.caption = "WALL·E is taking a little longer to arrive.";
      }
    },
  );
  const cameraLocal = new Vector3();
  const headLocal = new Vector3();
  return {
    root,
    selectables,
    welcome,
    greet: () => greet(),
    dock: () => dockRobot(),
    farewell,
    togglePlant,
    wake() {
      sleeping = false;
      nightWatch = false;
      if (state.ready) {
        state.phase = "docked";
        say("Lights on. Hello again.");
      }
    },
    dance,
    compact,
    react,
    say,
    setMusic(on: boolean) { music = on; },
    /** Where the guided tour starts and ends: just in front of him. */
    get position() { return carriage.position; },
    update(delta: number, camera: Camera) {
      if (disposed || !state.ready || document.hidden) return;
      const dt = Math.min(delta, 50) / 1000;
      elapsed += dt;
      // Follow the actual ramp, then the exterior apron; never float on the route.
      const support = dockTrackPose(carriage.position.z - DOCK.z);
      carriage.position.y = support.y;
      carriage.rotation.x = support.pitch;
      shade.position.y = 0.004;
      if (!reduced.matches && head && neck) {
        head.updateWorldMatrix(true, false);
        camera.getWorldPosition(cameraLocal);
        head.getWorldPosition(headLocal);
        robot?.worldToLocal(cameraLocal);
        robot?.worldToLocal(headLocal);
        cameraLocal.sub(headLocal);
        const yaw = sleeping
          ? 0
          : Math.max(
              -1.05,
              Math.min(1.05, Math.atan2(cameraLocal.x, cameraLocal.z)),
            );
        const follow = 1 - Math.exp(-dt * 3.5);
        // The pointer pulls his gaze a little; an idle glance now and then; the beat moves his head.
        if (!sleeping) {
          nextIdle -= dt;
          if (nextIdle <= 0 && state.phase !== "greeting" && wantDance <= 0) {
            nextIdle = 14 + Math.random() * 18;
            glanceAim = (Math.random() - 0.5) * 1.4;
            glance = 1.3;
            if (!state.caption && Math.random() < 0.35) say(QUIPS[quipIndex++ % QUIPS.length]!);
          }
        }
        glance = Math.max(0, glance - dt);
        const beat = Math.sin(elapsed * Math.PI * 2 * 1.55);
        const aim = yaw + (sleeping ? 0 : pointerX * 0.45) + (glance > 0 ? glanceAim : 0) + beat * 0.22 * energy;
        head.rotation.y += (Math.max(-1.2, Math.min(1.2, aim)) - head.rotation.y) * follow;
        const pitch = sleeping
          ? 0.36
          : Math.max(
              -0.9,
              Math.min(
                0.3,
                -Math.atan2(
                  cameraLocal.y,
                  Math.max(0.04, Math.hypot(cameraLocal.x, cameraLocal.z)),
                ),
              ),
            );
        const nod = Math.abs(beat) * 0.12 * energy;
        neck.rotation.x += ((pitch + (sleeping ? 0 : pointerY * 0.18)) * 0.6 + nod - neck.rotation.x) * follow;
        if (upperNeck)
          upperNeck.rotation.x += (pitch * 0.4 - upperNeck.rotation.x) * follow;
        if (leftEye && rightEye && state.phase !== "greeting") {
          leftEye.rotation.z +=
            ((sleeping ? 0.12 : -0.1 + Math.sin(elapsed * 0.8) * 0.012) -
              leftEye.rotation.z) *
            follow;
          rightEye.rotation.z +=
            (-leftEye.rotation.z - rightEye.rotation.z) * follow;
        }
      }
      // Dancing: a sway, a bounce and a waving arm, layered on top of his rest pose.
      wantDance = Math.max(0, wantDance - dt);
      const grooving = !reduced.matches && (wantDance > 0 || (music && !sleeping)) && (state.phase === "docked" || state.phase === "visiting");
      energy += ((grooving ? 1 : 0) - energy) * (1 - Math.exp(-dt * 2.5));
      if (robot && energy > 0.002) {
        const beat = Math.sin(elapsed * Math.PI * 2 * 1.55);
        robot.rotation.z = beat * 0.1 * energy;
        robot.rotation.y = Math.sin(elapsed * Math.PI * 0.775) * 0.35 * energy;
        carriage.position.y += Math.abs(beat) * 0.02 * energy;
        if (rightArm) {
          const rest = neutral.get(rightArm);
          if (rest) rightArm.rotation.x = rest.x + (Math.sin(elapsed * Math.PI * 1.55) * 0.8 - 0.55) * energy;
        }
      }
      // Headlights fade in after dark.
      const lampAim = nightWatch && night.value > 0.4 ? 1 : 0;
      lampLevel += (lampAim - lampLevel) * (1 - Math.exp(-dt * 2));
      for (const lamp of lamps) {
        lamp.visible = lampLevel > 0.01;
        (lamp.material as MeshBasicMaterial).opacity = lampLevel * (lamp.geometry instanceof PlaneGeometry ? 0.55 : 0.32);
      }
      chargingBay.led.color.setHex(
        sleeping ? 0x58694c : state.phase === "docked" ? 0xa9c297 : 0xd9b66f,
      );
    },
    dispose() {
      disposed = true;
      window.removeEventListener("pointermove", onPointer);
      motion?.kill();
      if (compartment) gsap.killTweensOf(compartment.rotation);
      if (bootPlant) gsap.killTweensOf(bootPlant.position);
      clearTimeout(captionTimer);
      chargingBay.dispose();
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      state.ready = false;
    },
  };
}

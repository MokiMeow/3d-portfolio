import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createWatch, createPhone, createHeadset } from '~/experiences/home/world/scene-3.devices';
import { disposeTree } from '../nightsky/runtime';
export const objects = [
    { id: 'walle', name: 'WALL·E', category: 'A familiar face', caption: 'Professional tidier, part-time philosopher.', detail: 'The companion from the room. Every well-earned scuff included.' },
    { id: 'watch', name: 'Apple Watch Ultra', category: 'Small, quite capable', caption: 'A little wrist-sized mission control.', detail: 'Titanium tones, an orange Action button and an Alpine Loop. Face readings are demo values.' },
    { id: 'phone', name: 'iPhone', category: 'Pocket universe', caption: 'A whole world. Currently on its charging stand.', detail: 'A familiar phone on its charging stand. Lock-screen messages and readings are demo content.' },
    { id: 'headset', name: 'Vision Pro', category: 'Space within space', caption: 'Inspecting a headset, inside a headset. Perfectly normal.', detail: 'Curved glass, a Light Seal, knit bands and a battery. A small portal with quite a few parts.' },
    { id: 'turntable', name: 'Record Turntable', category: 'After hours / side A', caption: 'A good idea, going around in circles.', detail: 'A simplified room model: vinyl grooves, a brass spindle and a lifted tonearm.' },
    { id: 'ps5', name: 'PlayStation 5', category: 'One more level', caption: 'Two white wings. A strong case for staying in.', detail: 'White wing panels, a glossy dark core and blue light seams. One more level awaits.' },
    { id: 'controller', name: 'DualSense', category: 'A familiar grip', caption: 'All those buttons. So many excellent excuses.', detail: 'A familiar silhouette, a smooth touchpad, twin sticks and a little blue glow.' },
] as const;
export type ObjectId = typeof objects[number]['id'];
export interface Model {
    root: THREE.Group;
    dispose: () => void;
}
type Kit = Parameters<typeof createWatch>[0];
function primitives(kit: Kit, root: THREE.Group) {
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    const material = (color: string, metalness = 0, roughness = .5): THREE.MeshStandardMaterial => {
        const key = color + metalness + roughness;
        let m = materials.get(key);
        if (!m) {
            m = new THREE.MeshStandardMaterial({ color, metalness, roughness, envMap: kit.envMap, envMapIntensity: .6 });
            materials.set(key, m);
            kit.materials.push(m);
        }
        return m;
    };
    const mesh = (geo: THREE.BufferGeometry, color: string, pos: readonly number[], metal = 0, rough = .5): THREE.Mesh => { kit.geometries.push(geo); const m = new THREE.Mesh(geo, material(color, metal, rough)); m.position.set(pos[0]!, pos[1]!, pos[2]!); root.add(m); return m; };
    const box = (size: readonly number[], pos: readonly number[], color: string, r = .006): THREE.Mesh => {
        const [w, h, d] = size as readonly [
            number,
            number,
            number
        ];
        const radius = Math.min(r, w / 2, h / 2);
        const s = new THREE.Shape();
        s.moveTo(-w / 2 + radius, -h / 2);
        s.lineTo(w / 2 - radius, -h / 2);
        s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + radius);
        s.lineTo(w / 2, h / 2 - radius);
        s.quadraticCurveTo(w / 2, h / 2, w / 2 - radius, h / 2);
        s.lineTo(-w / 2 + radius, h / 2);
        s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - radius);
        s.lineTo(-w / 2, -h / 2 + radius);
        s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + radius, -h / 2);
        const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 6 });
        g.translate(0, 0, -d / 2);
        return mesh(g, color, pos);
    };
    const cylinder = (radius: number, height: number, pos: readonly number[], color: string, metal = 0): THREE.Mesh => mesh(new THREE.CylinderGeometry(radius, radius, height, 40), color, pos, metal);
    const tube = (points: number[][], radius: number, color: string): THREE.Mesh => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2]))), 24, radius, 8, false), color, [0, 0, 0], .7);
    return { mesh, box, cylinder, tube, material };
}
function consoleModel(kit: Kit): THREE.Group {
    const root = new THREE.Group();
    const { mesh, box, cylinder } = primitives(kit, root);
    cylinder(.075, .012, [0, .006, 0], '#111214');
    box([.25, .36, .066], [-.004, .2, 0], '#0b0c0e', .012);
    const s = new THREE.Shape();
    s.moveTo(-.124, .018);
    s.lineTo(.112, .018);
    s.quadraticCurveTo(.096, .2, .137, .404);
    s.quadraticCurveTo(.01, .398, -.118, .392);
    s.quadraticCurveTo(-.136, .2, -.124, .018);
    for (const side of [-1, 1]) {
        mesh(new THREE.ExtrudeGeometry(s, { depth: .009, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 3, curveSegments: 24 }), '#f1f1ee', [0, 0, side * .041 - (side < 0 ? .009 : 0)]);
        const light = box([.0035, .33, .002], [.121, .2, side * .0355], '#3f7bff');
        (light.material as THREE.MeshStandardMaterial).emissive.set('#3f7bff');
    }
    for (let i = 0; i < 9; i++)
        box([.2, .0025, .004], [-.01, .381, -.024 + i * .006], '#030304', 0);
    box([.003, .007, .014], [.12, .27, 0], '#020203');
    box([.003, .004, .009], [.12, .25, 0], '#020203');
    box([.002, .11, .002], [.12, .12, 0], '#26272b');
    root.rotation.y = -.65;
    return root;
}
function controllerModel(kit: Kit): THREE.Group {
    const root = new THREE.Group();
    const { mesh, box, cylinder } = primitives(kit, root);
    const s = new THREE.Shape();
    s.moveTo(0, .04);
    s.bezierCurveTo(.035, .042, .06, .042, .072, .03);
    s.bezierCurveTo(.086, .012, .09, -.03, .084, -.056);
    s.bezierCurveTo(.078, -.076, .055, -.078, .046, -.058);
    s.bezierCurveTo(.038, -.04, .025, -.028, 0, -.028);
    s.bezierCurveTo(-.025, -.028, -.038, -.04, -.046, -.058);
    s.bezierCurveTo(-.055, -.078, -.078, -.076, -.084, -.056);
    s.bezierCurveTo(-.09, -.03, -.086, .012, -.072, .03);
    s.bezierCurveTo(-.06, .042, -.035, .042, 0, .04);
    const geometry = new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelThickness: .009, bevelSize: .007, bevelSegments: 4, curveSegments: 20 });
    geometry.center();
    mesh(geometry, '#f1f1ee', [0, 0, 0]);
    box([.07, .03, .006], [0, -.016, .017], '#111214');
    box([.062, .036, .004], [0, .016, .02], '#f4f4f1');
    for (const side of [-1, 1]) {
        const seam = box([.0025, .03, .001], [side * .033, .016, .0225], '#3f7bff');
        (seam.material as THREE.MeshStandardMaterial).emissive.set('#3f7bff');
        cylinder(.0105, .012, [side * .024, -.018, .024], '#18191b').rotation.x = Math.PI / 2;
        box([.035, .008, .018], [side * .05, .037, -.002], '#1b1c20');
    }
    for (const [x, y] of [[.06, .012], [.05, .001], [.07, .001], [.06, -.01]])
        cylinder(.0045, .004, [x!, y!, .02], '#1a1a1c').rotation.x = Math.PI / 2;
    box([.016, .005, .003], [-.06, 0, .021], '#1a1a1c');
    box([.005, .016, .003], [-.06, 0, .021], '#1a1a1c');
    return root;
}
function turntableModel(kit: Kit): THREE.Group {
    const root = new THREE.Group();
    const { mesh, box, cylinder, tube } = primitives(kit, root);
    box([1.5, .115, .73], [0, .12, 0], '#bab7a0', .028);
    box([1.46, .055, .69], [0, .04, 0], '#72523c', .02);
    for (const x of [-.61, .61])
        for (const z of [-.25, .25])
            cylinder(.045, .055, [x, 0, z], '#252928');
    cylinder(.32, .035, [-.25, .19, 0], '#a49b76', .7);
    cylinder(.307, .016, [-.25, .216, 0], '#191d1b');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#191d1b';
        ctx.beginPath();
        ctx.arc(256, 256, 255, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#343832';
        ctx.lineWidth = 1;
        for (let r = 101; r < 249; r += 5) {
            ctx.beginPath();
            ctx.arc(256, 256, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    kit.textures.push(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: .36, metalness: .15 });
    kit.materials.push(material);
    const grooves = mesh(new THREE.PlaneGeometry(.614, .614), '#fff', [-.25, .225, 0]);
    grooves.material = material;
    grooves.rotation.x = -Math.PI / 2;
    cylinder(.097, .003, [-.25, .23, 0], '#b96545');
    box([.12, .004, .018], [-.25, .233, 0], '#dcc8a2');
    cylinder(.011, .028, [-.25, .239, 0], '#bba26a', .8);
    cylinder(.065, .095, [.42, .23, -.22], '#252928');
    cylinder(.022, .07, [.42, .29, -.22], '#bba26a', .8);
    tube([[.42, .33, -.29], [.42, .342, -.12], [.47, .336, .08], [.56, .33, .26]], .013, '#bba26a');
    cylinder(.05, .085, [.42, .33, -.295], '#72746d').rotation.x = Math.PI / 2;
    box([.08, .04, .11], [.56, .321, .26], '#252928');
    tube([[.56, .312, .26], [.56, .272, .28]], .0025, '#bba26a');
    tube([[.60, .34, .28], [.65, .35, .28], [.67, .368, .26]], .005, '#bba26a');
    cylinder(.028, .02, [.61, .195, .23], '#b26e45');
    root.rotation.x = .15;
    return root;
}
/** Static material batches keep WALL·E's 91 primitives below 30 calls, including while exploding.
 * Recenter each batch so the explosion can move real geometry away from its original centre.
 */
/** A cancellable browser turn keeps preparation out of a single long input-blocking task. */
function yieldTurn(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const abort = (): void => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            reject(new DOMException('Object preparation cancelled', 'AbortError'));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort);
            resolve();
        }, 0);
        if (signal?.aborted)
            abort();
        else
            signal?.addEventListener('abort', abort, { once: true });
    });
}
async function batch(source: THREE.Group, signal?: AbortSignal): Promise<THREE.Group> {
    const root = new THREE.Group();
    const transient = new Set<THREE.BufferGeometry>();
    let budgetStart = performance.now();
    const breathe = async (): Promise<void> => {
        signal?.throwIfAborted();
        if (performance.now() - budgetStart < 4)
            return;
        await yieldTurn(signal);
        budgetStart = performance.now();
    };
    try {
        signal?.throwIfAborted();
        source.updateMatrixWorld(true);
        const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
        const nodes: THREE.Mesh[] = [];
        source.traverse(node => { if (node instanceof THREE.Mesh)
            nodes.push(node); });
        for (const node of nodes) {
            const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
            transient.add(geometry);
            geometry.applyMatrix4(node.matrixWorld);
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            const groups = geometry.groups.length && mats.length > 1 ? geometry.groups : [{ start: 0, count: geometry.getAttribute('position').count, materialIndex: 0 }];
            for (const group of groups) {
                const part = new THREE.BufferGeometry();
                transient.add(part);
                for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
                    const attr = geometry.getAttribute(name), array = new Float32Array(group.count * size);
                    for (let i = 0; i < group.count; i++) {
                        const index = group.start + i;
                        array[i * size] = attr?.getX(index) ?? 0;
                        array[i * size + 1] = attr?.getY(index) ?? 0;
                        if (size === 3)
                            array[i * size + 2] = attr?.getZ(index) ?? 0;
                        if (i > 0 && i % 12288 === 0)
                            await breathe();
                    }
                    part.setAttribute(name, new THREE.BufferAttribute(array, size));
                }
                const mat = mats[group.materialIndex ?? 0]!;
                const bucket = buckets.get(mat) ?? [];
                bucket.push(part);
                buckets.set(mat, bucket);
            }
            geometry.dispose();
            transient.delete(geometry);
            await breathe();
        }
        for (const [material, parts] of buckets) {
            const merged = mergeGeometries(parts, false);
            parts.forEach(part => { part.dispose(); transient.delete(part); });
            if (!merged)
                continue;
            merged.computeBoundingBox();
            const centre = merged.boundingBox!.getCenter(new THREE.Vector3());
            merged.translate(-centre.x, -centre.y, -centre.z);
            const mesh = new THREE.Mesh(merged, material);
            mesh.position.copy(centre);
            root.add(mesh);
            await breathe();
        }
        const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
        const scale = 2.35 / Math.max(size.x, size.y, size.z, .001);
        // Bake normalization too: all mesh offsets are in stage units, useful for explode.
        for (const node of root.children) {
            if (node instanceof THREE.Mesh) {
                node.geometry.scale(scale, scale, scale);
                node.position.sub(centre).multiplyScalar(scale);
            }
            await breathe();
        }
        return root;
    }
    catch (error) {
        transient.forEach(geometry => geometry.dispose());
        root.traverse(node => { if (node instanceof THREE.Mesh)
            node.geometry.dispose(); });
        throw error;
    }
}
export async function loadModel(id: ObjectId, envMap: THREE.Texture, signal?: AbortSignal): Promise<Model> {
    const kit: Kit = { geometries: [], materials: [], textures: [], envMap };
    let source: THREE.Group;
    try {
        if (id === 'walle') {
            const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/wall-e-companion.glb');
            source = gltf.scene;
            source.traverse(node => {
                if (!(node instanceof THREE.Mesh))
                    return;
                kit.geometries.push(node.geometry);
                for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
                    kit.materials.push(m);
                    if (m instanceof THREE.MeshStandardMaterial) {
                        m.envMap = envMap;
                        m.envMapIntensity = .55;
                        if (m instanceof THREE.MeshPhysicalMaterial && m.transmission > 0) {
                            m.transmission = 0;
                            m.transparent = true;
                            m.opacity = .055;
                            m.side = THREE.FrontSide;
                            m.clearcoat = 1;
                            m.clearcoatRoughness = .12;
                            m.depthWrite = false;
                        }
                    }
                    for (const value of Object.values(m))
                        if (value instanceof THREE.Texture && value !== envMap) {
                            value.anisotropy = 4;
                            kit.textures.push(value);
                        }
                }
            });
        }
        else if (id === 'watch')
            source = createWatch(kit).group;
        else if (id === 'phone')
            source = createPhone(kit).group;
        else if (id === 'headset')
            source = createHeadset(kit).group;
        else if (id === 'ps5')
            source = consoleModel(kit);
        else if (id === 'controller')
            source = controllerModel(kit);
        else
            source = turntableModel(kit);
        const root = await batch(source, signal);
        // Original room device colours were compensated for a linear output pipeline.
        // Undo that compensation when using this window's standard sRGB renderer.
        if (['watch', 'phone', 'headset'].includes(id))
            for (const material of kit.materials)
                if (material instanceof THREE.MeshStandardMaterial)
                    material.color.convertSRGBToLinear();
        new Set(kit.geometries).forEach(g => g.dispose());
        kit.geometries.length = 0;
        let disposed = false;
        return { root, dispose: () => {
                if (disposed)
                    return;
                disposed = true;
                disposeTree(root, envMap);
                new Set(kit.materials).forEach(m => m.dispose());
                new Set(kit.textures).forEach(t => t.dispose());
            } };
    }
    catch (error) {
        new Set(kit.geometries).forEach(g => g.dispose());
        new Set(kit.materials).forEach(m => m.dispose());
        new Set(kit.textures).forEach(t => t.dispose());
        throw error;
    }
}

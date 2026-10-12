import gsap from "gsap";
import {
	BoxGeometry,
	Color,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	Vector3,
	type BufferGeometry,
	type Material,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SelectableObject } from "~/common/models/experience-interaction.model";

// Measured centre of the frontmost left-wall plate in scene_1/model.glb.
// Its original face spans y=1.9305–2.1200 and z=2.7199–2.9186.
export const LIGHT_SWITCH_POSITION = new Vector3(-3.198, 2.025253, 2.819239);

export function createWallLightSwitch(scene: Group, onSelect: () => void) {
	const group = new Group();
	group.name = "wall_light_switch";
	group.position.copy(LIGHT_SWITCH_POSITION);
	// Model the fitting in XY; its local +Z then faces into the room (+X).
	group.rotation.y = Math.PI / 2;
	const geometries: BufferGeometry[] = [];
	const materials: Material[] = [];
	const dayColors = new Map<MeshBasicMaterial, Color>();

	const geometry = <T extends BufferGeometry>(value: T) => {
		const normals = value.getAttribute("normal");
		if (normals) {
			const shades = new Float32Array(normals.count * 3);
			for (let i = 0; i < normals.count; i++) {
				const shade = 0.7 + Math.max(0, normals.getZ(i)) * 0.24 + Math.max(0, normals.getY(i)) * 0.06;
				shades.set([shade, shade, shade], i * 3);
			}
			value.setAttribute("color", new Float32BufferAttribute(shades, 3));
		}
		geometries.push(value);
		return value;
	};
	const material = (color: string) => {
		// The room renders baked colour in linear output space. Match that
		// treatment and shade the bevels without adding lights or shadow passes.
		const value = new MeshBasicMaterial({
			color: new Color(color).convertLinearToSRGB(),
			vertexColors: true,
		});
		materials.push(value);
		dayColors.set(value, value.color.clone());
		return value;
	};
	const shell = material("#8e8176");
	const ivory = material("#aca095");
	const recess = material("#494039");
	const seam = material("#5a4d45");
	const rounded = (width: number, height: number, depth: number, radius: number) =>
		geometry(new RoundedBoxGeometry(width, height, depth, 3, radius));

	// A thin back seam seats the new cover on the original plate. The cover
	// conceals the old socket face without altering the room's baked geometry.
	const gasket = new Mesh(rounded(0.21, 0.201, 0.004, 0.0018), seam);
	gasket.position.z = -0.007;
	const faceplate = new Mesh(rounded(0.208, 0.199, 0.02, 0.006), shell);
	const well = new Mesh(rounded(0.122, 0.15, 0.006, 0.0025), recess);
	well.position.z = 0.012;

	const pivot = new Group();
	pivot.position.z = 0.022;
	pivot.rotation.x = -0.11;
	const rocker = new Mesh(rounded(0.108, 0.136, 0.016, 0.004), ivory);
	rocker.name = "wall_light_switch_rocker";
	// A quiet engraved mark makes the moving paddle legible up close.
	const mark = new Mesh(geometry(new PlaneGeometry(0.024, 0.002)), seam);
	mark.position.set(0, -0.042, 0.0082);
	pivot.add(rocker, mark);
	group.add(gasket, faceplate, well, pivot);

	// A little finger room around this fitting, never across the adjacent outlet.
	const hitMaterial = new MeshBasicMaterial({ visible: false });
	materials.push(hitMaterial);
	const hit = new Mesh(geometry(new BoxGeometry(0.265, 0.26, 0.05)), hitMaterial);
	hit.name = "wall_light_switch_hit";
	hit.position.z = 0.018;
	group.add(hit);
	scene.add(group);

	const selectables: SelectableObject[] = [gasket, faceplate, well, rocker, mark, hit].map(
		(object) => ({ object, onSelect }),
	);

	return {
		selectables,
		setOn(on: boolean) {
			for (const [value, day] of dayColors) {
				gsap.to(value.color, {
					r: day.r * (on ? 1 : 0.12),
					g: day.g * (on ? 1 : 0.16),
					b: day.b * (on ? 1 : 0.3),
					duration: 1.1,
					ease: "power2.inOut",
					overwrite: true,
				});
			}
			gsap.to(pivot.rotation, {
				x: on ? -0.11 : 0.11,
				duration: 0.18,
				ease: "power2.out",
				overwrite: true,
			});
		},
		dispose() {
			gsap.killTweensOf(pivot.rotation);
			for (const value of dayColors.keys()) gsap.killTweensOf(value.color);
			group.removeFromParent();
			geometries.forEach((value) => value.dispose());
			materials.forEach((value) => value.dispose());
		},
	};
}


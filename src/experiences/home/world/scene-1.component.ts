import {
	BackSide,
	Color,
	Material,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	ShaderMaterial,
	Vector2,
	WebGLRenderTarget,
	type Object3DEventMap,
	CatmullRomCurve3,
	PerspectiveCamera,
	Vector3,
	Box3,
	CanvasTexture,
	PlaneGeometry,
	Raycaster,
	SRGBColorSpace,
} from "three";
import gsap from "gsap";

// BLUEPRINTS
import { SceneComponentBlueprint } from "../blueprints/scene-component.blueprint";

// SHADERS
import bakedTextureFragment from "./shaders/scene-1/lights/fragment.glsl";
import bakedTextureVertex from "./shaders/scene-1/lights/vertex.glsl";

import coffeeSteamFragment from "./shaders/scene-1/coffeeSteam/fragment.glsl";
import coffeeSteamVertex from "./shaders/scene-1/coffeeSteam/vertex.glsl";

// CONFIGS
import { Config } from "~/config";
import { DeviceConfig } from "~/config/device.config";

// STATIC
import { DESTRUCTED } from "~/static/event.static";
import { pages } from "~/static";

// MODELS
import type {
	Materials,
	ModelChildrenMaterials,
} from "~/common/models/experience-world.model";
import type { ViewLimits } from "~/common/models/experience-navigation.model";
import type { BoardNoteDetails } from "~/common/models/board-note.model";
import type { SelectableObject } from "~/common/models/experience-interaction.model";

// PROPS
import { createDeskProps } from "./scene-1.props";
import { createWallLightSwitch, LIGHT_SWITCH_POSITION } from "./scene-1.light-switch";
import { createInteractiveDrawers } from "./scene-1.drawers";
import { createAtelier } from "./scene-1.atelier";
import { initialAtelierState, type AtelierAction, type AtelierState, type AtelierView } from "~/common/models/atelier.model";

export class Scene1Component extends SceneComponentBlueprint {
	private readonly _renderer = this._experience.renderer;
	private readonly _appTime = this._experience.app.time;
	private readonly _camera = this._experience.camera;

	private _initialPcTopArticulation?: Object3D;
	private _initialPcScreenAspect = 0;

	public readonly colors = {
		monitor_a_screen: "#ffffff",
		monitor_b_screen: "#ffffff",
		pocketComputerScreen: "#b2e0ff",
		phoneScreen: "#50cdff",
		fixedComputerLed: "#50cdff",
		coffeeSteam: "#b7a08e",
	};
	public readonly lightsBakedTextureStrength = {
		r: 0.5,
		g: 1,
		b: 1.8,
	};
	public readonly woodsLightsBakedTextureStrength = {
		r: 1,
		g: 1,
		b: 1.5,
	};

	public readonly navigationLimits: ViewLimits = {
		spherical: {
			radius: { min: 10, max: 19.2 },
			phi: { min: 0.01, max: Math.PI * 0.5 },
			theta: { min: 0, max: Math.PI * 0.5 },
			enabled: true,
			enabledPhi: true,
			enabledTheta: true,
		},
		target: {
			x: { min: -1.5, max: 1.5 },
			y: { min: 0, max: 3.5 },
			z: { min: -1.5, max: 1.5 },
			enabled: true,
		},
	};
	public readonly cameraPath = new CatmullRomCurve3(
		[
			new Vector3(0, 5.5, 19),
			new Vector3(12, 10, 12),
			new Vector3(19, 5.5, 0),
			new Vector3(12, 3.7, 12),
			new Vector3(0, 4.2, 19),
		],
		false,
		"centripetal",
		1
	);
	public readonly center = new Vector3(0, 2.5, 0);

	public timeline = gsap.timeline();
	public pcScreenProjectedCamera =
		this._camera?.cameras[1] ?? new PerspectiveCamera();
	public keyboards?: Object3D;
	public fixedComputer?: Object3D;
	public pcTopArticulation?: Object3D;
	public pcScreenWebglTexture = new WebGLRenderTarget(
		DeviceConfig.DEVICE === "pc" ? 768 : 512,
		DeviceConfig.DEVICE === "pc" ? 768 : 512
	);
	public pcScreen?: Mesh;
	public phoneScreen?: Mesh;
	public monitorAScreen?: Mesh;
	public monitorBScreen?: Mesh;
	public treeOutside?: Object3D;
	public coffeeSteam?: Mesh;
	private readonly _boardNotes: Mesh[] = [];
	private _deskProps?: ReturnType<typeof createDeskProps>;

	private _lightSwitch?: ReturnType<typeof createWallLightSwitch>;
	private _drawers?: ReturnType<typeof createInteractiveDrawers>;
	private _atelier?: ReturnType<typeof createAtelier>;
	private readonly _atelierState = useState<AtelierState>("atelierState", initialAtelierState);
	public lightsOn = true;
	/** Shared by the room and wood materials: 0 by day, 1 with the lights off. */
	private readonly _night = { value: 0 };
	private readonly _boardNoteTextures: CanvasTexture[] = [];
	private readonly _boardNoteMaterials: MeshBasicMaterial[] = [];
	private readonly _boardNoteGeometries: PlaneGeometry[] = [];

	// Picking in the guided view. The free camera has its own outline-based
	// interactions; this makes the same things answer a click without leaving
	// the guided view first.
	private readonly _picker = new Raycaster();
	private readonly _pickerCoord = new Vector2();
	private _pickerHovered?: SelectableObject;
	private _pickerPressed?: { x: number; y: number; target?: SelectableObject };

	private _pick(e: PointerEvent) {
		const exp = this._experience;
		const camera = exp.camera?.instance;

		if (
			!this.modelScene ||
			!camera ||
			!exp.cameraAnimation?.enabled ||
			exp.camera?.currentCameraIndex !== 0 ||
			exp.router?.currentRouteKey !== pages.HOME_PAGE ||
			exp.navigation?.timeline.isActive() ||
			exp.world?.manager?.timeline.isActive() ||
			!(e.target instanceof Element) ||
			e.target.closest("a, button, input, textarea, select, iframe, [role='dialog']")
		)
			return undefined;

		if (!this.selectableObjects.length) this.initSelectableObjects();

		this._pickerCoord.set(
			(e.clientX / window.innerWidth) * 2 - 1,
			-(e.clientY / window.innerHeight) * 2 + 1
		);
		this._picker.setFromCamera(this._pickerCoord, camera);

		// Only the nearest surface counts, so the chair or a wall still blocks what is behind it.
		// The coffee's steam is a see-through plane, so it does not block anything.
		const hit = this._picker
			.intersectObject(this.modelScene, true)
			.find((item) => {
				if (item.object === this.coffeeSteam) return false;
				let object: Object3D | null = item.object;
				while (object) { if (!object.visible) return false; object = object.parent; }
				return true;
			})?.object;
		return hit
			? this.selectableObjects.find((item) => item.object === hit)
			: undefined;
	}

	private readonly _onGuidedMove = (e: PointerEvent) => {
		if (e.pointerType !== "mouse") return;

		const target = this._pick(e);
		if (target === this._pickerHovered) return;

		this._pickerHovered?.onHover?.(false);
		target?.onHover?.(true);
		this._pickerHovered = target;
		document.documentElement.style.cursor = target ? "pointer" : "";
	};

	private readonly _onGuidedDown = (e: PointerEvent) => {
		if (!e.isPrimary) return;
		this._pickerPressed = { x: e.clientX, y: e.clientY, target: this._pick(e) };
	};

	private readonly _onGuidedUp = (e: PointerEvent) => {
		const pressed = this._pickerPressed;
		this._pickerPressed = undefined;
		if (!pressed?.target || !e.isPrimary) return;

		const dx = e.clientX - pressed.x;
		const dy = e.clientY - pressed.y;
		if (dx * dx + dy * dy > 64 || this._pick(e) !== pressed.target) return;

		const { onSelect, link, externalLink } = pressed.target;
		if (onSelect) onSelect();
		else if (link) void useRouter().push(link);
		else if (externalLink) window.open(externalLink, "_blank", "noopener");
	};

	constructor() {
		const t = useI18n().t;
		super({
			modelName: "scene_1",
			childrenMaterials: {
				scene_1_room: "room",
				chair_top: "room",
				pc_top: "room",
				scene_1_woods: "wood",
				coffee_steam: "coffee_steam",
				window_glasses: "glass",
				scene_1_floor: "scene_container",
				monitor_a_screen: "monitor_a",
				monitor_b_screen: "monitor_b",
				scene_1_phone_screen: "phone_screen",
				pc_top_screen: "pc_screen",
				tree: "tree",
				...(() => {
					const results: ModelChildrenMaterials = {};
					const keys = ["top", "front", "back", "left", "right"];
					for (let i = 0; i < keys.length; i++) {
						keys[i];
						results[`tree_cube_${keys[i]}`] = "tree";
						results[`tree_cube_${keys[i]}_clone`] = "tree_outside";
					}

					return results;
				})(),
			},
			markers: [
				{
					icon: "💡",
					content: t("isThatAPortal"),
					position: new Vector3(-2.11, 3.17, -1.52),
				},
				{
					icon: "💡",
					content: t("hardcoreCoding"),
					position: new Vector3(-0.7, 3.26, -2.22),
				},
				{
					icon: "💡",
					content: t("heavyProcess"),
					position: new Vector3(-2.7, 3.17, 0.08),
				},
				{
					icon: "💡",
					content: t("mobileDevelopment"),
					position: new Vector3(-2.34, 2.49, 0.34),
				},
				{
					icon: "❔",
					content: t("itEmpty"),
					position: new Vector3(-0.38, 4.7, -2.78),
				},
				{
					icon: "❤",
					content: t("friendGift"),
					position: new Vector3(-2.85, 4.3, 0.8),
				},
				{
					icon: "❔",
					content: t("sawSomething"),
					position: new Vector3(2.08, 3.11, -2.92),
				},
				{
					icon: "🧩",
					content: t("rubiksCube"),
					position: new Vector3(0.5, 2.58, -2.12),
				},
				{
					icon: "💡",
					content: t("newtonsCradle"),
					position: new Vector3(0.3, 2.3, -1.47),
				},
				{
					icon: "🌙",
					content: t("lightSwitch"),
					position: LIGHT_SWITCH_POSITION.clone().add(new Vector3(0.05, 0.36, 0)),
				},
			],
			onTraverseModelScene: (child) => {
				this._setSceneObjects(child);
			},
		});
	}

	public get isPcOpen() {
		return (
			this.pcTopArticulation?.rotation.z !==
			this._initialPcTopArticulation?.rotation.z
		);
	}

	private _setSceneObjects(item: Object3D<Object3DEventMap>) {
		if (!this.modelScene || !this._model) return;

		if (item instanceof Object3D && item.name === "pc_top_articulation") {
			this._initialPcTopArticulation = item.clone();
			this.pcTopArticulation = item;
		}

		if (!(item instanceof Mesh)) return;

		if (item.name === "pc_top_screen") {
			this.pcScreen = item;

			const boundingBox = new Box3().setFromObject(this.pcScreen);
			const width = boundingBox.max.x - boundingBox.min.x;
			const height = boundingBox.max.y - boundingBox.min.y;
			this._initialPcScreenAspect = width / height;
		}
		if (item.name === "coffee_steam") this.coffeeSteam = item;
		if (item.name === "scene_1_phone_screen") this.phoneScreen = item;
		if (item.name === "monitor_a_screen") this.monitorAScreen = item;
		if (item.name === "monitor_b_screen") this.monitorBScreen = item;

		if (
			new RegExp(/^tree_cube_/, "ig").test(item.name) &&
			!new RegExp(/_clone$/, "ig").test(item.name)
		) {
			const clone = item.clone();
			clone.name = `${clone.name}_clone`;

			this.treeOutside?.add(clone);
		}
	}

	protected _getAvailableMaterials(): Materials {
		const availableTextures = this._loader?.availableTextures;
		const availableMaterials: Materials = {};

		if (!availableTextures) return availableMaterials;

		// MATERIALS
		if (this._world?.commonMaterials.scene_container)
			availableMaterials.scene_container =
				this._world?.commonMaterials.scene_container;
		if (this._world?.commonMaterials.scene_container)
			availableMaterials.glass = this._world?.commonMaterials.glass;

		availableMaterials.pc_screen = new MeshBasicMaterial({
			map: this.pcScreenWebglTexture?.texture,
		});
		availableMaterials.phone_screen = new MeshBasicMaterial({
			map: availableTextures.phone_screen_record,
		});
		availableMaterials.monitor_a = new MeshBasicMaterial({
			map: availableTextures.monitor_a_screen_record,
		});
		availableMaterials.monitor_b = new MeshBasicMaterial({
			map: availableTextures.monitor_b_screen_record,
		});
		availableMaterials.tree = new MeshBasicMaterial({
			map: availableTextures.scene_1_tree_baked_texture,
			transparent: true,
		});
		availableMaterials.room = new ShaderMaterial({
			uniforms: {
				uBakedTexture: {
					value: availableTextures.scene_1_no_lights_baked_texture,
				},
				uBakedLightTexture: {
					value: availableTextures.scene_1_lights_baked_texture,
				},

				uRedAccent: { value: new Color(this.colors.pocketComputerScreen) },
				uRedAccentStrength: { value: this.lightsBakedTextureStrength.r },

				uGreenAccent: { value: new Color(this.colors.monitor_b_screen) },
				uGreenAccentStrength: { value: this.lightsBakedTextureStrength.g },

				uBlueAccent: { value: new Color(this.colors.fixedComputerLed) },
				uBlueAccentStrength: { value: this.lightsBakedTextureStrength.b },
				uNight: this._night,
			},
			fragmentShader: bakedTextureFragment,
			vertexShader: bakedTextureVertex,
		});
		availableMaterials.wood = new ShaderMaterial({
			uniforms: {
				uBakedTexture: {
					value: availableTextures.scene_1_woods_no_lights_baked_texture,
				},
				uBakedLightTexture: {
					value: availableTextures.scene_1_woods_lights_baked_texture,
				},

				uRedAccent: { value: new Color(this.colors.monitor_a_screen) },
				uRedAccentStrength: { value: this.woodsLightsBakedTextureStrength.r },

				uGreenAccent: { value: new Color(this.colors.monitor_b_screen) },
				uGreenAccentStrength: { value: this.woodsLightsBakedTextureStrength.g },

				uBlueAccent: { value: new Color(this.colors.phoneScreen) },
				uBlueAccentStrength: { value: this.woodsLightsBakedTextureStrength.b },
				uNight: this._night,
			},
			fragmentShader: bakedTextureFragment,
			vertexShader: bakedTextureVertex,
		});
		availableMaterials.coffee_steam = new ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uTimeFrequency: { value: 0.0005 },
				uUvFrequency: { value: new Vector2(4, 5) },
				uColor: { value: new Color(this.colors.coffeeSteam) },
			},
			fragmentShader: coffeeSteamFragment,
			vertexShader: coffeeSteamVertex,
			transparent: true,
			depthWrite: false,
		});
		availableMaterials.tree_outside = new MeshBasicMaterial({
			colorWrite: false,
			side: BackSide,
		});

		return availableMaterials;
	}

	public construct() {
		super.construct(() => {
			this.treeOutside = new Object3D();
			(this.keyboards = new Object3D()).position.set(-1.5, 1.2, -1.1);
			(this.fixedComputer = new Object3D()).position.set(0, 1, -3);

			this.modelScene?.add(
				this.treeOutside,
				this.keyboards,
				this.fixedComputer
			);

			this._createBoardNotes();
			if (!this._deskProps && this.modelScene) this._deskProps = createDeskProps(this.modelScene);
			this._createLightSwitch();

			window.addEventListener("pointermove", this._onGuidedMove);
			window.addEventListener("pointerdown", this._onGuidedDown);
			window.addEventListener("pointerup", this._onGuidedUp);
		});
		if (this.modelScene) this._drawers = createInteractiveDrawers(this.modelScene);
	}

	private _createLightSwitch() {
		if (!this.modelScene || this._lightSwitch) return;
		this._lightSwitch = createWallLightSwitch(this.modelScene, () => this.toggleLights());
	}

	/**
	 * Good night: the lamps and both monitors go out, and the room is left with
	 * the window, the little lights on the machines, and the cube's stand.
	 */
	public toggleLights() {
		this.lightsOn = !this.lightsOn;
		const on = this.lightsOn;
		const tween = { duration: 1.1, ease: "power2.inOut" };

		gsap.to(this._night, { value: on ? 0 : 1, ...tween });
		// The machine under the desk stays on, so its blue light is what is left.
		gsap.to(this.lightsBakedTextureStrength, { r: on ? 0.5 : 0, g: on ? 1 : 0, b: on ? 1.8 : 1.1, ...tween });
		gsap.to(this.woodsLightsBakedTextureStrength, { r: on ? 0.7 : 0, g: on ? 0.7 : 0, b: on ? 1.5 : 0.6, ...tween });
		for (const material of this._boardNoteMaterials) {
			gsap.to(material.color, { r: on ? 0.8 : 0.13, g: on ? 0.78 : 0.16, b: on ? 0.76 : 0.26, ...tween });
		}
		for (const screen of [this.monitorAScreen, this.monitorBScreen]) {
			if (screen?.material instanceof MeshBasicMaterial) {
				const level = on ? 1 : 0;
				gsap.to(screen.material.color, { r: level, g: level, b: level, ...tween });
			}
		}
		this._lightSwitch?.setOn(on);
		this._deskProps?.setLights(on);
	}

	private _createBoardNotes() {
		if (!this.modelScene || this._boardNotes.length) return;

		// Two rows of square sticky notes. The top three are the originals; the
		// lower three carry lines already written elsewhere in the lab.
		const notes: { position: Vector3; rotation: number; details: BoardNoteDetails }[] = [
			{
				position: new Vector3(-1.05, 4.2, -2.74),
				rotation: -0.06,
				details: {
					title: "Ship the hard thing",
					label: ["Ship the", "hard thing"],
					description:
						"A reminder to choose the project that demands real learning, then turn the difficult part into something people can actually use.",
					accent: "#f0b45a",
				},
			},
			{
				position: new Vector3(-0.42, 4.14, -2.74),
				rotation: 0.045,
				details: {
					title: "Trace the system",
					label: ["Trace the", "system"],
					description:
						"AI is not magic. The interesting work is understanding the data, decisions, failure modes, and safeguards behind the result.",
					accent: "#7fc4bd",
				},
			},
			{
				position: new Vector3(0.2, 4.22, -2.74),
				rotation: -0.03,
				details: {
					title: "404: Comfort zone",
					label: ["404:", "comfort zone"],
					description:
						"A small rule for ambitious builds: stay curious, question the obvious path, and keep moving toward work that feels slightly impossible.",
					accent: "#ef9a86",
				},
			},
			{
				position: new Vector3(-1.2, 3.6, -2.74),
				rotation: 0.05,
				details: {
					title: "Never finished",
					label: ["Never", "finished"],
					description: "Unfinished ideas stay visible until they become real.",
					accent: "#f3d66a",
				},
			},
			{
				position: new Vector3(-0.58, 3.55, -2.74),
				rotation: -0.07,
				details: {
					title: "Reserved",
					label: ["Reserved", "for next"],
					description: "Reserved for the next ambitious system.",
					accent: "#c3b1ea",
				},
			},
			{
				position: new Vector3(0.05, 3.62, -2.74),
				rotation: 0.035,
				details: {
					title: "Look closer",
					label: ["Look", "closer"],
					description: "Some details only appear when you explore.",
					accent: "#9fd08c",
				},
			},
		];

		const geometry = new PlaneGeometry(0.46, 0.46);
		this._boardNoteGeometries.push(geometry);

		notes.forEach((note, index) => {
			const canvas = document.createElement("canvas");
			canvas.width = 512;
			canvas.height = 512;
			const context = canvas.getContext("2d");
			if (!context) return;

			// Paper: the note's colour, a little darker toward the curl at the bottom.
			context.fillStyle = note.details.accent;
			context.fillRect(0, 0, 512, 512);
			const shade = context.createLinearGradient(0, 0, 512, 512);
			shade.addColorStop(0, "rgba(255,255,255,0.16)");
			shade.addColorStop(0.55, "rgba(255,255,255,0)");
			shade.addColorStop(1, "rgba(0,0,0,0.2)");
			context.fillStyle = shade;
			context.fillRect(0, 0, 512, 512);
			// The lifted corner.
			context.fillStyle = "rgba(0,0,0,0.16)";
			context.beginPath();
			context.moveTo(512, 400);
			context.lineTo(512, 512);
			context.lineTo(400, 512);
			context.closePath();
			context.fill();
			context.fillStyle = "rgba(255,255,255,0.28)";
			context.beginPath();
			context.moveTo(512, 400);
			context.lineTo(416, 416);
			context.lineTo(400, 512);
			context.closePath();
			context.fill();
			// A strip of tape across the top.
			context.save();
			context.translate(256, 26);
			context.rotate(index % 2 ? 0.05 : -0.04);
			context.fillStyle = "rgba(255,255,255,0.5)";
			context.fillRect(-92, -24, 184, 48);
			context.restore();
			// The words, by hand.
			context.fillStyle = "#1c1c1c";
			context.textAlign = "left";
			context.textBaseline = "alphabetic";
			context.font = "700 70px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
			context.fillText(note.details.label[0], 44, 196);
			context.fillText(note.details.label[1], 44, 286);
			context.strokeStyle = "rgba(28,28,28,0.75)";
			context.lineWidth = 5;
			context.lineCap = "round";
			context.beginPath();
			context.moveTo(46, 318);
			context.quadraticCurveTo(150, 340, 250 + index * 14, 314);
			context.stroke();
			context.fillStyle = "rgba(28,28,28,0.5)";
			context.font = "600 26px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
			context.fillText("read me", 46, 446);

			const texture = new CanvasTexture(canvas);
			texture.colorSpace = SRGBColorSpace;
			texture.anisotropy = 8;
			// The room is lit for night, so the paper is toned down to sit in it.
			const material = new MeshBasicMaterial({ map: texture, color: new Color(0.8, 0.78, 0.76) });
			const mesh = new Mesh(geometry, material);
			mesh.position.copy(note.position);
			mesh.rotation.z = note.rotation;
			mesh.name = "interactive_board_note";
			mesh.userData.onSelect = () => {
				useState<BoardNoteDetails | null>("activeBoardNote", () => null).value = note.details;
				gsap.fromTo(mesh.scale, { x: 0.92, y: 0.92 }, { x: 1, y: 1, duration: 0.36, ease: "back.out(2.4)" });
			};
			// Under the pointer a note straightens and comes off the board a little.
			mesh.userData.onHover = (hovered: boolean) => {
				gsap.to(mesh.rotation, { z: hovered ? 0 : note.rotation, duration: 0.3, ease: "power2.out" });
				gsap.to(mesh.position, { z: note.position.z + (hovered ? 0.06 : 0), duration: 0.3, ease: "power2.out" });
				gsap.to(material.color, { r: hovered ? 1 : 0.8, g: hovered ? 0.98 : 0.78, b: hovered ? 0.96 : 0.76, duration: 0.3 });
			};

			this._boardNotes.push(mesh);
			this._boardNoteTextures.push(texture);
			this._boardNoteMaterials.push(material);
			this.modelScene?.add(mesh);
		});
	}

	public destruct() {
		this._atelier?.dispose();
		this._atelier = undefined;
		this._atelierState.value = initialAtelierState();
		window.removeEventListener("pointermove", this._onGuidedMove);
		window.removeEventListener("pointerdown", this._onGuidedDown);
		window.removeEventListener("pointerup", this._onGuidedUp);
		document.documentElement.style.cursor = "";

		if (!this.modelScene) return;

		gsap.to((this.modelScene.children[0] as Mesh).material as Material, {
			duration: Config.GSAP_ANIMATION_DURATION,
			ease: Config.GSAP_ANIMATION_EASE,
			opacity: 0,
			onUpdate: () => {},
			onComplete: () => {
				for (const texture of this._boardNoteTextures) texture.dispose();
				for (const material of this._boardNoteMaterials) material.dispose();
				for (const geometry of this._boardNoteGeometries) geometry.dispose();
				this._deskProps?.dispose();
				this._deskProps = undefined;
				this._lightSwitch?.dispose();
				this._lightSwitch = undefined;
				this._drawers?.dispose();
				this._drawers = undefined;
				this._boardNotes.length = 0;
				this._boardNoteTextures.length = 0;
				this._boardNoteMaterials.length = 0;
				this._boardNoteGeometries.length = 0;
				this.modelScene?.clear();
				this.modelScene?.removeFromParent();
				this._renderer?.removePortalAssets(`${Scene1Component.name}_screen_pc`);

				this.emit(DESTRUCTED);
			},
		});
	}

	public toggleDrawer(index: number) {
		if (!Number.isInteger(index) || index < 0 || index > 2) return;
		return this._drawers?.toggle(index);
	}

	/** Move through the connected room without taking control away from the visitor. */
	public visitAtelier(view: AtelierView) {
		const exp = this._experience, nav = exp.navigation, camera = exp.cameraAnimation;
		const state = this._atelierState.value;
		if (!this.modelScene || !nav || !camera || state.busy || nav.timeline.isActive() ||
			exp.world?.manager?.timeline.isActive() || exp.router?.currentRouteKey !== pages.HOME_PAGE) return;
		if (!this._atelier && view !== "workroom") {
			this._atelier = createAtelier(this.modelScene, action => this.actAtelier(action));
			this._atelier.refresh(state);
			this._atelier.reveal();
			state.opened = true;
		}
		state.view = view;
		if (this._atelier && view !== "workroom") this._atelier.root.visible = true;
		state.busy = true;
		exp.interactions?.stop();
		camera.enabled = false;
		const views = {
			workroom: { position: this.cameraPath.getPoint(0), target: this.center.clone() },
			atelier: { position: new Vector3(12.8, 9.2, 15.8), target: new Vector3(3.1, 2.35, 0) },
			table: { position: new Vector3(7.7, 6.5, 8.4), target: new Vector3(5.25, 2.30, -.3) },
			listen: { position: new Vector3(11.4, 5.9, 7.3), target: new Vector3(7.8, 1.9, -.3) },
		};
		const { position, target } = views[view];
		// Preserve the same useful framing on narrow screens.
		if (view !== "workroom" && window.innerWidth < 700) {
			if (view === "atelier") target.x = 2.4;
			position.sub(target).multiplyScalar(view === "atelier" ? 2.10 : view === "table" ? 1.62 : 1.45).add(target);
		}
		nav.setViewCenter(target.clone());
		nav.setLimits(view === "workroom" ? this.navigationLimits : {
			spherical: { radius: { min: 4.5, max: 48 }, phi: { min: .16, max: Math.PI * .48 },
				theta: { min: 0, max: Math.PI * 2 }, enabled: true, enabledPhi: true, enabledTheta: false },
			target: { x: { min: -4, max: 4 }, y: { min: -1, max: 2 }, z: { min: -3, max: 3 }, enabled: true },
		});
		camera.cameraPath = view === "workroom" ? this.cameraPath : new CatmullRomCurve3([
			position.clone(), position.clone().add(new Vector3(-5, 0, 1)),
			position.clone().add(new Vector3(-7, -2, -3)), position.clone(),
		]);
		camera.progressCurrent = camera.progressTarget = 0;
		camera.positionOnCurve.copy(position);
		nav.view.controls = true;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		nav.updateCameraPosition(position, target, reduced ? .01 : 1.4).add(() => {
			state.busy = false;
			if (exp.router?.currentRouteKey !== pages.HOME_PAGE) return;
			nav.view.controls = true;
			if (view === "workroom") {
				camera.enable(true);
				if (this._atelier) this._atelier.root.visible = false;
			}
			else {
				this.initSelectableObjects();
				exp.interactions?.start(this.selectableObjects, this.modelScene);
			}
		});
	}

	public actAtelier(action: AtelierAction) {
		const state = this._atelierState.value;
		if (!this._atelier || state.busy || this._experience.router?.currentRouteKey !== pages.HOME_PAGE) return;
		if (action === "study") state.study = (state.study + 1) % 3;
		if (action === "palette") state.palette = (state.palette + 1) % 3;
		if (action === "wireframe") state.wireframe = !state.wireframe;
		if (action === "lamp") state.lamp = !state.lamp;
		if (action === "sound") void this._experience.sound?.toggleMute();
		if (action === "print" && !state.printing) {
			state.printing = true;
			this._atelier.print(() => { state.printing = false; state.printed = true; });
		}
		this._atelier.refresh(state);
		this._atelier.pulse(action);
	}

	public saveAtelierPrint() { this._atelier?.save(); }

	public resetAtelierView() {
		this._atelierState.value.view = "workroom";
		this._atelierState.value.busy = false;
		if (this._atelier) this._atelier.root.visible = false;
	}

	public initSelectableObjects() {
		const router = useRouter();
		let nextPage: string | undefined;

		for (let i = 0; i < router.getRoutes().length; i++) {
			const route = router.getRoutes()[i];

			if (route.meta.key === pages.SKILL_PAGE) {
				nextPage = route.path;
				break;
			}
		}

		this.selectableObjects = [
			...this._boardNotes.map((object) => ({
				object,
				onSelect: () => object.userData.onSelect?.(),
				onHover: (hovered: boolean) => object.userData.onHover?.(hovered),
			})),
			...(this._deskProps?.selectables ?? []),
			...(this._lightSwitch?.selectables ?? []),
			...(this._drawers?.selectables ?? []),
			...(this._atelier?.selectables ?? []),
			...(this.pcScreen && nextPage
				? [
						{
							object: this.pcScreen,
							link: nextPage,
						},
					  ]
				: []),
			...(this.monitorAScreen
				? [
						{
							object: this.monitorAScreen,
							// Projects open over the room, so coming back needs no reload.
							onSelect: () => (useState<boolean>("isProjectsOpen", () => false).value = true),
						},
					  ]
				: []),
			...(this.monitorBScreen
				? [{ object: this.monitorBScreen, externalLink: Config.GITHUB_LINK }]
				: []),
			...(this.phoneScreen
				? [{ object: this.phoneScreen, link: "/contact" }]
				: []),
		];
	}

	public intro() {
		if (!(this?.modelScene && this.pcScreen && this.pcScreenWebglTexture))
			return;

		if (
			this._renderer?.renderPortalAssets &&
			!this._renderer.renderPortalAssets?.[`${Scene1Component.name}_pc_screen`]
		)
			this._renderer?.addPortalAssets(`${Scene1Component.name}_pc_screen`, {
				mesh: this.pcScreen,
				meshCamera: this.pcScreenProjectedCamera,
				meshWebGLTexture: this.pcScreenWebglTexture,
				aspect: this._initialPcScreenAspect,
			});

		if (!this.isPcOpen) {
			const blackColor = new Color(0x000000);
			const whiteColor = new Color(0xffffff);

			if (this.monitorAScreen?.material instanceof MeshBasicMaterial) {
				this.monitorAScreen.material.color = blackColor;
				this.woodsLightsBakedTextureStrength.r = 0;
			}
			if (this.monitorBScreen?.material instanceof MeshBasicMaterial) {
				this.monitorBScreen.material.color = blackColor;
				this.woodsLightsBakedTextureStrength.g = 0;
			}

			if (
				this._experience.sound?.computer_startup_audio &&
				this.fixedComputer
			) {
				this.fixedComputer.add(this._experience.sound.computer_startup_audio);
				this._experience.sound.computer_startup_audio.play();
			}

			if (this._experience.sound?.empty_room_audio && this.fixedComputer) {
				this.fixedComputer.add(this._experience.sound.empty_room_audio);
				this._experience.sound.empty_room_audio.play();
			}

			if (this._experience.sound?.lofi_audio && this.fixedComputer) {
				this.fixedComputer.add(this._experience.sound.lofi_audio);
				if (this._experience.sound.lofi_audio.isPlaying === false) {
					this._experience.sound.lofi_audio.play();
				}
			}


			gsap.fromTo(
				this.lightsBakedTextureStrength,
				{ b: 0 },
				{
					b: 1.8,
					duration: Config.GSAP_ANIMATION_DURATION / 2,
					onComplete: () => {
						if (this.monitorAScreen?.material instanceof MeshBasicMaterial) {
							this.monitorAScreen.material.needsUpdate = true;
							this.monitorAScreen.material.color = whiteColor;
							this.woodsLightsBakedTextureStrength.r = 0.7;
						}
						if (this.monitorBScreen?.material instanceof MeshBasicMaterial) {
							this.monitorBScreen.material.needsUpdate = true;
							this.monitorBScreen.material.color = whiteColor;
							this.woodsLightsBakedTextureStrength.g = 0.7;
						}
					},
				}
			);

			return this.togglePcOpening(1);
		}

		return this.timeline;
	}

	public outro() {
		this._renderer?.removePortalAssets(`${Scene1Component.name}_pc_screen`);

		return this.timeline;
	}

	/**
	 * Toggle the state of the pc between open and close
	 *
	 * @param forceState Force the state of the pc (0 = "close" & 1 = "open")
	 * @returns
	 */
	public togglePcOpening(force?: 0 | 1) {
		if (!this._model || !this.modelScene || !this.pcTopArticulation)
			return this.timeline;

		const isOpen = typeof force === "number" ? force !== 1 : this.isPcOpen;

		const nextValue = isOpen
			? this._initialPcTopArticulation?.rotation.z ?? 0
			: (this._initialPcTopArticulation?.rotation.z ?? 0) + 2.1;

		return this.pcTopArticulation.rotation.z === nextValue
			? this.timeline
			: this.timeline.to(this.pcTopArticulation.rotation, {
					z: nextValue,
					duration: Config.GSAP_ANIMATION_DURATION,
					onComplete: () => {
						if (this.pcTopArticulation?.rotation)
							this.pcTopArticulation.rotation.z = Number(nextValue);
					},
			  });
	}

	public update(): void {
		const lofi = this._experience.sound?.lofi_audio;
		const audioAnchor = this._atelier?.root.visible ? this._atelier.recordAnchor : this.fixedComputer;
		if (lofi && audioAnchor && lofi.parent !== audioAnchor) {
			audioAnchor.add(lofi);
			lofi.position.set(0, 0, 0);
		}
		if (this._atelier && this._experience.router?.currentRouteKey === pages.HOME_PAGE) {
			this._atelier.setSound(!this._experience.sound?.isMuted);
			this._atelier.update(this._appTime.delta);
		}
		if (
			this._availableMaterials?.coffee_steam instanceof ShaderMaterial &&
			typeof this._availableMaterials?.coffee_steam.uniforms?.uTime.value ===
				"number"
		)
			this._availableMaterials.coffee_steam.uniforms.uTime.value =
				this._appTime.elapsed;

		if (
			this._availableMaterials?.room instanceof ShaderMaterial &&
			typeof this._availableMaterials?.room.uniforms?.uRedAccentStrength
				.value === "number"
		)
			this._availableMaterials.room.uniforms.uRedAccentStrength.value =
				this.lightsBakedTextureStrength.r;

		if (
			this._availableMaterials?.room instanceof ShaderMaterial &&
			typeof this._availableMaterials?.room.uniforms?.uGreenAccentStrength
				.value === "number"
		)
			this._availableMaterials.room.uniforms.uGreenAccentStrength.value =
				this.lightsBakedTextureStrength.g;

		if (
			this._availableMaterials?.room instanceof ShaderMaterial &&
			typeof this._availableMaterials?.room.uniforms?.uBlueAccentStrength
				.value === "number"
		)
			this._availableMaterials.room.uniforms.uBlueAccentStrength.value =
				this.lightsBakedTextureStrength.b +
				Math.sin(((this._appTime.elapsed * 0.01) % 2) - 0.5) * 0.1;

		if (
			this._availableMaterials?.wood instanceof ShaderMaterial &&
			typeof this._availableMaterials?.wood.uniforms?.uRedAccentStrength
				.value === "number"
		)
			this._availableMaterials.wood.uniforms.uRedAccentStrength.value =
				this.woodsLightsBakedTextureStrength.r;

		if (
			this._availableMaterials?.wood instanceof ShaderMaterial &&
			typeof this._availableMaterials?.wood.uniforms?.uGreenAccentStrength
				.value === "number"
		)
			this._availableMaterials.wood.uniforms.uGreenAccentStrength.value =
				this.woodsLightsBakedTextureStrength.g;

		if (
			this._availableMaterials?.wood instanceof ShaderMaterial &&
			typeof this._availableMaterials?.wood.uniforms?.uBlueAccentStrength
				.value === "number"
		)
			this._availableMaterials.wood.uniforms.uBlueAccentStrength.value =
				this.woodsLightsBakedTextureStrength.b;
	}
}

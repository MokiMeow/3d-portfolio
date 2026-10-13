import { Texture, LinearSRGBColorSpace, VideoTexture } from "three";
import type { LoadedItem, Source } from "quick-threejs/lib/utils/Resources";
import { events as quickEvents } from "quick-threejs/lib/static";

// EXPERIENCE
import { HomeExperience } from ".";

// STATIC
import {
	CHANGED,
	CONSTRUCTED,
	DESTRUCTED,
	LOADED,
	PROGRESSED,
	STARTED,
} from "~/static/event.static";

// BLUEPRINTS
import { ExperienceBasedBlueprint } from "~/common/blueprints/experience-based.blueprint";
import { HOME_PAGE } from "~/static/page.static";

// ASSETS
import scene_1_model from "~/assets/models/scene_1/model.glb?url";
import scene_1_lights_baked_texture from "~/assets/models/scene_1/lights_baked_texture.jpg?url";
import scene_1_no_lights_baked_texture from "~/assets/models/scene_1/no_lights_baked_texture.jpg?url";
import scene_1_woods_lights_baked_texture from "~/assets/models/scene_1/woods_lights_baked_texture.jpg?url";
import scene_1_woods_no_lights_baked_texture from "~/assets/models/scene_1/woods_no_lights_baked_texture.jpg?url";
import scene_1_tree_baked_texture from "~/assets/models/scene_1/tree_baked_texture.jpg?url";

import scene_2_model from "~/assets/models/scene_2/model.glb?url";
import scene_2_baked_texture from "~/assets/models/scene_2/baked_texture.jpg?url";
import scene_3_model from "~/assets/models/scene_3/model.glb?url";
import scene_3_baked_texture from "~/assets/models/scene_3/baked_texture.jpg?url";

import scene_container_model from "~/assets/models/scene_container/model.glb?url";
import scene_container_baked_texture from "~/assets/models/scene_container/baked_texture.jpg?url";

import cloudAlphaMapTexture from "~/assets/textures/cloudAlphaMap.jpg?url";
import rocksAlphaMapTexture from "~/assets/textures/rocksAlphaMap.jpg?url";
import phoneScreenshotTexture from "~/assets/textures/phone_icons.png?url";

import monitor_a_screen_record from "~/assets/videos/mohith-code.webm?url";
import monitor_b_screen_record from "~/assets/videos/mohith-github.webm?url";
import phone_screen_record from "~/assets/videos/phone_screen_record.webm?url";

import computer_startup_audio from "~/assets/sounds/computer_startup.mp3?url";
import empty_room_audio from "~/assets/sounds/empty_room_ambient_noise.mp3?url";

/**
 * [`quick-threejs#Resource`](https://www.npmjs.com/package/quick-threejs)
 * Subset module. In charge of managing resources to load.
 */
export class Loader extends ExperienceBasedBlueprint {
	protected readonly _experience = new HomeExperience();

	private readonly _appResources = this._experience.app.resources;

	private _progress = 0;
	private _availableTextures: { [name: string]: Texture } = {};
	private _availableAudios: { [name: string]: AudioBuffer } = {};
	private _motionPreference?: MediaQueryList;
	private _removeResourceListeners?: () => void;
	private readonly _syncScreenPlayback = () => {
		const shouldPlay = !document.hidden && !this._motionPreference?.matches
			&& this._experience.router?.currentRouteKey === HOME_PAGE;
		for (const texture of Object.values(this._availableTextures)) {
			if (!(texture instanceof VideoTexture)) continue;
			const video = texture.image as HTMLVideoElement;
			if (shouldPlay) { if (video.paused) void video.play().catch(() => {}); }
			else video.pause();
		}
	};

	constructor() {
		super();

		// RESOURCES
		this._appResources.setDracoLoader(
			"https://www.gstatic.com/draco/versioned/decoders/1.4.3/"
		);
		this._appResources.setSources([
			// SCENE 1
			{
				name: "scene_1",
				type: "gltfModel",
				path: scene_1_model,
			},
			{
				name: "scene_1_lights_baked_texture",
				type: "texture",
				path: scene_1_lights_baked_texture,
			},
			{
				name: "scene_1_no_lights_baked_texture",
				type: "texture",
				path: scene_1_no_lights_baked_texture,
			},
			{
				name: "scene_1_woods_lights_baked_texture",
				type: "texture",
				path: scene_1_woods_lights_baked_texture,
			},
			{
				name: "scene_1_woods_no_lights_baked_texture",
				type: "texture",
				path: scene_1_woods_no_lights_baked_texture,
			},
			{
				name: "scene_1_tree_baked_texture",
				type: "texture",
				path: scene_1_tree_baked_texture,
			},

			// SCENE 2
			{
				name: "scene_2",
				type: "gltfModel",
				path: scene_2_model,
			},
			{
				name: "scene_2_baked_texture",
				type: "texture",
				path: scene_2_baked_texture,
			},

			// SCENE 3
			{
				name: "scene_3",
				type: "gltfModel",
				path: scene_3_model,
			},
			{
				name: "scene_3_baked_texture",
				type: "texture",
				path: scene_3_baked_texture,
			},

			// SCENE CONTAINER
			{
				name: "scene_container",
				type: "gltfModel",
				path: scene_container_model,
			},
			{
				name: "scene_container_baked_texture",
				type: "texture",
				path: scene_container_baked_texture,
			},

			// VIDEO TEXTURES
			{
				name: "monitor_a_screen_record",
				type: "video",
				path: monitor_a_screen_record,
			},
			{
				name: "monitor_b_screen_record",
				type: "video",
				path: monitor_b_screen_record,
			},
			{
				name: "phone_screen_record",
				type: "video",
				path: phone_screen_record,
			},

			// AUDIO
			{
				name: "computer_startup_audio",
				type: "audio",
				path: computer_startup_audio,
			},
			{
				name: "empty_room_audio",
				type: "audio",
				path: empty_room_audio,
			},
			// OTHER TEXTURES
			{
				name: "cloudAlphaMap",
				type: "texture",
				path: cloudAlphaMapTexture,
			},
			{
				name: "rocksAlphaMap",
				type: "texture",
				path: rocksAlphaMapTexture,
			},
			{
				name: "phoneScreenshot",
				type: "texture",
				path: phoneScreenshotTexture,
			},
		]);
	}

	private _initAvailableResource(source: Source, file: LoadedItem) {
		if (file instanceof Texture) {
			this.correctTextures(file);
			this._availableTextures[source.name] = file;
			if (file instanceof VideoTexture) this._syncScreenPlayback();
		}

		if (file instanceof AudioBuffer) this._availableAudios[source.name] = file;

		this.emit(CHANGED);
	}

	public get progress() {
		return this._progress;
	}

	public get availableTextures() {
		return this._availableTextures;
	}

	public get availableAudios() {
		return this._availableAudios;
	}

	/** Correct resource textures color and flip faces. */
	public correctTextures(item: Texture) {
		if (item instanceof Texture) {
			if (!(item instanceof VideoTexture)) item.flipY = false;
			item.colorSpace = LinearSRGBColorSpace;
		}
	}

	public construct() {
		this._motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
		this._motionPreference.addEventListener("change", this._syncScreenPlayback);
		document.addEventListener("visibilitychange", this._syncScreenPlayback);
		this._experience.router?.on(CHANGED, this._syncScreenPlayback);
		const onStart = () => {
			this.emit(STARTED, this._progress);
		};
		const onProgress = (
			itemsLoaded: number,
			itemsToLoad: number,
			source: Source,
			file: LoadedItem
		) => {
			this._progress = (itemsLoaded / itemsToLoad) * 100;
			this.emit(PROGRESSED, this._progress, source.path);
			this._initAvailableResource(source, file);
		};

		const onLoad = () => {
			this._removeResourceListeners?.();
			this.emit(LOADED, this._progress);
		};

		this._removeResourceListeners?.();
		this._removeResourceListeners = () => {
			this._appResources.off(quickEvents.STARTED, onStart);
			this._appResources.off(quickEvents.PROGRESSED, onProgress);
			this._appResources.off(quickEvents.LOADED, onLoad);
			this._removeResourceListeners = undefined;
		};
		this._progress = 0;
		this._appResources.on(quickEvents.STARTED, onStart);
		this._appResources.on(quickEvents.PROGRESSED, onProgress);
		this._appResources.on(quickEvents.LOADED, onLoad);
		this._appResources.startLoading();
		this.emit(CONSTRUCTED, this._progress);
	}

	public destruct() {
		this._removeResourceListeners?.();
		this._motionPreference?.removeEventListener("change", this._syncScreenPlayback);
		document.removeEventListener("visibilitychange", this._syncScreenPlayback);
		this._experience.router?.off(CHANGED, this._syncScreenPlayback);
		const keys = Object.keys(this._appResources.items);

		for (let i = 0; i < keys.length; i++) {
			const item = this._appResources.items[keys[i]];
			if (item instanceof VideoTexture) {
				const video = item.image as HTMLVideoElement;
				video.pause(); video.removeAttribute("src"); video.load();
			}
			if (item instanceof Texture) item.dispose();
		}

		this.emit(DESTRUCTED);
		this.removeAllListeners();
	}
}

import { events as sizeEvents } from "quick-threejs/lib/static";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { HalfFloatType, WebGLRenderTarget } from "three";
import { roomPixelRatio } from "~/utils/render-quality";

// EXPERIENCES
import { HomeExperience } from ".";

// BLUEPRINTS
import { ExperienceBasedBlueprint } from "~/common/blueprints/experience-based.blueprint";

// STATIC
import { events } from "~/static";
import type { LabDevice } from "~/common/models/lab-device.model";

/** Effect Composer Manager */
export class Composer extends ExperienceBasedBlueprint {
	protected readonly _experience = new HomeExperience();

	private readonly _appRender = this._experience.app.renderer;
	private readonly _appCamera = this._experience.app.camera;
	private readonly _appSizes = this._experience.app.sizes;
	private readonly _passes: { [name: string]: Pass } = {};
	private readonly _activeDevice = useState<LabDevice>("activeLabDevice", () => null);
	private readonly _newspaperOpen = useState<boolean>('isNewspaperOpen', () => false);

	private _effect?: EffectComposer;
	private _renderPass?: RenderPass;
	private _outputPass?: OutputPass;
	private _onResize?: () => unknown;

	public get effect() {
		return this._effect;
	}

	public get passes() {
		return this._passes;
	}

	public construct(): void {
		const renderer = this._appRender.instance;
		const target = new WebGLRenderTarget(1, 1, {
			type: HalfFloatType,
			samples: renderer.capabilities.isWebGL2 ? Math.min(4, renderer.capabilities.maxSamples) : 0,
		});
		this._effect = new EffectComposer(renderer, target);
		this._effect.setPixelRatio(roomPixelRatio(this._appSizes.width, this._appSizes.height, this._appSizes.pixelRatio));
		this._effect.setSize(this._appSizes.width, this._appSizes.height);

		this._onResize = () => {
			this._effect?.setPixelRatio(roomPixelRatio(this._appSizes.width, this._appSizes.height, this._appSizes.pixelRatio));
			this._effect?.setSize(this._appSizes.width, this._appSizes.height);
		};
		this._appSizes.on(sizeEvents.RESIZED, this._onResize);
		this.emit(events.CONSTRUCTED);
	}

	public destruct(): void {
		this._onResize && this._appSizes.off(sizeEvents.RESIZED, this._onResize);
		this._effect?.dispose();
		this._effect = undefined;
		this.emit(events.DESTRUCTED);
		this.removeAllListeners();
	}

	public addPass(key: string, pass: Pass) {
		this._passes[key] = pass;

		if (!this._effect?.passes.length) {
			if (this._appCamera.instance) {
				this._renderPass = new RenderPass(
					this._experience.app.scene,
					this._appCamera.instance
				);
				this._effect?.addPass(this._renderPass);
			}

			this._outputPass = new OutputPass();
			this._effect?.addPass(this._outputPass);
			this.emit(events.STARTED);
		}

		// Colour conversion is the final pass, after the interaction outline.
		this._effect?.insertPass(this._passes[key], Math.max(0, (this._effect?.passes.length ?? 1) - 1));
		this.emit(events.ADDED);
	}

	public removePass(key: string) {
		if (!this._passes[key]) return;

		this._effect?.removePass(this._passes[key]);
		this._passes[key].dispose();
		delete this._passes[key];

		this.emit(events.REMOVED);
		if (Object.keys(this._passes).length) return;
		this._renderPass && this._effect?.removePass(this._renderPass);
		this._outputPass && this._effect?.removePass(this._outputPass);
		this.emit(events.ENDED);
	}

	public update(): void {
		// Keep the last room frame beneath the device dialog. The interactive
		// DOM/YouTube UI does not need a second full WebGL scene every frame.
		if (this._activeDevice.value || this._newspaperOpen.value || document.hidden) {
			this._appRender.enabled = false;
			return;
		}
		if (!this._effect?.passes.length || !Object.values(this._passes).some(pass => pass.enabled)) {
			// Render directly here so the scene and post-processing paths share the
			// same frame, camera and viewport without a second wrapper render.
			this._appRender.enabled = false;
			this._appRender.instance.setRenderTarget(null);
			this._appRender.instance.setViewport(0, 0, this._appSizes.width, this._appSizes.height);
			if (this._appCamera.instance) this._appRender.instance.render(this._experience.app.scene, this._appCamera.instance);
			return;
		}
		this._appRender.enabled = false;

		this._appRender.instance.setViewport(
			0,
			0,
			this._appSizes.width,
			this._appSizes.height
		);
		this._effect.render();
	}
}

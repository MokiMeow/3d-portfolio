import {
	LinearSRGBColorSpace,
	Matrix4,
	Mesh,
	NoToneMapping,
	PCFShadowMap,
	PerspectiveCamera,
	WebGLRenderTarget,
} from "three";
import { HtmlMixerContext } from "threex.htmlmixer-continued/lib/html-mixer";
import { events as quickEvents } from "quick-threejs/lib/static";

// EXPERIENCE
import { HomeExperience } from ".";

// BLUEPRINTS
import { ExperienceBasedBlueprint } from "~/common/blueprints/experience-based.blueprint";

// STATIC
import { events, pages } from "~/static";
import { DeviceConfig } from "~/config/device.config";
import type { LabDevice } from "~/common/models/lab-device.model";
import { screenCssTransform } from "~/utils/screen-focus";
import { roomPixelRatio } from "~/utils/render-quality";

export interface PortalAssets {
	mesh: THREE.Mesh;
	meshWebGLTexture: THREE.WebGLRenderTarget;
	meshCamera: THREE.PerspectiveCamera;
	aspect: number;
}

/**
 * [`quick-threejs#Renderer`](https://www.npmjs.com/package/quick-threejs)
 * Subset module. In charge of managing renderer states.
 */
export class Renderer extends ExperienceBasedBlueprint {
	protected readonly _experience = new HomeExperience();

	private readonly _app = this._experience.app;
	private readonly _appRenderer = this._app.renderer;
	private readonly _ui = this._experience.ui;
	private readonly _camera = this._experience.camera;
	private readonly _appSizes = this._experience.app.sizes;
	private readonly _activeDevice = useState<LabDevice>("activeLabDevice", () => null);
	private readonly _newspaperOpen = useState<boolean>('isNewspaperOpen', () => false);
	private readonly _consoleOpen = useState<boolean>('isConsoleOpen', () => false);
	private readonly _renderPortalAssets: {
		[callbackName: string]: PortalAssets;
	} = {};

	private _currentRenderTarget = this._appRenderer.instance.getRenderTarget();
	private _currentXrEnabled = this._appRenderer.instance.xr.enabled;
	private _currentShadowAutoUpdate =
		this._appRenderer.instance.shadowMap.autoUpdate;
	private _lastPortalRenderAt = 0;
	private _lastCssFov = -1;
	private _focusedScreenKey = "";
	private _onResize = () => {
		this._appRenderer.instance.setPixelRatio(roomPixelRatio(this._appSizes.width, this._appSizes.height, this._appSizes.pixelRatio));
		this._mixerContext?.rendererCss?.setSize(
			this._appSizes.width,
			this._appSizes.height
		);
	};

	public _mixerContext?: HtmlMixerContext;

	private _updateFocusedScreen() {
		const root = this._mixerContext?.rendererCss.domElement;
		const plane = this._experience.world?.scene3?.pcScreenMixerPlane;
		const camera = this._camera?.instance;
		const focused = !!plane && this._experience.interactions?.focusedObject?.object === plane.object3d;
		if (!root) return;
		root.classList.toggle("lab-laptop-focused", focused);
		root.style.visibility = this._camera?.currentCameraIndex === 1 && this._experience.router?.currentRouteKey === pages.CONTACT_PAGE ? "visible" : "hidden";
		if (!focused || !plane || !camera) { this._focusedScreenKey = ""; return; }
		const { width, height } = this._appSizes;
		const key = `${plane.object3d.uuid}:${width}:${height}:${camera.fov}`;
		if (key === this._focusedScreenKey) return;
		this._focusedScreenKey = key;
		const element = plane.domElement;
		const matrix = screenCssTransform(plane.object3d as Mesh, camera, width, height,
			parseFloat(element.style.width), parseFloat(element.style.height));
		element.style.setProperty("--lab-screen-transform", `matrix(${matrix.join(",")})`);
	}

	private _renderPortal(
		mesh: Mesh,
		meshWebGLTexture: WebGLRenderTarget,
		portalCamera: PerspectiveCamera,
		aspect: number
	) {
		this._appRenderer.instance.setRenderTarget(meshWebGLTexture);
		this._appRenderer.instance.state.buffers.depth.setMask(true);
		if (this._appRenderer.instance.autoClear === false)
			this._appRenderer.instance.clear();
		mesh.visible = false;

		portalCamera.aspect = aspect;
		portalCamera.updateProjectionMatrix();
		this._experience.world?.prepareRender(true);
		this._appRenderer.instance.render(this._experience.app.scene, portalCamera);
		this._experience.world?.prepareRender(this._camera?.currentCameraIndex === 1);
		mesh.visible = true;
	}

	public enableCssRender = true;

	public get mixerContext() {
		return this._mixerContext;
	}

	public get renderPortalAssets() {
		return this._renderPortalAssets;
	}

	public construct() {
		// RENDERER
		this._appRenderer.instance.outputColorSpace = LinearSRGBColorSpace;
		this._appRenderer.instance.toneMapping = NoToneMapping;
		this._appRenderer.instance.toneMappingExposure = 1;
		this._appRenderer.instance.shadowMap.enabled = false;
		this._appRenderer.instance.shadowMap.type = PCFShadowMap;
		this._appRenderer.instance.setClearColor("#5f5f5f", 1);
		this._appRenderer.instance.setSize(
			this._experience.app.sizes.width,
			this._experience.app.sizes.height
		);
		this._appRenderer.instance.setPixelRatio(
			roomPixelRatio(this._appSizes.width, this._appSizes.height, this._appSizes.pixelRatio)
		);
		this._appRenderer.instance.localClippingEnabled = true;
		// Checking each shader for errors makes the page wait for it to compile; only worth it while developing.
		this._appRenderer.instance.debug.checkShaderErrors = Boolean(import.meta.dev);

		// CSS RENDERER
		if (!this._camera?.instance) return;

		this._mixerContext = new HtmlMixerContext(
			this._appRenderer.instance,
			this._camera?.instance
		);

		this._mixerContext.rendererCss.setSize(
			this._appSizes.width,
			this._appSizes.height
		);
		if (this._ui)
			this._ui.cssTargetElement = this._mixerContext.rendererCss.domElement;

		this._appSizes.on(quickEvents.RESIZED, this._onResize);

		this._app.on(quickEvents.PRE_UPDATED, () => {
			if (this._activeDevice.value || this._newspaperOpen.value || this._consoleOpen.value || document.hidden) return;
			this.enableCssRender && this._mixerContext?.update();
			this._updateFocusedScreen();

			if (!Object.keys(this._renderPortalAssets).length) return;
			const now = performance.now();
			const portalInterval = DeviceConfig.DEVICE === "pc" ? 1000 / 30 : 1000 / 24;
			if (now - this._lastPortalRenderAt < portalInterval) return;
			this._lastPortalRenderAt = now;
			const keys = Object.keys(this._renderPortalAssets);
			for (let i = 0; i < keys.length; i++) {
				if (this._renderPortalAssets[keys[i]]) {
					this._currentRenderTarget =
						this._appRenderer.instance.getRenderTarget();
					this._currentXrEnabled = this._appRenderer.instance.xr.enabled;
					this._currentShadowAutoUpdate =
						this._appRenderer.instance.shadowMap.autoUpdate;
					this._appRenderer.instance.xr.enabled = false;
					this._appRenderer.instance.shadowMap.autoUpdate = false;
					this._renderPortal(
						this._renderPortalAssets[keys[i]].mesh,
						this._renderPortalAssets[keys[i]].meshWebGLTexture,
						this._renderPortalAssets[keys[i]].meshCamera,
						this._renderPortalAssets[keys[i]].aspect
					);
					this._appRenderer.instance.xr.enabled = this._currentXrEnabled;
					this._appRenderer.instance.shadowMap.autoUpdate =
						this._currentShadowAutoUpdate;
					this._appRenderer.instance.setRenderTarget(this._currentRenderTarget);
				}
			}
		});

		this.emit(events.CONSTRUCTED);
	}

	public destruct() {
		const _KEYS_PORTAL_ASSETS = Object.keys(this._renderPortalAssets);

		for (let i = 0; i < _KEYS_PORTAL_ASSETS.length; i++)
			this.removePortalAssets(_KEYS_PORTAL_ASSETS[i]);

		this._onResize && this._appSizes.off("resize", this._onResize);
		this.emit(events.DESTRUCTED);
		this.removeAllListeners();
	}

	public addPortalAssets(portalName: string, assets: PortalAssets): void {
		const matrix = new Matrix4();
		matrix.makeRotationFromQuaternion(assets.mesh.quaternion);
		matrix.setPosition(assets.mesh.position);

		this._renderPortalAssets[portalName] = assets;

		this.emit(events.PORTAL_ADDED, portalName);
	}

	public removePortalAssets(portalName: string): void {
		if (!Object.keys(this._renderPortalAssets).length) return;
		if (this._renderPortalAssets[portalName])
			delete this._renderPortalAssets[portalName];
		if (!Object.keys(this._renderPortalAssets).length)
			this.emit(events.ALL_PORTALS_REMOVED, portalName);

		this.emit(events.PORTAL_REMOVED, portalName);
	}

	public update(): void {
		if (!this._mixerContext) return;
		const nextFov = this._camera?.instance.fov ?? 0;
		if (Math.abs(nextFov - this._lastCssFov) < 0.01) return;
		this._lastCssFov = nextFov;
		this._mixerContext.cssCamera.fov = nextFov;
		this._mixerContext.cssCamera.matrixWorldNeedsUpdate = true;
		this._mixerContext.cssCamera.updateProjectionMatrix();
	}
}

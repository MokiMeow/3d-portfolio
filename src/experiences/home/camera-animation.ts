import { CatmullRomCurve3, Vector3 } from "three";
import { gsap } from "gsap";

// EXPERIENCES
import { HomeExperience } from ".";

// BLUEPRINTS
import { ExperienceBasedBlueprint } from "~/common/blueprints/experience-based.blueprint";

// CONFIG
import { Config } from "~/config";

// STATIC
import { events } from "~/static";

export const defaultCameraPath = new CatmullRomCurve3([
	new Vector3(0, 5.5, 21),
	new Vector3(12, 10, 12),
	new Vector3(21, 5.5, 0),
	new Vector3(12, 3.7, 12),
	new Vector3(0, 5.5, 21),
]);

export class CameraAnimation extends ExperienceBasedBlueprint {
	protected readonly _experience = new HomeExperience();

	private readonly _ui = this._experience.ui;
	private readonly _navigation = this._experience.navigation;
	private readonly _appTime = this._experience.app.time;

	private _enabled = false;
	private _onWheel?: (e: WheelEvent) => unknown;
	private _onKeyDown?: (e: KeyboardEvent) => unknown;

	public cameraPath = defaultCameraPath;
	public progressCurrent = 0;
	public progressTarget = 0;
	public progressEase = 0.1;
	public positionOnCurve = new Vector3();
	public reversed = false;
	public isSliding = false;

	public get enabled() {
		return this._enabled;
	}

	public set enabled(b: boolean) {
		this._enabled = !!b;
		this.emit(events.CHANGED);
	}

	private _setProgress(nextProgress: number) {
		this.progressTarget = this.cameraPath.closed
			? nextProgress
			: gsap.utils.clamp(0, 1, nextProgress);
	}

	public nudgeProgress(delta: number) {
		if (!this._enabled || this._navigation?.timeline.isActive()) return;

		this.reversed = delta < 0;
		this._setProgress(this.progressTarget + delta);
	}

	public setProgress(progress: number) {
		this.reversed = progress < this.progressTarget;
		this._setProgress(progress);
	}

	private _wheelEvent(e: WheelEvent) {
		if (
			!this._enabled ||
			this._navigation?.timeline.isActive() ||
			this.isSliding
		)
			return;

		const primaryDelta =
			Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		if (!primaryDelta) return;

		const magnitude = gsap.utils.clamp(
			0.012,
			0.065,
			Math.abs(primaryDelta) / 1200
		);
		this.nudgeProgress(primaryDelta > 0 ? magnitude : -magnitude);
	}

	private _keyDownEvent(e: KeyboardEvent) {
		if (!this._enabled || e.altKey || e.ctrlKey || e.metaKey) return;

		const target = e.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		)
			return;

		const steps: Partial<Record<string, number>> = {
			ArrowRight: 0.035,
			ArrowDown: 0.035,
			PageDown: 0.12,
			ArrowLeft: -0.035,
			ArrowUp: -0.035,
			PageUp: -0.12,
		};
		const step = steps[e.key];
		if (typeof step === "number") {
			e.preventDefault();
			this.nudgeProgress(step);
			return;
		}

		if (e.key === "Home" || e.key === "End") {
			e.preventDefault();
			this.setProgress(e.key === "Home" ? 0 : 1);
		}
	}

	public construct() {
		this._onWheel = (e) => this._wheelEvent(e);
		this._onKeyDown = (e) => this._keyDownEvent(e);

		this._ui?.on(events.WHEEL, this._onWheel);
		window.addEventListener("keydown", this._onKeyDown);
	}

	public destruct() {
		if (this._onKeyDown) window.removeEventListener("keydown", this._onKeyDown);
		this.emit(events.DESTRUCTED);
		this.removeAllListeners();
	}

	public enable(direct?: boolean) {
		if (this._navigation?.timeline.isActive())
			this._navigation.timeline.progress(1);
		this.enabled = true;

		if (direct) return;

		if (this._navigation?.view) this._navigation.view.controls = false;
		this.cameraPath.getPointAt(this.progressCurrent % 1, this.positionOnCurve);

		return this._navigation
			?.updateCameraPosition(
				this.positionOnCurve,
				this._navigation.view.center,
				Config.GSAP_ANIMATION_DURATION * 0.4
			)
			.add(() => {
				this.emit(events.STARTED, this);
			});
	}

	public disable() {
		if (
			Object.keys(this._experience.composer?.passes ?? {}).length ||
			this._navigation?.timeline.isActive()
		)
			return;

		this.enabled = false;
		if (this._navigation?.view) this._navigation.view.controls = true;

		return this._navigation
			?.updateCameraPosition(
				lerpPosition(this.positionOnCurve, this._navigation.view.center, 0.1),
				this._navigation.view.center,
				Config.GSAP_ANIMATION_DURATION * 0.2
			)
			.add(() => {
				this.emit(events.ENDED, this);
			});
	}

	public update(): void {
		if (
			!this._enabled ||
			this._navigation?.timeline.isActive() ||
			this._experience.world?.manager?.timeline.isActive() ||
			this._experience.interactions?.focusedObject
		)
			return;

		const frameRatio = Math.max(0.25, this._appTime.delta / (1000 / 60));
		const frameEase = 1 - Math.pow(1 - this.progressEase, frameRatio);
		this.progressCurrent = gsap.utils.interpolate(
			this.progressCurrent,
			this.progressTarget,
			frameEase
		);

		if (!this.cameraPath.closed) {
			this.progressTarget = gsap.utils.clamp(0, 1, this.progressTarget);
			this.progressCurrent = gsap.utils.clamp(0, 1, this.progressCurrent);
		}

		if (this.cameraPath.closed && this.progressCurrent < 0) {
			this.progressTarget += 1;
			this.progressCurrent += 1;
		}

		if (this.cameraPath.closed && this.progressCurrent > 1) {
			this.progressTarget -= 1;
			this.progressCurrent -= 1;
		}
		if (Math.abs(this.progressTarget - this.progressCurrent) < 0.00001)
			this.progressCurrent = this.progressTarget;

		this.cameraPath.getPointAt(this.progressCurrent, this.positionOnCurve);
		this._navigation?.setPositionInSphere(this.positionOnCurve);
		this.emit(events.UPDATED);
	}
}

import { AudioListener, AudioLoader, PositionalAudio } from "three";
import lofiTrackUrl from "~/assets/sounds/lofi-girl-lofi-ambient-music-365952.mp3?url";

// EXPERIENCES
import { HomeExperience } from ".";

// BLUEPRINTS
import { ExperienceBasedBlueprint } from "~/common/blueprints/experience-based.blueprint";

// STATIC
import { events } from "~/static";

export class Sound extends ExperienceBasedBlueprint {
	protected _experience = new HomeExperience();

	private readonly _loader = this._experience.loader;
	private readonly _camera = this._experience.camera;

	private _empty_room_audio?: PositionalAudio;
	private _computer_startup_audio?: PositionalAudio;
	private _lofi_audio?: PositionalAudio;
	private _lofiLoadPromise?: Promise<PositionalAudio | undefined>;
	private _shouldPlayLofi = false;
	private _onBeforeCameraSwitch?: () => unknown;
	private _onCameraSwitched?: () => unknown;

	public readonly listener = new AudioListener();

	private _disposeAudio(audio?: PositionalAudio) {
		if (!audio) return;
		audio.stop();
		audio.disconnect();
		audio.source = null;
		audio.buffer = null;
		audio.removeFromParent();
	}

	public get empty_room_audio() {
		return this._empty_room_audio;
	}
	public get computer_startup_audio() {
		return this._computer_startup_audio;
	}
	public get lofi_audio() {
		return this._lofi_audio;
	}
	public get isMuted() {
		return this.listener.getMasterVolume() !== 1;
	}

	public set empty_room_audio(audio: typeof this._empty_room_audio) {
		this._empty_room_audio = audio;
		this.emit(events.CHANGED);
	}
	public set computer_startup_audio(
		audio: typeof this._computer_startup_audio
	) {
		this._computer_startup_audio = audio;
		this.emit(events.CHANGED);
	}
	public set lofi_audio(audio: typeof this._lofi_audio) {
		this._lofi_audio = audio;
		this.emit(events.CHANGED);
	}

	private async _loadLofi() {
		if (this._lofi_audio) return this._lofi_audio;
		if (this._lofiLoadPromise) return this._lofiLoadPromise;

		this._lofiLoadPromise = new AudioLoader()
			.loadAsync(lofiTrackUrl)
			.then((buffer) => {
				const audio = new PositionalAudio(this.listener);
				audio.setBuffer(buffer);
				audio.setLoop(true);
				audio.setRefDistance(4);
				audio.setVolume(0.42);
				const anchor = this._experience.world?.scene1?.fixedComputer;
				(anchor ?? this._camera?.instance)?.add(audio);
				this.lofi_audio = audio;
				if (this._shouldPlayLofi && !audio.isPlaying) audio.play();
				return audio;
			})
			.catch(() => {
				this._lofiLoadPromise = undefined;
				return undefined;
			});

		return this._lofiLoadPromise;
	}

	public async startFromGesture() {
		this._shouldPlayLofi = true;
		if (this.listener.context.state !== "running")
			await this.listener.context.resume();
		this.listener.setMasterVolume(1);
		this.emit(events.CHANGED);

		const lofi = await this._loadLofi();
		if (lofi && !lofi.isPlaying) lofi.play();
		this.emit(events.CHANGED);
	}

	public async toggleMute() {
		const vol = this.listener.getMasterVolume();
		const shouldEnable = vol !== 1;
		if (shouldEnable) await this.startFromGesture();
		else this.listener.setMasterVolume(0);

		setTimeout(() => this.emit(events.CHANGED), 200);
	}

	public construct() {
		const availableAudios = this._loader?.availableAudios;
		const empty_room_audio = availableAudios?.empty_room_audio;
		const computer_startup_audio = availableAudios?.computer_startup_audio;

		if (
			!this._camera?.instance ||
			!empty_room_audio ||
			!computer_startup_audio
		)
			return;
		this._camera?.instance.add(this.listener);
		this.listener.setMasterVolume(0);
		void this._loadLofi();

		this.empty_room_audio = new PositionalAudio(this.listener);
		this.empty_room_audio.setBuffer(empty_room_audio);
		this.empty_room_audio.setLoop(true);
		this.empty_room_audio.setRefDistance(8);
		this.empty_room_audio.autoplay = false;

		this.computer_startup_audio = new PositionalAudio(this.listener);
		this.computer_startup_audio.setBuffer(computer_startup_audio);
		this.computer_startup_audio.setLoop(false);
		this.computer_startup_audio.setRefDistance(0.3);
		this.computer_startup_audio.autoplay = false;

		this._onBeforeCameraSwitch = () => this.listener.removeFromParent();
		this._onCameraSwitched = () => this._camera?.instance.add(this.listener);

		this._camera.on(events.BEFORE_CAMERA_SWITCH, this._onBeforeCameraSwitch);
		this._camera.on(events.CAMERA_SWITCHED, this._onCameraSwitched);

		this.emit(events.CONSTRUCTED);
	}

	public destruct() {
		if (this._empty_room_audio) {
			this._disposeAudio(this._empty_room_audio);
			this.empty_room_audio = undefined;
		}
		if (this._computer_startup_audio) {
			this._disposeAudio(this._computer_startup_audio);
			this.computer_startup_audio = undefined;
		}
		if (this._lofi_audio) {
			this._disposeAudio(this._lofi_audio);
			this.lofi_audio = undefined;
		}
		this._lofiLoadPromise = undefined;
		this._shouldPlayLofi = false;

		this._onBeforeCameraSwitch &&
			this._camera?.off(
				events.BEFORE_CAMERA_SWITCH,
				this._onBeforeCameraSwitch
			);
		this._onCameraSwitched &&
			this._camera?.off(events.CAMERA_SWITCHED, this._onCameraSwitched);
		this.listener.removeFromParent();
		this.emit(events.DESTRUCTED);
		this.removeAllListeners();
	}

	public update() {}
}

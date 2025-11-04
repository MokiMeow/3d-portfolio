import { AudioListener, PositionalAudio } from "three";

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

	public toggleMute() {
		const vol = this.listener.getMasterVolume();
		this.listener.setMasterVolume(vol !== 1 ? 1 : 0);

		setTimeout(() => this.emit(events.CHANGED), 200);
	}

	public construct() {
		const availableAudios = this._loader?.availableAudios;
		const empty_room_audio = availableAudios?.empty_room_audio;
		const computer_startup_audio = availableAudios?.computer_startup_audio;
		const lofiTracks = [
			availableAudios?.lofi_track_one_audio,
			availableAudios?.lofi_track_two_audio,
		].filter((track): track is AudioBuffer => Boolean(track));

		if (
			!this._camera?.instance ||
			!empty_room_audio ||
			!computer_startup_audio
		)
			return;
		this._camera?.instance.add(this.listener);

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

		if (lofiTracks.length) {
			const selected =
				lofiTracks[Math.floor(Math.random() * lofiTracks.length)];
			const lofiAudio = new PositionalAudio(this.listener);
			lofiAudio.setBuffer(selected);
			lofiAudio.setLoop(true);
			lofiAudio.setRefDistance(4);
			lofiAudio.setVolume(0.5);
			lofiAudio.autoplay = false;
			this.lofi_audio = lofiAudio;
		}

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

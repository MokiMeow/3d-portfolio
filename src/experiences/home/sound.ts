import { AudioListener, AudioLoader, PositionalAudio } from "three";
import lofiTrackUrl from "~/assets/sounds/lofi-girl-lofi-ambient-music-365952.mp3?url";
import startupTrackUrl from "~/assets/sounds/computer_startup.mp3?url";
import ambienceTrackUrl from "~/assets/sounds/empty_room_ambient_noise.mp3?url";
import { HOME_PAGE } from "~/static/page.static";

// EXPERIENCES
import { HomeExperience } from ".";

// BLUEPRINTS
import { ExperienceBasedBlueprint } from "~/common/blueprints/experience-based.blueprint";

// STATIC
import { events } from "~/static";
import { initialMusicState, type MusicState } from "~/common/models/music.model";

export class Sound extends ExperienceBasedBlueprint {
	protected _experience = new HomeExperience();
	private _muted = true;
	private readonly _music = useState<MusicState>('labMusic', initialMusicState);
	public get musicPlaying() {
		return !this.isMuted && (this._music.value.source === 'room'
			? !!this._lofi_audio?.isPlaying && this.listener.context.state === 'running'
			: this._music.value.playing);
	}
	public pauseMusic() {
		this._shouldPlayLofi = false;
		if (this._lofi_audio?.isPlaying) this._lofi_audio.pause();
		this._music.value.playing = false;
	}
	public useExternalMusic() {
		this.pauseMusic(); this._music.value.source = 'external';
		this._setVolume(1);
	}
	public useRoomMusic() { this.pauseMusic(); this._music.value.source = 'room'; }

	private readonly _camera = this._experience.camera;
	private readonly _ready = useState<boolean>('isExperienceReady', () => false);
	private _disposed = false;

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
		return this._muted;
	}
	private _setVolume(volume: 0 | 1) {
		// AudioParam ramps approach their target over time; UI state must follow
		// the requested state rather than compare an intermediate gain to 1.
		this._muted = volume === 0;
		this.listener.setMasterVolume(volume);
		this.emit(events.CHANGED);
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
				if (this._disposed) return undefined;
				const audio = new PositionalAudio(this.listener);
				audio.setBuffer(buffer);
				audio.setLoop(true);
				audio.setRefDistance(4);
				audio.setVolume(0.42);
				const anchor = this._experience.world?.scene1?.fixedComputer;
				(anchor ?? this._camera?.instance)?.add(audio);
				this.lofi_audio = audio;
				if (this._shouldPlayLofi && this._music.value.source === 'room' && !audio.isPlaying) {
					audio.play();
					this._music.value.playing = true;
				}
				return audio;
			})
			.catch(() => {
				this._lofiLoadPromise = undefined;
				return undefined;
			});

		return this._lofiLoadPromise;
	}

	public async startFromGesture() {
		if (this._music.value.source === 'external') {
			this._setVolume(1);
			this._music.value.open = true; return;
		}
		this._shouldPlayLofi = true;
		if (this.listener.context.state !== "running")
			await this.listener.context.resume();
		this._setVolume(1);

		const lofi = await this._loadLofi();
		if (lofi && this._shouldPlayLofi && this._music.value.source === 'room') {
			if (!lofi.isPlaying) lofi.play();
			this._music.value.playing = true;
		}
		this.emit(events.CHANGED);
	}

	public async toggleMute() {
		const shouldEnable = this.isMuted;
		if (shouldEnable) await this.startFromGesture();
		else { this._setVolume(0); this.pauseMusic(); }
	}

	public construct() {
		if (!this._camera?.instance) return;
		this._disposed = false;
		this._camera?.instance.add(this.listener);
		this._setVolume(0);
		void this._loadLofi();
		// Sound is optional: a slow download or suspended decoder cannot hold
		// the entire room at 90%. Attach clips whenever they become available.
		for (const [kind, url] of [
			["ambience", ambienceTrackUrl], ["startup", startupTrackUrl],
		] as const) {
			void new AudioLoader().loadAsync(url).then(buffer => {
				if (this._disposed) return;
				const audio = new PositionalAudio(this.listener);
				audio.setBuffer(buffer);
				audio.setLoop(kind === "ambience");
				audio.setRefDistance(kind === "ambience" ? 8 : 0.3);
				if (kind === "ambience") this.empty_room_audio = audio;
				else this.computer_startup_audio = audio;
				const anchor = this._experience.world?.scene1?.fixedComputer;
				if (anchor) {
					anchor.add(audio);
					if (this._ready.value && this._experience.router?.currentRouteKey === HOME_PAGE)
						audio.play();
				}
			}).catch(() => { /* Keep the room usable without optional sound. */ });
		}

		this._onBeforeCameraSwitch = () => this.listener.removeFromParent();
		this._onCameraSwitched = () => this._camera?.instance.add(this.listener);

		this._camera.on(events.BEFORE_CAMERA_SWITCH, this._onBeforeCameraSwitch);
		this._camera.on(events.CAMERA_SWITCHED, this._onCameraSwitched);

		this.emit(events.CONSTRUCTED);
	}

	public destruct() {
		this._disposed = true;
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

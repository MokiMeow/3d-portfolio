import { VideoTexture } from "three";

/** Upgrade a still screen only after an actual video frame is available.
 * The room never waits for this optional request or for autoplay permission.
 */
export function loadScreenVideo(url: string, onReady: (texture: VideoTexture) => void) {
	const video = document.createElement("video");
	video.muted = true;
	video.defaultMuted = true;
	video.loop = true;
	video.playsInline = true;
	video.preload = "auto";
	let texture: VideoTexture | undefined;
	let disposed = false;
	const clearReadiness = () => {
		clearTimeout(timeout);
		video.removeEventListener("loadeddata", ready);
		video.removeEventListener("canplay", ready);
		video.removeEventListener("error", dispose);
	};
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		clearReadiness();
		video.pause();
		video.removeAttribute("src");
		video.load();
		video.remove();
		texture?.dispose();
	};
	const ready = () => {
		if (disposed || texture || video.readyState < 2) return;
		clearReadiness();
		texture = new VideoTexture(video);
		onReady(texture);
	};
	// Data saver can suppress loadeddata altogether. Keep the poster and
	// release the request instead of retaining a stalled video indefinitely.
	const timeout = setTimeout(dispose, 15000);
	video.addEventListener("loadeddata", ready);
	video.addEventListener("canplay", ready);
	video.addEventListener("error", dispose);
	video.src = url;
	video.load();
	ready();
	return dispose;
}

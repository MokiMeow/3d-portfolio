/**
 * The screen layer of the sequence: letterbox, captions, JARVIS's protocol cards, the alarm vignette,
 * fades and end cards, and the way out (Skip / Esc). Plain DOM, so it ships inside the lazy module.
 * Nothing here flashes faster than twice a second (WCAG 2.3.1 allows three).
 */
const CSS = `
html.doomsday-on .lab-chrome,html.doomsday-on .companion-ui{opacity:0!important;pointer-events:none!important;transition:opacity .8s}
.dd{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;color:#ecefe7}
.dd-bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height 1.2s cubic-bezier(.6,0,.2,1)}
.dd-bar.top{top:0}.dd-bar.bottom{bottom:0}
.dd.letterbox .dd-bar{height:9vh}
.dd-fade{position:absolute;inset:0;background:#000;opacity:0;transition:opacity var(--fade,1s) ease}
.dd-white{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#ffffff 0%,#e4ecff 55%,#c9d8ff 100%);opacity:0;transition:opacity var(--white,1s) ease-in}
.dd-alarm{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,transparent 45%,rgb(255 60 30 / .42) 100%);transition:opacity .4s}
.dd-caption{position:absolute;left:50%;bottom:calc(9vh + 26px);translate:-50% 0;width:min(820px,calc(100vw - 40px));text-align:center;opacity:0;transition:opacity .35s}
.dd-caption.on{opacity:1}
.dd-caption b{display:block;font:500 11px/1 ui-monospace,'IBM Plex Mono',Consolas,monospace;letter-spacing:.32em;text-transform:uppercase;margin-bottom:9px;color:#f2b65a}
.dd-caption span{font-size:clamp(17px,2vw,22px);line-height:1.45;text-shadow:0 2px 14px #000,0 0 2px #000}
.dd-caption.doom b{color:#43f08e}.dd-caption.doom span{color:#d9ffe8;font-family:Georgia,'Times New Roman',serif;letter-spacing:.06em;text-transform:uppercase;font-size:clamp(18px,2.2vw,26px);text-shadow:0 0 18px rgb(67 240 142 / .55),0 2px 12px #000}
.dd-card{position:absolute;left:clamp(16px,4vw,56px);top:calc(9vh + 24px);font:500 12px/1.5 ui-monospace,'IBM Plex Mono',Consolas,monospace;letter-spacing:.2em;text-transform:uppercase;color:#f2b65a;opacity:0;transition:opacity .3s}
.dd-card.on{opacity:1}
.dd-card i{display:block;font-style:normal;font-size:10.5px;color:rgb(242 182 90 / .6);letter-spacing:.3em}
.dd-card span{display:block;font-size:clamp(15px,1.6vw,19px);letter-spacing:.24em;margin-top:4px}
.dd-card.alarm{color:#ff6b45}.dd-card.alarm i{color:rgb(255 107 69 / .7)}
.dd-readout{position:absolute;right:clamp(16px,4vw,56px);top:calc(9vh + 24px);text-align:right;font:500 11.5px/1.7 ui-monospace,'IBM Plex Mono',Consolas,monospace;letter-spacing:.16em;color:rgb(242 182 90 / .85);opacity:0;transition:opacity .4s}
.dd-readout.on{opacity:1}.dd-readout b{color:#fff1d6;font-weight:500}
.dd-end{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:18px;text-align:center;opacity:0;transition:opacity 1.6s}
.dd-end.on{opacity:1}
.dd-end h2{margin:0;font:400 clamp(30px,5.4vw,64px)/1.08 Georgia,'Times New Roman',serif;letter-spacing:.1em;text-transform:uppercase;color:#e9fff1;text-shadow:0 0 34px rgb(67 240 142 / .55)}
.dd-end p{margin:0;font:500 12px ui-monospace,'IBM Plex Mono',Consolas,monospace;letter-spacing:.34em;text-transform:uppercase;color:#43f08e}
.dd-end small{font:400 11px ui-monospace,Consolas,monospace;letter-spacing:.2em;color:rgb(236 239 231 / .45)}
.dd-end button{pointer-events:auto;margin-top:22px;padding:12px 22px;border:1px solid rgb(67 240 142 / .5);background:rgb(0 0 0 / .4);color:#d9ffe8;font:500 12px ui-monospace,Consolas,monospace;letter-spacing:.24em;text-transform:uppercase;cursor:pointer}
.dd-end button:hover,.dd-end button:focus-visible{background:rgb(67 240 142 / .15);outline:none}
.dd-skip{position:absolute;right:clamp(16px,3vw,40px);bottom:calc(9vh + 18px);pointer-events:auto;padding:8px 14px;border:1px solid rgb(255 255 255 / .22);background:rgb(0 0 0 / .35);color:rgb(255 255 255 / .75);font:500 11px ui-monospace,Consolas,monospace;letter-spacing:.22em;text-transform:uppercase;cursor:pointer;opacity:.6;transition:opacity .2s}
.dd-skip:hover,.dd-skip:focus-visible{opacity:1;outline:none}
.dd-sound{right:calc(clamp(16px,3vw,40px) + 108px)}
@media (prefers-reduced-motion:reduce){.dd *{transition-duration:.01s!important}}
`;

export type Speaker = "jarvis" | "doom" | "system";

export class Overlay {
	readonly root: HTMLElement;
	private caption: HTMLElement;
	private card: HTMLElement;
	private readout: HTMLElement;
	private alarm: HTMLElement;
	private fadeLayer: HTMLElement;
	private end: HTMLElement;
	private white: HTMLElement;
	private typing = 0;
	private alarmTimer = 0;
	private style: HTMLStyleElement;

	constructor(onSkip: () => void) {
		this.style = document.createElement("style");
		this.style.textContent = CSS;
		document.head.appendChild(this.style);
		const root = document.createElement("div");
		root.className = "dd";
		root.setAttribute("role", "presentation");
		root.innerHTML = `
			<div class="dd-alarm"></div>
			<div class="dd-bar top"></div><div class="dd-bar bottom"></div>
			<div class="dd-card"><i></i><span></span></div>
			<div class="dd-readout"></div>
			<div class="dd-caption" aria-live="polite"><b></b><span></span></div>
			<div class="dd-white"></div><div class="dd-fade"></div>
			<div class="dd-end"></div>
			<button class="dd-skip dd-sound" type="button" aria-pressed="false">Sound on</button>
			<button class="dd-skip" type="button" aria-label="Skip the sequence">Skip ▸▸</button>`;
		document.body.appendChild(root);
		this.root = root;
		this.caption = root.querySelector(".dd-caption")!;
		this.card = root.querySelector(".dd-card")!;
		this.readout = root.querySelector(".dd-readout")!;
		this.alarm = root.querySelector(".dd-alarm")!;
		this.fadeLayer = root.querySelector(".dd-fade")!;
		this.end = root.querySelector(".dd-end")!;
		this.white = root.querySelector(".dd-white")!;
		root.querySelector(".dd-skip:not(.dd-sound)")!.addEventListener("click", onSkip);
	}

	/** The sound switch: shows the current state, and asks the owner for the next one on each press. */
	sound(muted: boolean, toggle: () => boolean) {
		const button = this.root.querySelector<HTMLButtonElement>(".dd-sound")!;
		const show = (off: boolean) => { button.textContent = off ? "Sound off" : "Sound on"; button.setAttribute("aria-pressed", String(off)); };
		show(muted);
		button.addEventListener("click", () => show(toggle()));
	}

	letterbox(on: boolean) { this.root.classList.toggle("letterbox", on); document.documentElement.classList.toggle("doomsday-on", on); }

	/** A spoken line, typed on, held, then cleared. */
	say(speaker: Speaker, text: string, hold = 3.2) {
		clearInterval(this.typing);
		this.caption.classList.toggle("doom", speaker === "doom");
		this.caption.querySelector("b")!.textContent = speaker === "jarvis" ? "JARVIS" : speaker === "doom" ? "" : "SYSTEM";
		const span = this.caption.querySelector("span")!;
		span.textContent = "";
		this.caption.classList.add("on");
		let i = 0;
		this.typing = window.setInterval(() => {
			i += 2; span.textContent = text.slice(0, i);
			if (i >= text.length) clearInterval(this.typing);
		}, 22);
		window.setTimeout(() => { if (span.textContent && text.startsWith(span.textContent.slice(0, 8))) this.caption.classList.remove("on"); }, (hold + text.length * .011) * 1000);
	}
	clearCaption() { clearInterval(this.typing); this.caption.classList.remove("on"); }

	protocol(label: string, title: string, alarm = false) {
		this.card.classList.toggle("alarm", alarm);
		this.card.querySelector("i")!.textContent = label;
		this.card.querySelector("span")!.textContent = title;
		this.card.classList.add("on");
	}
	clearProtocol() { this.card.classList.remove("on"); }

	readouts(lines: [string, string][] | null) {
		if (!lines) { this.readout.classList.remove("on"); return; }
		this.readout.innerHTML = lines.map(([k, v]) => `${k} <b>${v}</b>`).join("<br>");
		this.readout.classList.add("on");
	}

	/** The red edge of an alarm, pulsing once a second at most. */
	setAlarm(on: boolean) {
		clearInterval(this.alarmTimer);
		if (!on) { this.alarm.style.opacity = "0"; return; }
		let up = true;
		const pulse = () => { this.alarm.style.opacity = up ? "1" : ".35"; up = !up; };
		pulse();
		this.alarmTimer = window.setInterval(pulse, 650);
	}

	fade(to: number, seconds = 1) {
		this.fadeLayer.style.setProperty("--fade", `${seconds}s`);
		this.fadeLayer.style.opacity = String(to);
	}

	/** The jump: one rise to white, never a strobe. */
	whiteout(to: number, seconds = 1) { this.white.style.setProperty("--white", `${seconds}s`); this.white.style.opacity = String(to); }

	showEnd(html: string) { this.end.innerHTML = html; this.end.classList.add("on"); return this.end; }
	hideEnd() { this.end.classList.remove("on"); }

	dispose() {
		clearInterval(this.typing); clearInterval(this.alarmTimer);
		document.documentElement.classList.remove("doomsday-on");
		this.root.remove(); this.style.remove();
	}
}

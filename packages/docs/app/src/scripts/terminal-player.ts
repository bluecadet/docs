// Wires up a fully custom-styled asciinema-player instance for every `<Terminal cast>` block on
// the page. Astro compiles this as a client module and includes it once per Terminal.astro
// instance that renders in `cast` mode — everything below is scoped per mount element
// (`document.querySelectorAll`, no `getElementById`) so several casts can coexist and play
// independently on the same page.
//
// The stock control bar is disabled (`controls: false` in the `create()` call below); the markup
// it's replaced with lives in Terminal.astro (`.terminal-controls`) and is driven entirely through
// the player's public API (`play`/`pause`/`seek`/`getCurrentTime`/`getDuration`) and its `play`,
// `pause`, `ended` events. Progress only re-renders via requestAnimationFrame while playing, not
// on a fixed interval, so it stops costing anything the moment playback pauses.
//
// The player's stock CSS is imported dynamically (see `init()` below), not statically here: every
// doc page renders through the single [...slug].astro route, so a static import would link that
// ~15.6KB chunk on every page, including ones with no Terminal. Loading it only once a cast mount
// is confirmed present keeps it out of the build's shared page graph.
import { create, type Player } from "asciinema-player";

const PLAY_GLYPH = "▶";
const PAUSE_GLYPH = "⏸";

function formatTime(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function setUpCast(mount: HTMLElement): void {
	const src = mount.dataset.terminalCast;
	if (!src) return;

	const root = mount.closest<HTMLElement>(".terminal-player");
	const playButton = root?.querySelector<HTMLButtonElement>("[data-terminal-play]");
	const progress = root?.querySelector<HTMLElement>("[data-terminal-progress]");
	const fill = root?.querySelector<HTMLElement>("[data-terminal-fill]");
	const time = root?.querySelector<HTMLElement>("[data-terminal-time]");

	const player: Player = create(src, mount, {
		controls: false,
		fit: "width",
		theme: "docs",
		preload: true,
		rows: mount.dataset.terminalRows ? Number(mount.dataset.terminalRows) : undefined,
		cols: mount.dataset.terminalCols ? Number(mount.dataset.terminalCols) : undefined,
		poster: mount.dataset.terminalPoster || undefined,
		loop: mount.dataset.terminalLoop === "true",
		// Mirrors --font-mono (see tokens.css) — the player renders to a <canvas>, so it can't read
		// the CSS custom property directly and needs the stack passed in literally.
		terminalFontFamily: "'IBM Plex Mono', ui-monospace, monospace",
		terminalLineHeight: 1.5,
	});

	let raf = 0;

	// Duration/current can be 0, undefined, or NaN before the cast has finished loading — `duration
	// > 0` doubles as the divide-by-zero guard for the fill-width math below.
	function renderProgress(): void {
		const duration = player.getDuration() ?? 0;
		const current = player.getCurrentTime();
		if (fill) {
			fill.style.inlineSize = duration > 0 ? `${Math.min(100, (current / duration) * 100)}%` : "0%";
		}
		if (time) time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
	}

	function tick(): void {
		renderProgress();
		raf = requestAnimationFrame(tick);
	}

	// The player exposes no "error" event, so a failed cast load (e.g. a 404) only ever surfaces as
	// a rejected `play()`/`seek()` promise. Smallest honest failure state: kill the rAF loop, park
	// the time readout on an explicit message, and disable the play button rather than leaving the
	// controls sitting dead at 0:00/0:00.
	function setErrorState(): void {
		cancelAnimationFrame(raf);
		if (playButton) {
			playButton.disabled = true;
			playButton.dataset.playing = "false";
			playButton.setAttribute("aria-label", "Playback unavailable");
		}
		if (time) {
			time.textContent = "failed to load recording";
			time.classList.add("terminal-time-error");
		}
	}

	playButton?.addEventListener("click", () => {
		if (playButton.dataset.playing === "true") player.pause();
		else player.play().catch(setErrorState);
	});

	progress?.addEventListener("click", (event) => {
		const rect = progress.getBoundingClientRect();
		const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
		player
			.seek(`${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`)
			.then(renderProgress)
			.catch(setErrorState);
	});

	player.addEventListener("play", () => {
		if (playButton) {
			playButton.textContent = PAUSE_GLYPH;
			playButton.dataset.playing = "true";
			playButton.setAttribute("aria-label", "Pause");
		}
		cancelAnimationFrame(raf);
		tick();
	});

	const stop = () => {
		if (playButton) {
			playButton.textContent = PLAY_GLYPH;
			playButton.dataset.playing = "false";
			playButton.setAttribute("aria-label", "Play");
		}
		cancelAnimationFrame(raf);
		renderProgress();
	};
	player.addEventListener("pause", stop);
	player.addEventListener("ended", stop);

	renderProgress();
}

// Resolved to a plain URL (the `?url` suffix), not imported as a CSS module: a bare dynamic
// `import("…css")` still gets pulled into Vite's page-level CSS graph and linked in every page's
// `<head>` at build time — the exact leak this is meant to avoid. A `<link>` appended to the head
// only once a cast mount is confirmed present is the one approach that actually keeps this ~15.6KB
// stylesheet off pages with no Terminal.
async function loadStockPlayerCss(): Promise<void> {
	const { default: href } = await import("asciinema-player/dist/bundle/asciinema-player.css?url");
	if (document.querySelector(`link[data-terminal-player-css]`)) return;
	await new Promise<void>((resolve) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		link.dataset.terminalPlayerCss = "";
		link.addEventListener("load", () => resolve());
		link.addEventListener("error", () => resolve());
		document.head.appendChild(link);
	});
}

async function init(): Promise<void> {
	const mounts = document.querySelectorAll<HTMLElement>("[data-terminal-cast]");
	if (mounts.length === 0) return;

	// Loaded before any player is created so the structural styles (`.ap-wrapper` etc.) are already
	// in place when the first one renders.
	await loadStockPlayerCss();

	for (const mount of mounts) setUpCast(mount);
}

init();

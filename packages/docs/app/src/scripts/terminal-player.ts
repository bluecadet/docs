// Wires up a fully custom-styled asciinema-player instance for every `<Terminal cast>` block on
// the page. Astro compiles this as a client module and includes it once per Terminal.astro
// instance that renders in `cast` mode — everything below is scoped per mount element
// (`document.querySelectorAll`, no `getElementById`) so several casts can coexist and play
// independently on the same page.
//
// The stock control bar is disabled (`controls: false` in the `create()` call below); play/pause
// and restart live in Terminal.astro's title bar instead (`.terminal-cast-actions`) and are driven
// entirely through the player's public API (`play`/`pause`/`seek`) and its `play`/`pause`/`ended`
// events.
//
// The player's stock CSS is imported dynamically (see `init()` below), not statically here: every
// doc page renders through the single [...slug].astro route, so a static import would link that
// ~15.6KB chunk on every page, including ones with no Terminal. Loading it only once a cast mount
// is confirmed present keeps it out of the build's shared page graph.
import { create, type Player } from "asciinema-player";

const PLAY_GLYPH = "▶";
const PAUSE_GLYPH = "⏸";

function setUpCast(mount: HTMLElement): void {
	const src = mount.dataset.terminalCast;
	if (!src) return;

	const root = mount.closest<HTMLElement>(".terminal");
	const playButton = root?.querySelector<HTMLButtonElement>("[data-terminal-play]");
	const restartButton = root?.querySelector<HTMLButtonElement>("[data-terminal-restart]");

	const player: Player = create(src, mount, {
		controls: false,
		fit: "none",
		preload: true,
		rows: mount.dataset.terminalRows ? Number(mount.dataset.terminalRows) : undefined,
		cols: mount.dataset.terminalCols ? Number(mount.dataset.terminalCols) : undefined,
		poster: mount.dataset.terminalPoster || undefined,
		loop: mount.dataset.terminalLoop === "true",
		// Mirrors --font-mono (see tokens.css) and `.type-md`'s 13px — the player renders to a
		// <canvas>, so it can't read either CSS custom property directly and needs both passed in
		// literally.
		terminalFontFamily: "'IBM Plex Mono', ui-monospace, monospace",
		terminalFontSize: "13px",
		terminalLineHeight: 1.5,
	});

	// The player exposes no "error" event, so a failed cast load (e.g. a 404) only ever surfaces as
	// a rejected `play()`/`seek()` promise. Smallest honest failure state: disable both buttons
	// rather than leaving them sitting dead.
	function setErrorState(): void {
		if (playButton) {
			playButton.disabled = true;
			playButton.dataset.playing = "false";
			playButton.setAttribute("aria-label", "Playback unavailable");
		}
		if (restartButton) restartButton.disabled = true;
	}

	playButton?.addEventListener("click", () => {
		if (playButton.dataset.playing === "true") player.pause();
		else player.play().catch(setErrorState);
	});

	restartButton?.addEventListener("click", () => {
		player
			.seek(0)
			.then(() => player.play())
			.catch(setErrorState);
	});

	function setPlayButtonState(playing: boolean): void {
		if (!playButton) return;
		playButton.textContent = playing ? PAUSE_GLYPH : PLAY_GLYPH;
		playButton.dataset.playing = playing ? "true" : "false";
		playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
	}

	player.addEventListener("play", () => setPlayButtonState(true));
	player.addEventListener("pause", () => setPlayButtonState(false));
	player.addEventListener("ended", () => setPlayButtonState(false));

	// Plays while the terminal is in view and pauses the moment it scrolls off — kept symmetric so
	// a cast never keeps running (or sits stuck mid-playback) off-screen — skipped entirely for
	// visitors who prefer reduced motion.
	if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) player.play().catch(setErrorState);
					else player.pause();
				}
			},
			{ threshold: 0.5 },
		);
		observer.observe(mount);
	}
}

// `?url` resolves this to the asset's path rather than inlining/linking it — see the file header
// for why the load has to be dynamic at all.
async function loadStockPlayerCss(): Promise<void> {
	const { default: href } = await import("asciinema-player/dist/bundle/asciinema-player.css?url");
	if (document.querySelector("link[data-terminal-player-css]")) return;
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

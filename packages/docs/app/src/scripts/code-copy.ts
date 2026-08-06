// Copy-button behavior for code blocks emitted by `rehype-code-blocks.ts`. Loaded on every page
// via the `astro:config:setup` `injectScript("page", ...)` integration in astro.config.mjs —
// there's no layout component in this package to attach a <script> to directly.
const COPIED_LABEL = "copied";
const RESET_MS = 1500;

function initCodeCopy(): void {
	for (const button of document.querySelectorAll<HTMLButtonElement>(".code-copy")) {
		if (button.dataset.copyInit) continue;
		button.dataset.copyInit = "true";

		const originalLabel = button.textContent ?? "copy";
		let resetTimer: ReturnType<typeof setTimeout> | undefined;

		button.addEventListener("click", () => {
			const code = button.closest(".code-block")?.querySelector("pre")?.textContent ?? "";
			if (!code) return;

			navigator.clipboard.writeText(code).then(() => {
				clearTimeout(resetTimer);
				button.textContent = COPIED_LABEL;
				button.classList.add("code-copy--copied");
				resetTimer = setTimeout(() => {
					button.textContent = originalLabel;
					button.classList.remove("code-copy--copied");
				}, RESET_MS);
			});
		});
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initCodeCopy);
} else {
	initCodeCopy();
}

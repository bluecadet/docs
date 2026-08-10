// Copy-button behavior for code blocks emitted by `rehype-code-blocks.ts`. Loaded on every page
// via the `astro:config:setup` `injectScript("page", ...)` integration in astro.config.mjs —
// there's no layout component in this package to attach a <script> to directly.
//
// A single delegated listener handles every `.code-copy` button on the page (most pages have
// none, and some have several), instead of one listener per button. Per-button state that used to
// live in the loop closure (original label, pending reset timer) is keyed off the button element
// itself via a WeakMap so repeated clicks still reset cleanly.
const COPIED_LABEL = "copied";
const RESET_MS = 1500;

const resetTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();
const originalLabels = new WeakMap<HTMLButtonElement, string>();

function handleClick(event: MouseEvent): void {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".code-copy");
	if (!button) return;

	const code = button.closest(".code-block")?.querySelector("pre")?.textContent ?? "";
	if (!code) return;

	let originalLabel = originalLabels.get(button);
	if (originalLabel === undefined) {
		originalLabel = button.textContent ?? "copy";
		originalLabels.set(button, originalLabel);
	}

	navigator.clipboard.writeText(code).then(() => {
		const existingTimer = resetTimers.get(button);
		if (existingTimer) clearTimeout(existingTimer);

		button.textContent = COPIED_LABEL;
		button.classList.add("code-copy--copied");
		resetTimers.set(
			button,
			setTimeout(() => {
				button.textContent = originalLabel;
				button.classList.remove("code-copy--copied");
			}, RESET_MS),
		);
	});
}

document.addEventListener("click", handleClick);

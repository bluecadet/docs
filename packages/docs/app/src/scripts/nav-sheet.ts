// Client behavior for NavSheet.astro: a full-screen mobile/tablet nav drawer built on a native
// <dialog> — see ../lib/dialog.ts for the shared focus-trap/scroll-lock/esc mechanics.
import { bindDialogChrome } from "../lib/dialog.js";

export function initNavSheet(): void {
	const dialog = document.getElementById("nav-sheet") as HTMLDialogElement | null;
	if (!dialog) return;

	const closeButton = dialog.querySelector<HTMLElement>("[data-nav-sheet-close]");
	const { open: openSheet, close: closeSheet } = bindDialogChrome(dialog);

	closeButton?.addEventListener("click", closeSheet);

	// Close the sheet before SearchModal's own [data-search-trigger] listener opens the search
	// dialog on top of it. This relies on attachment order: NavSheet.astro's script tag is placed
	// before SearchModal.astro's in every page that includes both, so this listener (added here,
	// directly on the button) runs first when the same element has two click listeners.
	dialog.querySelectorAll<HTMLElement>("[data-search-trigger]").forEach((trigger) => {
		trigger.addEventListener("click", closeSheet);
	});

	document.querySelectorAll<HTMLElement>("[data-nav-sheet-trigger]").forEach((trigger) => {
		trigger.addEventListener("click", () => openSheet(trigger));
	});

	// NavSheet.astro hides itself with `display: none !important` at tablet/desktop widths
	// (>=768px), but a resize while it's open leaves the underlying `<dialog>` still `open` — and
	// therefore still modal-blocking the rest of the page — with nothing visible to close it.
	// Close it ourselves the moment the viewport crosses out of mobile.
	const desktopQuery = window.matchMedia("(min-width: 768px)");
	desktopQuery.addEventListener("change", (event) => {
		if (event.matches) closeSheet();
	});
}

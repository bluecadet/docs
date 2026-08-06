// Client behavior for NavSheet.astro: a native <dialog> used as a full-screen mobile/tablet nav
// drawer. `<dialog>.showModal()` already gives us a focus trap (background content becomes inert)
// and an `esc`-to-close/`cancel` event for free — same pattern SearchModal.astro's script relies
// on — so this only has to handle opening, body-scroll locking, and closing on backdrop click.
export function initNavSheet(): void {
	const dialog = document.getElementById("nav-sheet") as HTMLDialogElement | null;
	if (!dialog) return;

	const closeButton = dialog.querySelector<HTMLElement>("[data-nav-sheet-close]");
	let lastTrigger: HTMLElement | null = null;

	function lockScroll(locked: boolean): void {
		document.documentElement.style.overflow = locked ? "hidden" : "";
	}

	function openSheet(trigger?: HTMLElement | null): void {
		lastTrigger = trigger ?? (document.activeElement as HTMLElement | null);
		if (typeof dialog?.showModal === "function") {
			dialog.showModal();
			lockScroll(true);
		}
	}

	function closeSheet(): void {
		if (dialog?.open) dialog.close();
	}

	closeButton?.addEventListener("click", closeSheet);

	// Close the sheet before SearchModal's own [data-search-trigger] listener opens the search
	// dialog on top of it. This relies on attachment order: NavSheet.astro's script tag is placed
	// before SearchModal.astro's in every page that includes both, so this listener (added here,
	// directly on the button) runs first when the same element has two click listeners.
	dialog.querySelectorAll<HTMLElement>("[data-search-trigger]").forEach((trigger) => {
		trigger.addEventListener("click", closeSheet);
	});

	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) closeSheet();
	});

	dialog.addEventListener("close", () => {
		lockScroll(false);
		lastTrigger?.focus();
	});

	document.querySelectorAll<HTMLElement>("[data-nav-sheet-trigger]").forEach((trigger) => {
		trigger.addEventListener("click", () => openSheet(trigger));
	});

	// NavSheet.astro hides itself with `display: none !important` at desktop widths (>=1024px),
	// but a resize while it's open leaves the underlying `<dialog>` still `open` — and therefore
	// still modal-blocking the rest of the page — with nothing visible to close it. Close it
	// ourselves the moment the viewport crosses into desktop.
	const desktopQuery = window.matchMedia("(min-width: 1024px)");
	desktopQuery.addEventListener("change", (event) => {
		if (event.matches) closeSheet();
	});
}

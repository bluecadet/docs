// Shared <dialog> chrome for SearchModal.astro's and NavSheet.astro's client scripts, which both
// wrap the same native modal-dialog pattern: `showModal()` gives a focus trap, background-scroll
// lock (see the `html:has(dialog:modal)` rule in styles/global.css), and esc/`cancel` handling for
// free, so all that's left to wire ourselves is opening (capturing a trigger to refocus later),
// closing on a backdrop click, and restoring focus to that trigger on the dialog's native `close`
// event. Each caller layers its own extra open/close behavior (input focus, result rendering, etc.)
// around what this returns.
export interface DialogChrome {
	/** Captures `trigger` (or the current active element) for later focus restoration, then opens
	    `dialog` modally when `showModal` is supported. */
	open(trigger?: HTMLElement | null): void;
	/** Closes `dialog` if it's currently open. */
	close(): void;
}

export function bindDialogChrome(dialog: HTMLDialogElement): DialogChrome {
	let lastTrigger: HTMLElement | null = null;

	function open(trigger?: HTMLElement | null): void {
		lastTrigger = trigger ?? (document.activeElement as HTMLElement | null);
		if (typeof dialog.showModal === "function") {
			dialog.showModal();
		}
	}

	function close(): void {
		if (dialog.open) dialog.close();
	}

	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) close();
	});

	dialog.addEventListener("close", () => {
		lastTrigger?.focus();
	});

	return { open, close };
}

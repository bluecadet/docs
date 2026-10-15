/** Both responsive TOCs follow the same heading, including on direct fragment navigation. */
export function setupTocScrollSpy(): void {
	const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-toc] .toc-link"));
	const targets = Array.from(new Map(links.map((link) => [link.hash, link])).values())
		.map((link) => {
			// Read the authored href for the literal ID; URL.hash percent-encodes Unicode.
			const id = link.getAttribute("href")?.slice(1);
			const heading = id ? document.getElementById(id) : null;
			return heading ? { hash: link.hash, heading } : null;
		})
		.filter((target) => target !== null);
	if (targets.length === 0) return;

	const setActive = (hash: string) => {
		for (const link of links) {
			const active = link.hash === hash;
			link.classList.toggle("is-active", active);
			if (active) link.setAttribute("aria-current", "location");
			else link.removeAttribute("aria-current");
		}
	};

	const updateFromScroll = () => {
		// Near the document end a fragment target may not be able to reach the header offset.
		// Keep that visible target current instead of immediately reverting to its parent.
		const atBottom =
			window.scrollY > 0 &&
			Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
		if (atBottom) {
			const fragment = targets.find((target) => {
				const top = target.heading.getBoundingClientRect().top;
				return target.hash === window.location.hash && top >= 0 && top < window.innerHeight;
			});
			const last = fragment ?? targets.at(-1);
			if (last) setActive(last.hash);
			return;
		}

		let active = targets[0];
		for (const target of targets) {
			const offset =
				Number.parseFloat(getComputedStyle(target.heading).scrollMarginBlockStart) || 0;
			if (target.heading.getBoundingClientRect().top > offset + 1) break;
			active = target;
		}
		if (active) setActive(active.hash);
	};

	const updateFromHash = () => {
		const target = targets.find((entry) => entry.hash === window.location.hash);
		if (target) setActive(target.hash);
		else updateFromScroll();
	};

	// Scroll events also catch headings passed between observer callbacks (e.g. a fast upward
	// scroll). Coalesce layout reads to one per frame, rather than reading on every event.
	let scheduled = false;
	const scheduleUpdate = () => {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			updateFromScroll();
		});
	};

	window.addEventListener("scroll", scheduleUpdate, { passive: true });
	window.addEventListener("resize", scheduleUpdate);
	window.addEventListener("hashchange", updateFromHash);
	updateFromHash();
}

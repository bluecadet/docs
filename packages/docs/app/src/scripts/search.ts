// Client behavior for SearchModal.astro. Vanilla TS, no framework — wires a native <dialog> to
// pagefind (index emitted at build time by the astro:build:done hook in astro.config.mjs). In
// dev, the pagefind module 404s (index only exists in a production build output); that's caught
// and rendered as a notice rather than crashing.

interface RecentEntry {
	href: string;
	title: string;
}

interface StartHereEntry {
	href: string;
	label: string;
}

interface PagefindResultData {
	url: string;
	excerpt: string;
	meta?: { title?: string };
}

interface PagefindResult {
	id: string;
	data: () => Promise<PagefindResultData>;
}

interface PagefindModule {
	search: (query: string) => Promise<{ results: PagefindResult[] }>;
}

const RECENT_KEY = "docs:recent-pages";
const RECENT_CAP = 5;
const DEBOUNCE_MS = 120;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function readJson<T>(elementId: string, fallback: T): T {
	const el = document.getElementById(elementId);
	if (!el?.textContent) return fallback;
	try {
		return JSON.parse(el.textContent) as T;
	} catch {
		return fallback;
	}
}

function readRecent(): RecentEntry[] {
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function recordRecent(href: string, title: string): void {
	if (!href || !title) return;
	try {
		const existing = readRecent().filter((entry) => entry.href !== href);
		existing.unshift({ href, title });
		localStorage.setItem(RECENT_KEY, JSON.stringify(existing.slice(0, RECENT_CAP)));
	} catch {
		// localStorage unavailable (private mode, disabled, etc) — recent pages just won't persist.
	}
}

export function initSearchModal(): void {
	const dialog = document.getElementById("search-modal") as HTMLDialogElement | null;
	const input = document.querySelector<HTMLInputElement>("[data-search-input]");
	const body = document.querySelector<HTMLDivElement>("[data-search-body]");
	const icon = document.querySelector<HTMLElement>("[data-search-icon]");
	const status = document.querySelector<HTMLElement>("[data-search-status]");
	const hints = document.querySelector<HTMLElement>("[data-search-hints]");
	if (!dialog || !input || !body || !icon || !status || !hints) return;

	const startHere = readJson<StartHereEntry[]>("search-start-here-data", []);
	const repoUrl = readJson<string | null>("search-repo-url-data", null);

	let lastTrigger: HTMLElement | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let searchToken = 0;
	let pagefindPromise: Promise<PagefindModule> | null = null;
	let activeIndex = 0;
	let rows: HTMLElement[] = [];

	function loadPagefind(): Promise<PagefindModule> {
		if (!pagefindPromise) {
			const base = import.meta.env.BASE_URL;
			const url = `${base}pagefind/pagefind.js`.replace(/\/{2,}/g, "/");
			pagefindPromise = import(/* @vite-ignore */ url) as Promise<PagefindModule>;
		}
		return pagefindPromise;
	}

	function setIcon(attention: boolean): void {
		icon.classList.toggle("is-attention", attention);
	}

	function setStatus(text: string, attention = false): void {
		status.textContent = text;
		status.classList.toggle("is-attention", attention);
	}

	function setHintsIndexing(indexing: boolean): void {
		hints.classList.toggle("is-indexing", indexing);
		hints.innerHTML = indexing
			? `<span>▞ indexing…</span>`
			: `<span class="kbd-hint"><kbd>↑↓</kbd> navigate</span>` +
				`<span class="kbd-hint"><kbd>↵</kbd> open</span>` +
				`<span class="kbd-hint"><kbd>esc</kbd> close</span>`;
	}

	function rowHtml(item: { href: string; title: string; description?: string; icon: string }, id: string): string {
		return (
			`<a class="search-row" id="${id}" role="option" data-href="${escapeHtml(item.href)}" ` +
			`data-title="${escapeHtml(item.title)}" href="${escapeHtml(item.href)}">` +
			`<span class="search-row__bullet" aria-hidden="true">${item.icon}</span>` +
			`<span class="search-row__text">` +
			`<span class="search-row__title">${escapeHtml(item.title)}</span>` +
			(item.description ? `<span class="search-row__desc">${item.description}</span>` : "") +
			`</span>` +
			`<span class="search-row__enter" aria-hidden="true">↵</span>` +
			`</a>`
		);
	}

	function groupHtml(label: string, items: string[]): string {
		if (items.length === 0) return "";
		return `<div class="search-group"><div class="search-group__label">${label}</div>${items.join("")}</div>`;
	}

	function afterRender(): void {
		rows = Array.from(body.querySelectorAll<HTMLElement>(".search-row"));
		activeIndex = 0;
		updateActiveRow();
	}

	function updateActiveRow(): void {
		rows.forEach((row, index) => {
			const isActive = index === activeIndex;
			row.classList.toggle("is-active", isActive);
			row.setAttribute("aria-selected", String(isActive));
		});
		const active = rows[activeIndex];
		input.setAttribute("aria-activedescendant", active?.id ?? "");
		active?.scrollIntoView({ block: "nearest" });
	}

	function moveActive(delta: number): void {
		if (rows.length === 0) return;
		activeIndex = (activeIndex + delta + rows.length) % rows.length;
		updateActiveRow();
	}

	function navigateToActive(): void {
		const active = rows[activeIndex];
		if (!active) return;
		const href = active.dataset.href;
		const title = active.dataset.title ?? "";
		if (!href) return;
		recordRecent(href, title);
		window.location.href = href;
	}

	function renderEmptyState(): void {
		setIcon(false);
		setStatus("");
		setHintsIndexing(false);

		const recent = readRecent();
		let idCounter = 0;
		const recentRows = recent.map((entry) =>
			rowHtml({ href: entry.href, title: entry.title, icon: "↩" }, `search-option-${idCounter++}`),
		);
		const startHereRows = startHere.map((entry) =>
			rowHtml({ href: entry.href, title: entry.label, icon: "▸" }, `search-option-${idCounter++}`),
		);

		const html = groupHtml("RECENT", recentRows) + groupHtml("START HERE", startHereRows);
		body.innerHTML = html || `<p class="search-empty-note">Start typing to search the docs.</p>`;
		afterRender();
	}

	function clearRows(): void {
		rows = [];
		activeIndex = 0;
		input.removeAttribute("aria-activedescendant");
	}

	function renderLoadingState(): void {
		setIcon(false);
		setStatus("searching…");
		setHintsIndexing(false);
		body.innerHTML = Array.from({ length: 3 })
			.map(
				() =>
					`<div class="search-skeleton-row"><span></span><span><span class="search-skeleton-bar"></span><span class="search-skeleton-bar"></span></span></div>`,
			)
			.join("");
		clearRows();
	}

	function renderResultsState(grouped: Map<string, { href: string; title: string; description: string }[]>, total: number): void {
		setIcon(false);
		setStatus(`${total} result${total === 1 ? "" : "s"}`);
		setHintsIndexing(false);

		let idCounter = 0;
		let html = "";
		for (const [label, items] of grouped) {
			const itemsHtml = items.map((item) =>
				rowHtml(
					{ href: item.href, title: item.title, description: item.description, icon: "▸" },
					`search-option-${idCounter++}`,
				),
			);
			html += groupHtml(label, itemsHtml);
		}
		body.innerHTML = html;
		afterRender();
	}

	function renderNoResultsState(query: string): void {
		setIcon(true);
		setStatus("0 results", true);
		setHintsIndexing(false);

		const pills: string[] = [];
		if (repoUrl) {
			pills.push(
				`<a class="search-pill search-pill--neutral" href="${escapeHtml(repoUrl)}/issues?q=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer">search github issues ↗</a>`,
			);
			pills.push(
				`<a class="search-pill search-pill--amber" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">open github ↗</a>`,
			);
		}

		body.innerHTML =
			`<div class="search-callout">` +
			`<span class="search-callout__label">Not found</span>` +
			`No matches for “${escapeHtml(query)}”. Try a different term, or browse a section from the sidebar.` +
			`</div>` +
			(pills.length > 0 ? `<div class="search-pills">${pills.join("")}</div>` : "");
		clearRows();
	}

	function renderDevNoticeState(): void {
		setIcon(true);
		setStatus("0 results", true);
		setHintsIndexing(false);
		body.innerHTML =
			`<div class="search-callout">` +
			`<span class="search-callout__label">Not found</span>` +
			`Search index is built at build time — run a production build to enable search.` +
			`</div>`;
		clearRows();
	}

	function groupResultsByTopSegment(
		results: PagefindResultData[],
	): Map<string, { href: string; title: string; description: string }[]> {
		const base = import.meta.env.BASE_URL;
		const groups = new Map<string, { href: string; title: string; description: string }[]>();

		for (const item of results) {
			let path = item.url;
			try {
				path = new URL(item.url, window.location.origin).pathname;
			} catch {
				// item.url was already a bare path — use as-is.
			}
			if (path.startsWith(base)) path = path.slice(base.length);
			path = path.replace(/^\/+/, "");
			const segment = path.split("/")[0] || "docs";
			const label = segment.toUpperCase();

			const entry = {
				href: item.url,
				title: item.meta?.title || path,
				description: item.excerpt,
			};
			const existing = groups.get(label);
			if (existing) {
				existing.push(entry);
			} else {
				groups.set(label, [entry]);
			}
		}

		return groups;
	}

	async function runSearch(query: string): Promise<void> {
		const token = ++searchToken;
		let pagefind: PagefindModule;
		try {
			pagefind = await loadPagefind();
		} catch {
			if (token !== searchToken) return;
			renderDevNoticeState();
			return;
		}

		let searchResult: { results: PagefindResult[] };
		try {
			searchResult = await pagefind.search(query);
		} catch {
			if (token !== searchToken) return;
			renderDevNoticeState();
			return;
		}
		if (token !== searchToken) return;

		const top = searchResult.results.slice(0, 10);
		const data = await Promise.all(top.map((result) => result.data()));
		if (token !== searchToken) return;

		if (data.length === 0) {
			renderNoResultsState(query);
			return;
		}

		const grouped = groupResultsByTopSegment(data);
		renderResultsState(grouped, data.length);
	}

	function onInput(): void {
		const query = input.value.trim();
		clearTimeout(debounceTimer);
		// Bump the token so any in-flight search from a previous keystroke (already past the
		// debounce and awaiting pagefind) can't clobber whatever we render next.
		searchToken++;
		if (!query) {
			renderEmptyState();
			return;
		}
		renderLoadingState();
		debounceTimer = setTimeout(() => {
			void runSearch(query);
		}, DEBOUNCE_MS);
	}

	function openModal(trigger?: HTMLElement | null): void {
		lastTrigger = trigger ?? (document.activeElement as HTMLElement | null);
		input.value = "";
		renderEmptyState();
		if (typeof dialog.showModal === "function") {
			dialog.showModal();
		}
		input.focus();
	}

	input.addEventListener("input", onInput);

	body.addEventListener("click", (event) => {
		const row = (event.target as HTMLElement).closest<HTMLElement>(".search-row[data-href]");
		if (!row) return;
		recordRecent(row.dataset.href ?? "", row.dataset.title ?? "");
	});

	dialog.addEventListener("keydown", (event) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActive(1);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActive(-1);
		} else if (event.key === "Enter") {
			event.preventDefault();
			navigateToActive();
		}
	});

	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) dialog.close();
	});

	dialog.addEventListener("close", () => {
		lastTrigger?.focus();
	});

	document.querySelectorAll<HTMLElement>("[data-search-trigger]").forEach((trigger) => {
		trigger.addEventListener("click", () => openModal(trigger));
	});

	document.addEventListener("keydown", (event) => {
		if (event.key !== "/" || dialog.open) return;
		const target = event.target as HTMLElement | null;
		const tag = target?.tagName;
		const isEditable = tag === "INPUT" || tag === "TEXTAREA" || Boolean(target?.isContentEditable);
		if (isEditable) return;
		event.preventDefault();
		openModal();
	});
}

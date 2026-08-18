// Client behavior for pages/404.astro. Reads the requested path from `location.pathname` (the
// server has no idea what URL 404'd — GitHub Pages serves the same static 404.html for every
// miss) and the build-time route list serialized into #notfound-routes-data, then renders the
// "requested" panel and the "did you mean" suggestions.
import { similarity } from "./similarity";

interface RouteEntry {
	id: string;
	href: string;
	title: string;
}

interface RoutesPayload {
	base: string;
	routes: RouteEntry[];
}

const MATCH_THRESHOLD = 0.4;
const MAX_SUGGESTIONS = 3;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderRequestedPath(el: Element, pathname: string): void {
	const parts = pathname.split("/").filter(Boolean);
	if (parts.length === 0) {
		el.textContent = "/";
		return;
	}
	// parts.length > 0 is checked above, so the last element always exists.
	const last = parts[parts.length - 1] ?? "";
	const lead = parts.slice(0, -1);
	const leadHtml = lead.length > 0 ? `${lead.map(escapeHtml).join("/")}/` : "";
	el.innerHTML = `/${leadHtml}<span class="requested-highlight">${escapeHtml(last)}</span>`;
}

export function initNotFound(): void {
	const dataEl = document.getElementById("notfound-routes-data");
	const requestedPathEl = document.querySelector("[data-requested-path]");
	const closestRow = document.querySelector<HTMLElement>("[data-requested-closest]");
	const closestPathEl = document.querySelector("[data-closest-path]");
	const closestPctEl = document.querySelector("[data-closest-pct]");
	const dymLabel = document.querySelector<HTMLElement>("[data-dym-label]");
	const dymList = document.querySelector<HTMLElement>("[data-dym-list]");
	if (!dataEl?.textContent || !requestedPathEl) return;

	let payload: RoutesPayload;
	try {
		payload = JSON.parse(dataEl.textContent);
	} catch {
		return;
	}

	const pathname = window.location.pathname;
	renderRequestedPath(requestedPathEl, pathname);

	const { base, routes } = payload;
	const stripped = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	const target = stripped.replace(/^\/+|\/+$/g, "").toLowerCase();
	if (!target || routes.length === 0) return;

	const scored = routes
		.map((route) => ({ route, score: similarity(target, route.id.toLowerCase()) }))
		.sort((a, b) => b.score - a.score);

	const best = scored[0];
	if (!best || best.score < MATCH_THRESHOLD) return;

	if (closestRow && closestPathEl && closestPctEl) {
		closestPathEl.textContent = best.route.id;
		closestPctEl.textContent = `${Math.round(best.score * 100)}% match`;
		closestRow.hidden = false;
	}

	if (dymLabel && dymList) {
		dymList.innerHTML = "";
		scored.slice(0, MAX_SUGGESTIONS).forEach((entry, i) => {
			const row = document.createElement("a");
			row.href = entry.route.href;
			row.className = i === 0 ? "dym-row dym-row--active active-row" : "dym-row";
			row.innerHTML = `
				<span class="dym-bullet type-sm">▸</span>
				<span class="dym-text">
					<span class="dym-title">${escapeHtml(entry.route.title)}</span>
					<span class="dym-path">${escapeHtml(entry.route.id)}</span>
				</span>
				<span class="dym-enter type-2xs">${i === 0 ? "↵" : ""}</span>
			`;
			dymList.appendChild(row);
		});
		dymLabel.hidden = false;
		dymList.hidden = false;
	}
}

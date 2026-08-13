/**
 * Generates a small SVG favicon from a site's `glyph` + `accent` config — the two per-site
 * identity levers `docs.config.yaml` exposes. Only called when `glyph` is set; sites without one
 * keep the shared default document icon (see sync.ts's `STATIC_PUBLIC_FILES`).
 */

const DEFAULT_BG = "#101112"; // tokens.css's --bg
const DEFAULT_ACCENT = "#9cc3a9"; // tokens.css's --accent (sage)

export function generateFaviconSvg(glyph: string, accent?: string): string {
	const fill = accent ?? DEFAULT_ACCENT;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${DEFAULT_BG}"/><text x="16" y="17" text-anchor="middle" dominant-baseline="central" font-family="ui-monospace, 'IBM Plex Mono', monospace" font-size="19" font-weight="600" fill="${fill}">${escapeXml(glyph)}</text></svg>`;
}

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => {
		switch (char) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&apos;";
			default:
				return char;
		}
	});
}

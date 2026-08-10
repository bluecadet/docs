// Shared "plain clause + italic accent-2 clause" heading split, used by every landing component
// that highlights part of a heading in the accent-2 color (LandingHero's hero title, GlyphList's
// band title, ClosingCta's derived/explicit headline).

/** The three pieces of an accent-split heading, ready to render as `{before}{accent}{after}`. */
export interface AccentSplit {
	/** Plain text before the accent (or the whole string, when there's nothing to highlight). */
	before: string;
	/** The accent text to render in italic accent-2, or `null` when there's nothing to highlight. */
	accent: string | null;
	/** Plain text after the accent. Always `""` when the accent runs to the end of the string. */
	after: string;
}

/**
 * Splits `text` around `marker` for the landing page's repeated "plain clause, *italic accent-2
 * clause*" heading treatment. Returns `{ before: text, accent: null, after: "" }` when `marker`
 * is falsy or isn't found in `text`, signalling the caller to render `text` as a single plain run.
 *
 * Two modes, matching the two ways a heading gets its accent:
 *
 * - `markerIsAccent: true` (GlyphList's arbitrary highlighted phrase within a longer title;
 *   ClosingCta's already-separate headline + accent, pre-joined by the caller before calling
 *   this) — `marker` itself becomes the accent, and any text after it survives as `after`.
 * - `markerIsAccent: false`, the default (LandingHero's ", " clause break) — `marker` is a plain
 *   delimiter, not the accent: the accent is everything after it, `after` is always `""`, and
 *   `before` keeps only the delimiter's first character (so ", " reads as a trailing comma with
 *   the space dropped, matching the design's "plain clause, *accent clause*" title convention).
 */
export function splitAccent(
	text: string,
	marker: string | undefined,
	markerIsAccent = false,
): AccentSplit {
	if (!marker) return { before: text, accent: null, after: "" };
	const at = text.indexOf(marker);
	if (at === -1) return { before: text, accent: null, after: "" };
	if (markerIsAccent) {
		return { before: text.slice(0, at), accent: marker, after: text.slice(at + marker.length) };
	}
	return { before: text.slice(0, at + 1), accent: text.slice(at + marker.length), after: "" };
}

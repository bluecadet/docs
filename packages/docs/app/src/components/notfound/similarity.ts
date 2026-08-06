// Client-side "did you mean" matching for the 404 page. No dependencies: a normalized
// Levenshtein-distance similarity over route ids (e.g. "guides/remote-cache"), which handles the
// common 404 case well — a renamed/moved slug that's a near-literal edit of the old one.

/** Iterative Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	if (m === 0) return n;
	if (n === 0) return m;

	let prev = Array.from({ length: n + 1 }, (_, i) => i);
	for (let i = 1; i <= m; i++) {
		const cur = [i];
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
		}
		prev = cur;
	}
	return prev[n];
}

/** Similarity in [0, 1] — 1 means identical, 0 means maximally different. */
export function similarity(a: string, b: string): number {
	if (a === b) return 1;
	const maxLen = Math.max(a.length, b.length);
	if (maxLen === 0) return 1;
	return 1 - levenshtein(a, b) / maxLen;
}

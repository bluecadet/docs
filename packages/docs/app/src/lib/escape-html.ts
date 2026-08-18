// Shared by every client script that builds raw HTML strings from untrusted-ish text (search
// results, recent-page titles) before splicing them into `innerHTML`.
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

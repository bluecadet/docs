// Content negotiation for Netlify: a request for a page that sends `Accept: text/markdown` gets the
// page's Markdown copy (written beside it at build time, `/foo/bar/` -> `/foo/bar.md`) instead of
// its HTML. `docs build` copies this file verbatim into `.netlify/v1/edge-functions/` when it runs
// on Netlify (see src/netlify.ts); it runs on Netlify's Deno runtime, not in this package.

export default async (request: Request): Promise<Response | undefined> => {
	// `config.header` below already limits invocation to Markdown requests. Checked again here in
	// case that matcher isn't applied to framework-generated functions — a browser must always fall
	// through to the HTML untouched.
	if (!request.headers.get("accept")?.includes("text/markdown")) return;

	const url = new URL(request.url);
	url.pathname = `${url.pathname.replace(/\/$/, "") || "/index"}.md`;
	const markdown = await fetch(url);
	// No Markdown copy (the landing page, 404s, raw pages): serve whatever the route normally would.
	if (!markdown.ok) return;

	// Built fresh rather than copied: `fetch` may have decompressed the body, so the upstream
	// content-encoding/content-length would no longer describe it.
	const headers = new Headers({ "content-type": "text/markdown; charset=utf-8", vary: "Accept" });
	for (const name of ["cache-control", "etag"]) {
		const value = markdown.headers.get(name);
		if (value) headers.set(name, value);
	}
	return new Response(markdown.body, { status: markdown.status, headers });
};

// Netlify reads this statically at deploy time, so every value must be a literal. Excluding
// `/*.md` is also what keeps the `fetch` above from re-entering this function.
export const config = {
	path: "/*",
	excludedPath: [
		"/_astro/*",
		"/pagefind/*",
		"/*.md",
		"/*.txt",
		"/*.xml",
		"/*.json",
		"/*.js",
		"/*.css",
		"/*.svg",
		"/*.png",
		"/*.jpg",
		"/*.ico",
		"/*.cast",
	],
	header: { accept: "text/markdown" },
};

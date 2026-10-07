import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Shipped as a real file beside `dist/` (and `src/`), copied as-is — see its own header comment. */
const EDGE_FUNCTION = path.join(here, "..", "netlify", "docs-markdown.ts");

const MARKDOWN_HEADERS = {
	for: "/*.md",
	values: { "Content-Type": "text/markdown; charset=utf-8" },
};

interface HeaderRule {
	for: string;
	values: Record<string, string>;
}

/**
 * On Netlify, wires up `Accept: text/markdown` content negotiation through the Frameworks API
 * (https://docs.netlify.com/build/frameworks/frameworks-api/): an edge function that serves each
 * page's `.md` copy, and a header rule so the `.md` files themselves are served as Markdown.
 *
 * `cwd` is the directory the CLI was started in — Netlify runs the build command in the site's base
 * directory, and that's where it looks for `.netlify/v1/`. Gated on `NETLIFY` so a local build
 * never leaves a `.netlify/` directory in the consumer's repo, which is otherwise ours only to read.
 * Returns whether anything was written.
 */
export async function writeNetlifyFiles(cwd: string): Promise<boolean> {
	if (process.env.NETLIFY !== "true") return false;

	const v1 = path.join(cwd, ".netlify", "v1");
	await mkdir(path.join(v1, "edge-functions"), { recursive: true });
	await copyFile(EDGE_FUNCTION, path.join(v1, "edge-functions", "docs-markdown.ts"));

	// Merged rather than overwritten: another build step may have written its own config here.
	const configPath = path.join(v1, "config.json");
	const config: { headers?: HeaderRule[] } = await readFile(configPath, "utf8")
		.then((text) => JSON.parse(text))
		.catch(() => ({}));
	config.headers = [
		...(config.headers ?? []).filter((rule) => rule.for !== MARKDOWN_HEADERS.for),
		MARKDOWN_HEADERS,
	];
	await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
	return true;
}

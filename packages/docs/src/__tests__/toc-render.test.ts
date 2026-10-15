import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { select, selectAll } from "hast-util-select";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
let scratch: string;
let output: string;

beforeAll(() => {
	// Run the real CLI against an isolated copy of the bundled app so the test neither needs a
	// prior build nor overwrites content synced by a developer's docs dev server.
	const cache = path.join(packageRoot, ".cache");
	fs.mkdirSync(cache, { recursive: true });
	scratch = fs.mkdtempSync(path.join(cache, "toc-"));
	const framework = path.join(scratch, "framework");
	fs.mkdirSync(framework);
	fs.writeFileSync(path.join(framework, "package.json"), '{"type":"module"}');
	fs.cpSync(path.join(packageRoot, "app"), path.join(framework, "app"), {
		recursive: true,
		filter: (source) => ![".astro", ".cache", "node_modules"].includes(path.basename(source)),
	});
	execFileSync(process.execPath, [
		fileURLToPath(import.meta.resolve("typescript/bin/tsc")),
		"-p",
		path.join(packageRoot, "tsconfig.json"),
		"--outDir",
		path.join(framework, "dist"),
	]);
	const fixture = path.join(scratch, "fixture");
	fs.mkdirSync(fixture);
	fs.writeFileSync(
		path.join(fixture, "docs.config.yaml"),
		'title: Fixture\ncontent: ["*.md"]\nsidebar: [outline, nested, empty]\n',
	);
	fs.writeFileSync(
		path.join(fixture, "outline.md"),
		"# Outline\n\n## Section\n\n### `camelCase`\n\n#### `lowerCase`\n\n##### Excluded\n\n## Section\n",
	);
	fs.writeFileSync(path.join(fixture, "nested.md"), "# Nested\n\n### Start\n\n#### Child\n");
	fs.writeFileSync(path.join(fixture, "empty.md"), "# Empty\n\n##### Excluded\n");
	output = path.join(scratch, "output");
	execFileSync(process.execPath, [path.join(framework, "dist/cli.js"), "build", "--out", output], {
		cwd: fixture,
		timeout: 60_000,
		stdio: "pipe",
	});
}, 90_000);

afterAll(() => {
	if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
});

function page(name: string) {
	return unified()
		.use(rehypeParse)
		.parse(fs.readFileSync(path.join(output, name, "index.html"), "utf8"));
}

describe("rendered TOC", () => {
	it("renders the same nested, labeled list in desktop and mobile TOCs with exact slug links", () => {
		const tree = page("outline");
		const navs = selectAll("nav[data-toc]", tree);
		expect(navs).toHaveLength(2);
		for (const nav of navs) {
			expect(nav.properties.ariaLabel).toBe("On this page");
			expect(selectAll("a", nav).map((link) => link.properties.href)).toEqual([
				"#section",
				"#camelcase",
				"#lowercase",
				"#section-1",
			]);
			expect(select("ul > li > ul > li > ul > li > a", nav)?.properties.href).toBe("#lowercase");
			expect(selectAll('[aria-current="location"]', nav)).toHaveLength(1);
			expect(selectAll("ul[role=list]", nav)).toHaveLength(3);
		}
		expect(select("h4#lowercase code", tree)).toBeDefined();
	});

	it("reserves the desktop rail for H3/H4-only pages, without inventing empty parent entries", () => {
		const tree = page("nested");
		expect(select(".page-main--toc", tree)).toBeDefined();
		for (const nav of selectAll("nav[data-toc]", tree)) {
			expect(selectAll("a", nav).map((link) => link.properties.href)).toEqual(["#start", "#child"]);
			expect(select("ul > li > ul > li > a", nav)?.properties.href).toBe("#child");
		}
	});

	it("renders neither TOC nor rail when a page has only excluded heading levels", () => {
		const tree = page("empty");
		expect(select(".page-main--toc", tree)).toBeUndefined();
		expect(select("[data-toc]", tree)).toBeUndefined();
		expect(select(".toc-disclosure", tree)).toBeUndefined();
	});
});

describe("article heading CSS", () => {
	const css = fs.readFileSync(path.join(packageRoot, "app/src/styles/article.css"), "utf8");
	const rule = (selector: string) => css.slice(css.indexOf(`${selector} {`)).split("}")[0];

	it("inherits heading code scale and weight, and keeps identifier case and spacing literal", () => {
		const code = rule(".prose :is(h1, h2, h3, h4, h5, h6) code");
		for (const declaration of [
			"font-size: inherit",
			"font-weight: inherit",
			"line-height: inherit",
			"text-transform: none",
			"letter-spacing: normal",
		]) {
			expect(code).toContain(declaration);
		}
	});

	it("preserves compact prose code and ordinary heading typography, adding H4 scroll clearance", () => {
		expect(rule(".prose code")).toContain("0.78125rem var(--font-mono)");
		expect(rule(".prose h3")).toContain("var(--weight-medium) var(--type-h3) var(--font-serif)");
		expect(rule(".prose h4")).toContain("var(--weight-medium) var(--type-h4) var(--font-mono)");
		expect(rule(".prose h4")).toContain("text-transform: uppercase");
		expect(rule(".prose h4")).toContain("letter-spacing: var(--tracking-label)");
		for (const level of [2, 3, 4]) {
			expect(rule(`.prose h${level}`)).toContain(
				"scroll-margin-block-start: var(--heading-scroll-offset)",
			);
		}
	});
});

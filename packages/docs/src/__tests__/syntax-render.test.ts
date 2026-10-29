import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Element, Root } from "hast";
import { select, selectAll } from "hast-util-select";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const source = '// A greeting\nconst message = "Hello";\nconsole.log(message);';
const notationCases = [
	{
		name: "standalone range",
		source:
			'// Before\n// [!code highlight:3]\nconst message = "Hello";\nconsole.log(message);\nconsole.log("Done");\n// After',
		rendered:
			'// Before\nconst message = "Hello";\nconsole.log(message);\nconsole.log("Done");\n// After',
		highlighted: [1, 2, 3],
	},
	{
		name: "inline single line",
		source: 'const message = "Hello"; // [!code highlight]\nconsole.log(message);',
		rendered: 'const message = "Hello";\nconsole.log(message);',
		highlighted: [0],
	},
	{
		name: "combined import and nested call",
		source: `import { mdToHtml } from '@bluecadet/launchpad/content/transforms/md-to-html'; // [!code highlight]

export default defineConfig({
  plugins: [
    content({
      transforms: [
        mdToHtml({ // [!code highlight:3]
          path: '$.item.description'
        })
      ]
    })
  ]
});`,
		rendered: `import { mdToHtml } from '@bluecadet/launchpad/content/transforms/md-to-html';

export default defineConfig({
  plugins: [
    content({
      transforms: [
        mdToHtml({
          path: '$.item.description'
        })
      ]
    })
  ]
});`,
		highlighted: [0, 6, 7, 8],
	},
	{
		name: "inline range",
		source:
			'const message = "Hello"; // [!code highlight:3]\nconsole.log(message);\nconsole.log("Done");\n// After',
		rendered: 'const message = "Hello";\nconsole.log(message);\nconsole.log("Done");\n// After',
		highlighted: [0, 1, 2],
	},
];
let scratch: string;
let output: string;

beforeAll(() => {
	// Build real Markdown and MDX through the CLI, without touching the developer's synced app.
	const cache = path.join(packageRoot, ".cache");
	fs.mkdirSync(cache, { recursive: true });
	scratch = fs.mkdtempSync(path.join(cache, "syntax-"));
	const framework = path.join(scratch, "framework");
	fs.mkdirSync(framework);
	fs.writeFileSync(path.join(framework, "package.json"), '{"type":"module"}');
	fs.cpSync(path.join(packageRoot, "app"), path.join(framework, "app"), {
		recursive: true,
		filter: (file) => ![".astro", ".cache", "node_modules"].includes(path.basename(file)),
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
		'title: Fixture\nlanding: landing.mdx\ncontent: ["*.{md,mdx}"]\nsidebar: [markdown, mdx]\naccent: "#ff00ff"\n',
	);
	const content = `---\ntitle: Syntax\n---\n\nInline \`message\` stays inline.\n\n\`\`\`ts {2-3}\n${source}\n\`\`\`\n\n\`\`\`\nplain text\n\`\`\`\n${notationCases.map((fixture) => `\n\`\`\`ts\n${fixture.source}\n\`\`\`\n`).join("")}`;
	fs.writeFileSync(path.join(fixture, "markdown.md"), content);
	fs.writeFileSync(path.join(fixture, "mdx.mdx"), content);
	// Consumer-style import using the actual Terminal and Line components in the isolated app.
	fs.writeFileSync(
		path.join(fixture, "landing.mdx"),
		`${content}\nimport Terminal from ${JSON.stringify(path.join(framework, "app/src/components/Terminal.astro"))};\nimport Line from ${JSON.stringify(path.join(framework, "app/src/components/Line.astro"))};\n\n<Terminal cwd="~/fixture"><Line prompt>echo Hello</Line></Terminal>\n`,
	);
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

function page(route: string) {
	return unified()
		.use(rehypeParse)
		.parse(fs.readFileSync(path.join(output, route, "index.html"), "utf8"));
}

function text(node: Element | Root): string {
	return node.children
		.map((child) => {
			if (child.type === "text") return child.value;
			return child.type === "element" ? text(child) : "";
		})
		.join("");
}

function styles(tree: Root) {
	return selectAll('link[rel="stylesheet"]', tree)
		.map((link) => fs.readFileSync(path.join(output, String(link.properties.href)), "utf8"))
		.join("\n");
}

describe.each(["markdown", "mdx", ""])('rendered syntax on "%s"', (route) => {
	it("uses Vitesse Dark foreground and token colors, independent of site accents", () => {
		const tree = page(route);
		const pre = select(".code-block pre.astro-code", tree);
		expect(pre?.properties.className).toContain("vitesse-dark");
		expect(pre?.properties.style).toContain("color:#dbd7caee");
		const tokens = selectAll(".line > span", pre);
		// Assert actual token output, not just a theme name on the PRE.
		for (const [value, color] of [
			["// A greeting", "#758575DD"],
			["const ", "#CB7676"],
			["Hello", "#C98A7D"],
			["log", "#80A665"],
		]) {
			expect(tokens.find((token) => text(token) === value)?.properties.style).toBe(
				`color:${color}`,
			);
		}
		expect(fs.readFileSync(path.join(output, route, "index.html"), "utf8")).not.toContain(
			"--astro-code-",
		);
	});

	it("ships a code-surface override that beats Shiki's inline background, including on landing pages", () => {
		const css = styles(page(route));
		// The selector intentionally does not require .prose: landing MDX has a different shell.
		expect(css).toMatch(
			/\.code-block pre\.astro-code\s*\{\s*background-color:\s*var\(--surface-code\)\s*!important;?\s*\}/,
		);
		expect(css).toContain("--surface-code:");
		expect(css).not.toContain("--astro-code-");
	});

	it("applies fenced-code chrome, typography, and highlight styles in either page shell", () => {
		const tree = page(route);
		const css = styles(tree);
		const normalizeSelector = (selector: string) => selector.trim().replace(/\s*>\s*/g, ">");
		const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
		for (const { selector, declarations } of [
			{
				selector: ".code-block",
				declarations: ["border:1px solid var(--hairline-10)", "overflow:hidden"],
			},
			{
				selector: ".code-block .code-block-header",
				declarations: ["display:flex", "border-block-end:1px solid var(--hairline-08)"],
			},
			{
				selector: ".code-block .code-copy",
				declarations: ["cursor:pointer", "margin-inline-start:auto"],
			},
			{
				selector: ".code-block pre",
				declarations: ["margin:0", "var(--font-mono)", "var(--leading-relaxed)"],
			},
			{
				selector: ".code-block pre > code",
				declarations: [
					"font:inherit",
					"color:inherit",
					"padding:0",
					"border-radius:0",
					"display:block",
					"inline-size:max-content",
				],
			},
			{
				selector: ".code-block pre .line",
				declarations: ["min-inline-size:100%", "padding-inline:1.125rem"],
			},
			{
				selector: ".code-block pre .line.highlighted",
				declarations: ["background:var(--white-07)"],
			},
		]) {
			// Check both shipped declarations and selector applicability to the actual page DOM.
			// A .prose-only rule would exist in the CSS but fail to style landing MDX.
			const rule = rules.find(
				(match) => normalizeSelector(match[1] ?? "") === normalizeSelector(selector),
			);
			expect(rule, selector).toBeDefined();
			expect(selectAll(selector, tree).length, selector).toBeGreaterThan(0);
			for (const declaration of declarations) expect(rule?.[2], selector).toContain(declaration);
			if (route === "") {
				expect(selectAll(`.landing-content ${selector}`, tree)).toEqual(selectAll(selector, tree));
				expect(selectAll(`.prose ${selector}`, tree)).toHaveLength(0);
			}
		}
	});

	it("preserves wrappers, copyable text, line order, metadata highlighting, and inline code", () => {
		const tree = page(route);
		const blocks = selectAll(".code-block", tree);
		expect(blocks).toHaveLength(2 + notationCases.length);
		const block = blocks[0];
		expect(text(select(".code-block-header .code-block-lang", block)!)).toBe("ts");
		expect(select("button.code-copy", block)?.properties.type).toBe("button");
		expect(text(select("pre", block)!)).toBe(source);
		expect(selectAll("pre .line", block)).toHaveLength(3);
		expect(selectAll("pre .line.highlighted", block).map(text)).toEqual(
			source.split("\n").slice(1),
		);
		expect(text(select("pre", blocks[1])!)).toBe("plain text");
		const inline = select("p > code", tree);
		expect(inline && text(inline)).toBe("message");
		expect(inline?.properties.style).toBeUndefined();
	});
	it.each(notationCases)("supports $name highlight notation without copying markers", (fixture) => {
		const block = selectAll(".code-block", page(route))[2 + notationCases.indexOf(fixture)];
		const pre = select("pre", block)!;
		const lines = selectAll(".line", pre);
		expect(lines.map(text).map((line) => line.trimEnd())).toEqual(fixture.rendered.split("\n"));
		expect(selectAll(".line.highlighted", pre)).toEqual(
			fixture.highlighted.map((index) => lines[index]),
		);
		// The copy button reads the rendered PRE's textContent.
		expect(text(pre)).not.toContain("[!code");
		expect(select("button.code-copy", block)).toBeDefined();
	});
});

it("does not turn terminal transcripts or 404 samples into syntax blocks", () => {
	const terminal = select(".terminal", page(""));
	expect(terminal).toBeDefined();
	expect(text(terminal!)).toContain("echo Hello");
	expect(select(".terminal-line", terminal)).toBeDefined();
	expect(select(".astro-code, .code-block, .code-copy", terminal)).toBeUndefined();
	const notFound = unified()
		.use(rehypeParse)
		.parse(fs.readFileSync(path.join(output, "404.html"), "utf8"));
	expect(select(".astro-code, .code-block, .code-copy", notFound)).toBeUndefined();
});

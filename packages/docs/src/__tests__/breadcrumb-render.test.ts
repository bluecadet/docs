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
	// Isolate the bundled app, including synced content, from other builds and dev servers.
	const cache = path.join(packageRoot, ".cache");
	fs.mkdirSync(cache, { recursive: true });
	scratch = fs.mkdtempSync(path.join(cache, "breadcrumb-"));
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
		`title: Fixture
site: https://example.com
content:
  - base: source
    files: "**/*.md"
sidebar:
  - top
  - label: Guides
    items: [guides/start]
  - label: Reference
    items:
      - label: CLI
        link: reference/cli
        items:
          - reference/cli/commands
          - label: Advanced
            items: [reference/cli/advanced/options]
  - link: docs
    items: [docs/topic]
`,
	);
	for (const [id, title] of Object.entries({
		top: "Top level",
		"guides/start": "Getting started",
		"reference/cli/index": "CLI",
		"reference/cli/commands": "Commands",
		"reference/cli/advanced/options": "Options",
		"docs/index": "Docs",
		"docs/topic": "Topic",
		unlisted: "Unlisted page",
	})) {
		const file = path.join(fixture, "source", `${id}.md`);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, `# ${title}\n`);
	}
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

function breadcrumb(id: string) {
	const tree = unified()
		.use(rehypeParse)
		.parse(fs.readFileSync(path.join(output, id, "index.html"), "utf8"));
	const nav = select('nav[aria-label="Breadcrumb"]', tree);
	const pill = select("button.breadcrumb-pill[data-nav-sheet-trigger]", tree);
	expect(nav).toBeDefined();
	expect(pill).toBeDefined();
	if (!nav || !pill) throw new Error("Missing breadcrumb navigation");
	const segments = selectAll(".breadcrumb__segment, .breadcrumb__current", nav).map((node) =>
		node.children.flatMap((child) => (child.type === "text" ? [child.value] : [])).join(""),
	);
	const parent = select(".breadcrumb-pill__section", pill);
	return {
		segments,
		links: selectAll("a", nav).map((link) => link.properties.href),
		separators: selectAll(".breadcrumb__sep", nav),
		mobileParent: parent?.children
			.flatMap((child) => (child.type === "text" ? [child.value] : []))
			.join(""),
		mobileCurrent: select(".breadcrumb-pill__current", pill)
			?.children.flatMap((child) => (child.type === "text" ? [child.value] : []))
			.join(""),
		firstChild: nav.children.find((child) => child.type === "element"),
	};
}

describe("rendered breadcrumbs", () => {
	it.each([
		["top", "Top level"],
		["unlisted", "Unlisted page"],
	])("renders %s without a synthetic root, empty nav, or standalone separator", (id, title) => {
		const trail = breadcrumb(id);
		expect(trail.segments).toEqual([title]);
		expect(trail.links).toEqual([]);
		expect(trail.separators).toHaveLength(0);
		expect(trail.mobileParent).toBeUndefined();
		expect(trail.mobileCurrent).toBe(title);
	});

	it("retains an inert section and starts with that section rather than a separator", () => {
		const trail = breadcrumb("guides/start");
		expect(trail.segments).toEqual(["Guides", "Getting started"]);
		expect(trail.links).toEqual([]);
		expect(trail.separators).toHaveLength(1);
		expect(trail.firstChild?.properties.className).toContain("breadcrumb__segment");
		expect(trail.mobileParent).toBe("guides /");
	});

	it("preserves nested section/page hierarchy and ancestor links", () => {
		const trail = breadcrumb("reference/cli/commands");
		expect(trail.segments).toEqual(["Reference", "cli", "Commands"]);
		expect(trail.links).toEqual(["/reference/cli/"]);
		expect(trail.separators).toHaveLength(2);
		expect(trail.mobileParent).toBe("cli /");
	});

	it("preserves nested groups' first-descendant links and the nearest mobile parent", () => {
		const trail = breadcrumb("reference/cli/advanced/options");
		expect(trail.segments).toEqual(["Reference", "cli", "advanced", "Options"]);
		expect(trail.links).toEqual(["/reference/cli/", "/reference/cli/advanced/options/"]);
		expect(trail.separators).toHaveLength(3);
		expect(trail.mobileParent).toBe("advanced /");
	});

	it("keeps a legitimate docs-named route in both desktop and mobile trails", () => {
		const trail = breadcrumb("docs/topic");
		expect(trail.segments).toEqual(["docs", "Topic"]);
		expect(trail.links).toEqual(["/docs/"]);
		expect(trail.separators).toHaveLength(1);
		expect(trail.mobileParent).toBe("docs /");
	});
});

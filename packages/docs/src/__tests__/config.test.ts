import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig, validateConfig } from "../config.js";

const CONFIG_PATH = "/repo/docs.config.yaml";

/** Every config below needs a `content` — it's required, so spelling it out each time is noise. */
const CONTENT = ["docs/**/*.md"];
const ENTRY = { base: ".", files: ["docs/**/*.md"], route: "", assets: [] };

/**
 * `content` is required, so tests aimed at any other key get a default one injected rather than
 * repeating it. Tests about `content` itself call `validateConfig` directly.
 */
function validate(
	parsed: Record<string, unknown>,
	configPath = CONFIG_PATH,
): ReturnType<typeof validateConfig> {
	return validateConfig({ content: CONTENT, ...parsed }, configPath);
}

describe("validateConfig", () => {
	it("accepts a fully valid config with no warnings", () => {
		const { config, warnings } = validate(
			{
				title: "My Project",
				repoUrl: "https://github.com/org/my-project",
				content: ["Packages/*/README.md"],
				landing: "docs/index.mdx",
				base: "/my-project/",
				site: "https://org.github.io",
			},
			CONFIG_PATH,
		);
		expect(config).toEqual({
			title: "My Project",
			repoUrl: "https://github.com/org/my-project",
			content: [{ base: ".", files: ["Packages/*/README.md"], route: "", assets: [] }],
			landing: "docs/index.mdx",
			base: "/my-project/",
			site: "https://org.github.io",
		});
		expect(warnings).toEqual([]);
	});

	it("warns (not errors) on an unknown top-level key", () => {
		const { config, warnings } = validate({ content: CONTENT, typo: "oops" }, CONFIG_PATH);
		expect(config).toEqual({ content: [ENTRY] });
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('"typo"');
	});

	it.each([
		"title",
		"repoUrl",
		"accent",
		"accent2",
		"base",
		"site",
		"version",
		"sidebarMeta",
		"landing",
		"favicon",
	] as const)('throws a clear error when "%s" is not a string', (key) => {
		expect(() => validate({ content: CONTENT, [key]: 5 }, CONFIG_PATH)).toThrowError(
			new RegExp(`"${key}" must be a string \\(got number\\)`),
		);
	});

	describe("content", () => {
		it("expands a bare glob string into a full entry", () => {
			const { config } = validateConfig({ content: "Packages/*/README.md" }, CONFIG_PATH);
			expect(config.content).toEqual([
				{ base: ".", files: ["Packages/*/README.md"], route: "", assets: [] },
			]);
		});

		it("expands a bare string that isn't wrapped in an array", () => {
			const { config } = validateConfig({ content: "docs/**/*.md" }, CONFIG_PATH);
			expect(config.content).toEqual([ENTRY]);
		});

		it("fills in defaults for an object entry that only sets files", () => {
			const { config } = validateConfig({ content: [{ files: "a/*.md" }] }, CONFIG_PATH);
			expect(config.content).toEqual([{ base: ".", files: ["a/*.md"], route: "", assets: [] }]);
		});

		it("keeps base, route and assets from an object entry", () => {
			const { config } = validateConfig(
				{
					content: [
						{ base: "../packages", files: ["*/README.md"], route: "packages", assets: "**/*.png" },
					],
				},
				CONFIG_PATH,
			);
			expect(config.content).toEqual([
				{
					base: "../packages",
					files: ["*/README.md"],
					route: "packages",
					assets: ["**/*.png"],
				},
			]);
		});

		it("accepts a mix of string and object entries", () => {
			const { config } = validateConfig(
				{ content: ["docs/**/*.md", { base: "pkg", files: "*/README.md", route: "packages" }] },
				CONFIG_PATH,
			);
			expect(config.content).toEqual([
				{ base: ".", files: ["docs/**/*.md"], route: "", assets: [] },
				{ base: "pkg", files: ["*/README.md"], route: "packages", assets: [] },
			]);
		});

		it("throws when content is absent", () => {
			expect(() => validateConfig({ title: "x" }, CONFIG_PATH)).toThrowError(
				/"content" is required/,
			);
		});

		it("throws when content is an empty array", () => {
			expect(() => validateConfig({ content: [] }, CONFIG_PATH)).toThrowError(
				/"content" must not be empty/,
			);
		});

		it("throws when an entry has neither files nor assets", () => {
			expect(() => validateConfig({ content: [{ base: "docs" }] }, CONFIG_PATH)).toThrowError(
				/"content\[0\]" must have "files", "assets", or both \(got neither\)/,
			);
		});

		it("accepts an assets-only entry (no files)", () => {
			const { config } = validateConfig(
				{ content: [{ base: "..", assets: ["install.sh", "install.ps1"] }] },
				CONFIG_PATH,
			);
			expect(config.content).toEqual([
				{ base: "..", files: [], route: "", assets: ["install.sh", "install.ps1"] },
			]);
		});

		it("accepts an entry with both files and assets", () => {
			const { config } = validateConfig(
				{ content: [{ files: "docs/**/*.md", assets: "docs/img/**/*.png" }] },
				CONFIG_PATH,
			);
			expect(config.content).toEqual([
				{ base: ".", files: ["docs/**/*.md"], route: "", assets: ["docs/img/**/*.png"] },
			]);
		});

		it("throws naming the index when an entry is neither a string nor an object", () => {
			expect(() => validateConfig({ content: ["a/*.md", 5] }, CONFIG_PATH)).toThrowError(
				/"content\[1\]" must be a glob string or an object with a "files" and\/or "assets" key \(got number\)/,
			);
		});

		it("throws when content is null", () => {
			expect(() => validateConfig({ content: null }, CONFIG_PATH)).toThrowError(/got null/);
		});

		it.each(["/abs", "route/", "/route", "a/../b", "a//b", "..", "."])(
			'throws on the invalid route "%s"',
			(route) => {
				expect(() =>
					validateConfig({ content: [{ files: "a/*.md", route }] }, CONFIG_PATH),
				).toThrowError(/"content\[0\]\.route"/);
			},
		);

		it("allows a base that climbs out of the config directory", () => {
			const { config } = validateConfig(
				{ content: [{ base: "../../shared/docs", files: "**/*.md" }] },
				CONFIG_PATH,
			);
			expect(config.content?.[0]?.base).toBe("../../shared/docs");
		});

		it("throws when base is absolute", () => {
			expect(() =>
				validateConfig({ content: [{ base: "/etc", files: "*.md" }] }, CONFIG_PATH),
			).toThrowError(/"content\[0\]\.base" must be relative/);
		});

		it("warns on an unknown key inside a content entry", () => {
			const { warnings } = validateConfig(
				{ content: [{ files: "a/*.md", roots: "docs" }] },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"content[0].roots"');
		});
	});

	describe("header/footer", () => {
		it("accepts header links and footer groups", () => {
			const { config, warnings } = validate(
				{
					header: { links: [{ label: "Changelog", href: "/changelog/" }] },
					footer: {
						groups: [
							{
								title: "Project",
								links: [{ label: "github", href: "https://github.com/acme/proj" }],
							},
						],
					},
				},
				CONFIG_PATH,
			);
			expect(config.header).toEqual({ links: [{ label: "Changelog", href: "/changelog/" }] });
			expect(config.footer).toEqual({
				groups: [
					{
						title: "Project",
						links: [{ label: "github", href: "https://github.com/acme/proj" }],
					},
				],
			});
			expect(warnings).toEqual([]);
		});

		it("accepts a footer link with a note", () => {
			const { config, warnings } = validate(
				{
					footer: {
						groups: [
							{
								title: "Related",
								links: [
									{
										label: "caliper docs",
										href: "https://docs.caliper.dev",
										note: "docs.caliper.dev",
									},
								],
							},
						],
					},
				},
				CONFIG_PATH,
			);
			expect(config.footer).toEqual({
				groups: [
					{
						title: "Related",
						links: [
							{
								label: "caliper docs",
								href: "https://docs.caliper.dev",
								note: "docs.caliper.dev",
							},
						],
					},
				],
			});
			expect(warnings).toEqual([]);
		});

		it("accepts a footer meta string", () => {
			const { config, warnings } = validate(
				{ footer: { meta: "MIT · no telemetry" } },
				CONFIG_PATH,
			);
			expect(config.footer).toEqual({ meta: "MIT · no telemetry" });
			expect(warnings).toEqual([]);
		});

		it("throws when footer.meta is not a string", () => {
			expect(() => validate({ footer: { meta: 5 } }, CONFIG_PATH)).toThrowError(
				/"footer\.meta" must be a string \(got number\)/,
			);
		});

		it("warns on meta inside header (footer-only key)", () => {
			const { warnings } = validate({ header: { meta: "nope" } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"header.meta"');
		});

		it("warns on links inside footer (footer uses groups, not links)", () => {
			const { warnings } = validate(
				{ footer: { links: [{ label: "x", href: "/x/" }] } },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"footer.links"');
		});

		it("accepts a header with no links", () => {
			const { config } = validate({ header: {} }, CONFIG_PATH);
			expect(config.header).toEqual({});
		});

		it.each(["header", "footer"] as const)('throws when "%s" is not an object', (key) => {
			expect(() => validate({ [key]: "nope" }, CONFIG_PATH)).toThrowError(
				new RegExp(`"${key}" must be an object \\(got string\\)`),
			);
		});

		it("throws when header.links is not an array", () => {
			expect(() => validate({ header: { links: "nope" } }, CONFIG_PATH)).toThrowError(
				/"header\.links" must be an array \(got string\)/,
			);
		});

		it("throws when a link is missing a label", () => {
			expect(() => validate({ header: { links: [{ href: "/x/" }] } }, CONFIG_PATH)).toThrowError(
				/"header\.links\[0\]\.label" must be a string \(got undefined\)/,
			);
		});

		it("throws when a link href is not a string", () => {
			expect(() =>
				validate({ header: { links: [{ label: "x", href: 5 }] } }, CONFIG_PATH),
			).toThrowError(/"header\.links\[0\]\.href" must be a string \(got number\)/);
		});

		it("warns on an unknown key inside header", () => {
			const { warnings } = validate({ header: { typo: true } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"header.typo"');
		});

		it("warns on an unknown key inside a link", () => {
			const { warnings } = validate(
				{ header: { links: [{ label: "x", href: "/x/", extra: 1 }] } },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"header.links[0].extra"');
		});
	});

	describe("footer.groups", () => {
		it("throws when footer.groups is not an array", () => {
			expect(() => validate({ footer: { groups: "nope" } }, CONFIG_PATH)).toThrowError(
				/"footer\.groups" must be an array \(got string\)/,
			);
		});

		it("throws when a footer group is not an object", () => {
			expect(() => validate({ footer: { groups: ["nope"] } }, CONFIG_PATH)).toThrowError(
				/"footer\.groups\[0\]" must be an object \(got string\)/,
			);
		});

		it("throws when a footer group is missing a title", () => {
			expect(() =>
				validate({ footer: { groups: [{ links: [{ label: "x", href: "/x/" }] }] } }, CONFIG_PATH),
			).toThrowError(/"footer\.groups\[0\]\.title" must be a string \(got undefined\)/);
		});

		it("throws when a footer group's title is an empty string", () => {
			expect(() =>
				validate(
					{ footer: { groups: [{ title: "", links: [{ label: "x", href: "/x/" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.title" must not be empty/);
		});

		it("throws when a footer group is missing links", () => {
			expect(() =>
				validate({ footer: { groups: [{ title: "Project" }] } }, CONFIG_PATH),
			).toThrowError(/"footer\.groups\[0\]\.links" must be an array \(got undefined\)/);
		});

		it("throws when a footer group's links array is empty", () => {
			expect(() =>
				validate({ footer: { groups: [{ title: "Project", links: [] }] } }, CONFIG_PATH),
			).toThrowError(/"footer\.groups\[0\]\.links" must not be empty/);
		});

		it("throws when a footer link is missing a label", () => {
			expect(() =>
				validate(
					{ footer: { groups: [{ title: "Project", links: [{ href: "/x/" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.links\[0\]\.label" must be a string \(got undefined\)/);
		});

		it("throws when a footer link's label is an empty string", () => {
			expect(() =>
				validate(
					{ footer: { groups: [{ title: "Project", links: [{ label: "", href: "/x/" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.links\[0\]\.label" must not be empty/);
		});

		it("throws when a footer link's href is an empty string", () => {
			expect(() =>
				validate(
					{ footer: { groups: [{ title: "Project", links: [{ label: "x", href: "" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.links\[0\]\.href" must not be empty/);
		});

		it("throws when a footer link's note is not a string", () => {
			expect(() =>
				validate(
					{
						footer: {
							groups: [{ title: "Project", links: [{ label: "x", href: "/x/", note: 5 }] }],
						},
					},
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.links\[0\]\.note" must be a string \(got number\)/);
		});

		it("warns on an unknown key inside footer", () => {
			const { warnings } = validate({ footer: { typo: true } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"footer.typo"');
		});

		it("warns on an unknown key inside a footer group", () => {
			const { warnings } = validate(
				{
					footer: { groups: [{ title: "Project", links: [{ label: "x", href: "/x/" }], typo: 1 }] },
				},
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"footer.groups[0].typo"');
		});

		it("warns on an unknown key inside a footer link", () => {
			const { warnings } = validate(
				{
					footer: {
						groups: [{ title: "Project", links: [{ label: "x", href: "/x/", extra: 1 }] }],
					},
				},
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"footer.groups[0].links[0].extra"');
		});
	});

	describe("sidebar", () => {
		it("accepts a flat sidebar of page ids", () => {
			const { config, warnings } = validate(
				{
					sidebar: [
						{
							label: "Getting started",
							items: ["getting-started/installation", "getting-started/quickstart"],
						},
					],
				},
				CONFIG_PATH,
			);
			expect(config.sidebar).toEqual([
				{
					label: "Getting started",
					items: ["getting-started/installation", "getting-started/quickstart"],
				},
			]);
			expect(warnings).toEqual([]);
		});

		it("accepts nested sidebar groups", () => {
			const { config } = validate(
				{
					sidebar: [
						{
							label: "Guides",
							items: ["guides/configuration", { label: "Advanced", items: ["guides/ci"] }],
						},
					],
				},
				CONFIG_PATH,
			);
			expect(config.sidebar).toEqual([
				{
					label: "Guides",
					items: ["guides/configuration", { label: "Advanced", items: ["guides/ci"] }],
				},
			]);
		});

		it("throws when sidebar is not an array", () => {
			expect(() => validate({ sidebar: "nope" }, CONFIG_PATH)).toThrowError(
				/"sidebar" must be an array \(got string\)/,
			);
		});

		it("throws when a sidebar item is neither a string nor an object", () => {
			expect(() => validate({ sidebar: [5] }, CONFIG_PATH)).toThrowError(
				/"sidebar\[0\]" must be a string or an object \(got number\)/,
			);
		});

		it('throws when a sidebar item has "items" but no "label" or "link"', () => {
			expect(() => validate({ sidebar: [{ items: [] }] }, CONFIG_PATH)).toThrowError(
				/"sidebar\[0\]" has "items" but no "label" or "link" to use as its own heading/,
			);
		});

		it("throws when a sidebar item has neither link nor items", () => {
			expect(() => validate({ sidebar: [{ label: "x" }] }, CONFIG_PATH)).toThrowError(
				/"sidebar\[0\]" must have a "link", "items", or both \(got neither\)/,
			);
		});

		it("throws when a sidebar group's items is not an array", () => {
			expect(() =>
				validate({ sidebar: [{ label: "x", items: "nope" }] }, CONFIG_PATH),
			).toThrowError(/"sidebar\[0\]\.items" must be an array \(got string\)/);
		});

		it("throws naming the nested path when a deeply nested item is invalid", () => {
			expect(() =>
				validate(
					{
						sidebar: [
							{
								label: "Guides",
								items: [{ label: "Advanced", items: [{ items: [] }] }],
							},
						],
					},
					CONFIG_PATH,
				),
			).toThrowError(
				/"sidebar\[0\]\.items\[0\]\.items\[0\]" has "items" but no "label" or "link" to use as its own heading/,
			);
		});

		it("warns on an unknown key inside a sidebar group", () => {
			const { warnings } = validate({ sidebar: [{ label: "x", items: [], typo: 1 }] }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"sidebar[0].typo"');
		});

		it("accepts a sidebar group with a link", () => {
			const { config, warnings } = validate(
				{
					sidebar: [
						{
							label: "Reference",
							link: "reference/overview",
							items: ["reference/cli"],
						},
					],
				},
				CONFIG_PATH,
			);
			expect(config.sidebar).toEqual([
				{
					label: "Reference",
					link: "reference/overview",
					items: ["reference/cli"],
				},
			]);
			expect(warnings).toEqual([]);
		});

		it("accepts a link on a nested sidebar group", () => {
			const { config } = validate(
				{
					sidebar: [
						{
							label: "Guides",
							items: [{ label: "Advanced", link: "guides/advanced", items: ["guides/ci"] }],
						},
					],
				},
				CONFIG_PATH,
			);
			expect(config.sidebar).toEqual([
				{
					label: "Guides",
					items: [{ label: "Advanced", link: "guides/advanced", items: ["guides/ci"] }],
				},
			]);
		});

		it("throws when a sidebar group's link is not a string", () => {
			expect(() =>
				validate({ sidebar: [{ label: "x", items: [], link: 5 }] }, CONFIG_PATH),
			).toThrowError(/"sidebar\[0\]\.link" must be a string \(got number\)/);
		});

		it("accepts a bare content-id string at the top level", () => {
			const { config, warnings } = validate(
				{ sidebar: ["getting-started/installation"] },
				CONFIG_PATH,
			);
			expect(config.sidebar).toEqual(["getting-started/installation"]);
			expect(warnings).toEqual([]);
		});

		it("accepts a link-only leaf item (no label, no items)", () => {
			const { config, warnings } = validate(
				{ sidebar: [{ link: "getting-started/installation" }] },
				CONFIG_PATH,
			);
			expect(config.sidebar).toEqual([{ link: "getting-started/installation" }]);
			expect(warnings).toEqual([]);
		});

		it("accepts a labeled leaf item (label + link, no items)", () => {
			const { config, warnings } = validate(
				{ sidebar: [{ label: "Install", link: "getting-started/installation" }] },
				CONFIG_PATH,
			);
			expect(config.sidebar).toEqual([{ label: "Install", link: "getting-started/installation" }]);
			expect(warnings).toEqual([]);
		});

		it("warns on an unknown key inside a leaf item", () => {
			const { warnings } = validate(
				{ sidebar: [{ link: "getting-started/installation", typo: 1 }] },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"sidebar[0].typo"');
		});
	});

	describe("version/sidebarMeta", () => {
		it("accepts a version and sidebarMeta string", () => {
			const { config, warnings } = validate(
				{ version: "v2.4.1", sidebarMeta: "MIT licensed\nno telemetry" },
				CONFIG_PATH,
			);
			expect(config.version).toBe("v2.4.1");
			expect(config.sidebarMeta).toBe("MIT licensed\nno telemetry");
			expect(warnings).toEqual([]);
		});
	});

	describe("accent/accent2", () => {
		it("accepts valid 6-digit hex colors", () => {
			const { config, warnings } = validate({ accent: "#9cc3a9", accent2: "#E0A75E" }, CONFIG_PATH);
			expect(config.accent).toBe("#9cc3a9");
			expect(config.accent2).toBe("#E0A75E");
			expect(warnings).toEqual([]);
		});

		it.each(["accent", "accent2"] as const)(
			'throws a clear error when "%s" is not a hex color',
			(key) => {
				expect(() => validate({ [key]: "sage" }, CONFIG_PATH)).toThrowError(
					new RegExp(`"${key}" must be a 6-digit hex color`),
				);
			},
		);
	});

	describe("toc", () => {
		it("accepts a toc note and editLink", () => {
			const { config, warnings } = validate(
				{
					toc: {
						note: "updated for 2.4",
						editLink: "https://github.com/acme/proj/edit/main/{path}",
					},
				},
				CONFIG_PATH,
			);
			expect(config.toc).toEqual({
				note: "updated for 2.4",
				editLink: "https://github.com/acme/proj/edit/main/{path}",
			});
			expect(warnings).toEqual([]);
		});

		it("accepts a toc with no keys set", () => {
			const { config } = validate({ toc: {} }, CONFIG_PATH);
			expect(config.toc).toEqual({});
		});

		it("throws when toc is not an object", () => {
			expect(() => validate({ toc: "nope" }, CONFIG_PATH)).toThrowError(
				/"toc" must be an object \(got string\)/,
			);
		});

		it("throws when toc.note is not a string", () => {
			expect(() => validate({ toc: { note: 5 } }, CONFIG_PATH)).toThrowError(
				/"toc\.note" must be a string \(got number\)/,
			);
		});

		it("throws when toc.editLink is not a string", () => {
			expect(() => validate({ toc: { editLink: 5 } }, CONFIG_PATH)).toThrowError(
				/"toc\.editLink" must be a string \(got number\)/,
			);
		});

		it("warns on an unknown key inside toc", () => {
			const { warnings } = validate({ toc: { typo: true } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"toc.typo"');
		});
	});

	it("warns once per unknown top-level key even alongside header/footer/sidebar", () => {
		const { warnings } = validate(
			{ header: { links: [] }, footer: { meta: "MIT" }, sidebar: [], typo: 1 },
			CONFIG_PATH,
		);
		expect(warnings).toEqual([`${CONFIG_PATH}: unknown key "typo" is ignored.`]);
	});
});

describe("resolveConfig (YAML file loading)", () => {
	let tmpRoot: string;

	afterEach(() => {
		if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
	});

	function makeRoot(): string {
		tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-config-test-"));
		return tmpRoot;
	}

	/** CLI overrides pointing at `dir`'s `docs.config.yaml`, exactly as cli.ts builds them. */
	function overrides(dir: string): { configPath: string; out: string } {
		return { configPath: path.join(dir, "docs.config.yaml"), out: path.join(dir, "dist") };
	}

	function writeConfig(dir: string, lines: string[]): void {
		fs.writeFileSync(path.join(dir, "docs.config.yaml"), `${lines.join("\n")}\n`);
	}

	it("parses a full docs.config.yaml, including header/footer/sidebar", () => {
		const root = makeRoot();
		fs.writeFileSync(
			path.join(root, "docs.config.yaml"),
			[
				"title: My Project",
				"repoUrl: https://github.com/acme/proj",
				"accent: '#8fb4d6'",
				"accent2: '#d98a6e'",
				"site: https://acme.github.io",
				"base: /proj/",
				"content:",
				"  - packages/*/README.md",
				"header:",
				"  links:",
				"    - label: Changelog",
				"      href: /changelog/",
				"footer:",
				"  groups:",
				"    - title: Project",
				"      links:",
				"        - label: github",
				"          href: https://github.com/acme/proj",
				"sidebar:",
				"  - label: Getting started",
				"    items:",
				"      - getting-started/installation",
				"      - getting-started/quickstart",
				"  - label: Guides",
				"    items:",
				"      - guides/configuration",
				"      - label: Advanced",
				"        items:",
				"          - guides/ci",
				"version: v2.4.1",
				"sidebarMeta: |",
				"  MIT licensed",
				"  no telemetry",
				"toc:",
				"  note: updated for 2.4",
				"  editLink: https://github.com/acme/proj/edit/main/{path}",
				"",
			].join("\n"),
		);

		const cfg = resolveConfig(overrides(root));

		expect(cfg.configPath).toBe(path.join(root, "docs.config.yaml"));
		expect(cfg.configDir).toBe(root);
		expect(cfg.title).toBe("My Project");
		expect(cfg.repoUrl).toBe("https://github.com/acme/proj");
		expect(cfg.accent).toBe("#8fb4d6");
		expect(cfg.accent2).toBe("#d98a6e");
		expect(cfg.site).toBe("https://acme.github.io");
		expect(cfg.base).toBe("/proj/");
		expect(cfg.content).toEqual([
			{ base: ".", files: ["packages/*/README.md"], route: "", assets: [] },
		]);
		expect(cfg.header).toEqual({ links: [{ label: "Changelog", href: "/changelog/" }] });
		expect(cfg.footer).toEqual({
			groups: [
				{
					title: "Project",
					links: [{ label: "github", href: "https://github.com/acme/proj" }],
				},
			],
		});
		expect(cfg.version).toBe("v2.4.1");
		expect(cfg.sidebarMeta).toBe("MIT licensed\nno telemetry\n");
		expect(cfg.toc).toEqual({
			note: "updated for 2.4",
			editLink: "https://github.com/acme/proj/edit/main/{path}",
		});
		expect(cfg.sidebar).toEqual([
			{
				label: "Getting started",
				items: ["getting-started/installation", "getting-started/quickstart"],
			},
			{
				label: "Guides",
				items: ["guides/configuration", { label: "Advanced", items: ["guides/ci"] }],
			},
		]);
	});

	it("errors naming the path and the --config flag when the config file is missing", () => {
		const root = makeRoot();
		let thrown: Error | undefined;
		try {
			resolveConfig(overrides(root));
		} catch (err) {
			thrown = err as Error;
		}
		expect(thrown?.message).toContain(path.join(root, "docs.config.yaml"));
		expect(thrown?.message).toContain("--config");
	});

	it("throws naming the file and the parser's message on invalid YAML", () => {
		const root = makeRoot();
		fs.writeFileSync(path.join(root, "docs.config.yaml"), "title: [unterminated");
		expect(() => resolveConfig(overrides(root))).toThrowError(
			/Failed to parse .*docs\.config\.yaml/,
		);
	});

	it("throws when title is missing", () => {
		const root = makeRoot();
		writeConfig(root, ["content:", "  - docs/**/*.md"]);
		expect(() => resolveConfig(overrides(root))).toThrowError(/"title" is required/);
	});

	it("accepts --title in place of a configured title", () => {
		const root = makeRoot();
		writeConfig(root, ["content:", "  - docs/**/*.md"]);
		expect(resolveConfig({ ...overrides(root), title: "From The Flag" }).title).toBe(
			"From The Flag",
		);
	});

	it("resolves landing to an absolute path", () => {
		const root = makeRoot();
		fs.mkdirSync(path.join(root, "docs"), { recursive: true });
		fs.writeFileSync(path.join(root, "docs", "index.mdx"), "# Home\n");
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md", "landing: docs/index.mdx"]);
		expect(resolveConfig(overrides(root)).landing).toBe(path.join(root, "docs", "index.mdx"));
	});

	it("leaves landing undefined when the key is absent", () => {
		const root = makeRoot();
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md"]);
		expect(resolveConfig(overrides(root)).landing).toBeUndefined();
	});

	it("throws naming the missing file when landing does not exist", () => {
		const root = makeRoot();
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md", "landing: docs/nope.md"]);
		expect(() => resolveConfig(overrides(root))).toThrowError(/does not exist/);
	});

	it("throws when landing is not a .md/.mdx file", () => {
		const root = makeRoot();
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md", "landing: docs/home.astro"]);
		expect(() => resolveConfig(overrides(root))).toThrowError(/must point at a \.md or \.mdx file/);
	});

	it("resolves favicon to an absolute path", () => {
		const root = makeRoot();
		fs.mkdirSync(path.join(root, "docs"), { recursive: true });
		fs.writeFileSync(path.join(root, "docs", "icon.svg"), "<svg/>");
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md", "favicon: docs/icon.svg"]);
		expect(resolveConfig(overrides(root)).favicon).toBe(path.join(root, "docs", "icon.svg"));
	});

	it("leaves favicon undefined when the key is absent", () => {
		const root = makeRoot();
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md"]);
		expect(resolveConfig(overrides(root)).favicon).toBeUndefined();
	});

	it("throws naming the missing file when favicon does not exist", () => {
		const root = makeRoot();
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md", "favicon: docs/nope.svg"]);
		expect(() => resolveConfig(overrides(root))).toThrowError(/does not exist/);
	});

	it("throws when favicon is not an .svg/.png/.ico file", () => {
		const root = makeRoot();
		writeConfig(root, ["title: T", "content:", "  - docs/**/*.md", "favicon: docs/icon.webp"]);
		expect(() => resolveConfig(overrides(root))).toThrowError(
			/must point at a \.svg, \.png or \.ico file/,
		);
	});

	it("resolves relative to the config file's directory, not cwd", () => {
		const root = makeRoot();
		const nested = path.join(root, "site");
		fs.mkdirSync(nested, { recursive: true });
		writeConfig(nested, ["title: T", "content:", "  - docs/**/*.md"]);
		const cfg = resolveConfig(overrides(nested));
		expect(cfg.configDir).toBe(nested);
	});
});

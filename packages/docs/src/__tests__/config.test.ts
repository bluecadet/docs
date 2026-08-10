import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig, validateConfig } from "../config.js";

const CONFIG_PATH = "/repo/docs.config.yaml";

describe("validateConfig", () => {
	it("accepts a fully valid config with no warnings", () => {
		const { config, warnings } = validateConfig(
			{
				title: "My Project",
				repoUrl: "https://github.com/org/my-project",
				content: ["Packages/*/README.md"],
				base: "/my-project/",
				site: "https://org.github.io",
			},
			CONFIG_PATH,
		);
		expect(config).toEqual({
			title: "My Project",
			repoUrl: "https://github.com/org/my-project",
			content: ["Packages/*/README.md"],
			base: "/my-project/",
			site: "https://org.github.io",
		});
		expect(warnings).toEqual([]);
	});

	it("accepts an empty config", () => {
		const { config, warnings } = validateConfig({}, CONFIG_PATH);
		expect(config).toEqual({});
		expect(warnings).toEqual([]);
	});

	it("warns (not errors) on an unknown top-level key", () => {
		const { config, warnings } = validateConfig({ typo: "oops" }, CONFIG_PATH);
		expect(config).toEqual({});
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('"typo"');
	});

	it.each(["title", "repoUrl", "base", "site", "version", "sidebarMeta"] as const)(
		'throws a clear error when "%s" is not a string',
		(key) => {
			expect(() => validateConfig({ [key]: 5 }, CONFIG_PATH)).toThrowError(
				new RegExp(`"${key}" must be a string \\(got number\\)`),
			);
		},
	);

	it("coerces a bare content string into a one-element array", () => {
		const { config } = validateConfig({ content: "Packages/*/README.md" }, CONFIG_PATH);
		expect(config.content).toEqual(["Packages/*/README.md"]);
	});

	it("accepts a content array of strings unchanged", () => {
		const { config } = validateConfig({ content: ["a/*.md", "b/*.md"] }, CONFIG_PATH);
		expect(config.content).toEqual(["a/*.md", "b/*.md"]);
	});

	it("throws naming the index when a content array element is not a string", () => {
		expect(() => validateConfig({ content: ["a/*.md", 5] }, CONFIG_PATH)).toThrowError(
			/"content\[1\]" must be a string \(got number\)/,
		);
	});

	it("throws when content is neither a string nor an array", () => {
		expect(() => validateConfig({ content: 5 }, CONFIG_PATH)).toThrowError(
			/"content" must be a string or an array of strings \(got number\)/,
		);
	});

	it("throws when content is null", () => {
		expect(() => validateConfig({ content: null }, CONFIG_PATH)).toThrowError(/got null/);
	});

	describe("header/footer", () => {
		it("accepts header links and footer groups", () => {
			const { config, warnings } = validateConfig(
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
			const { config, warnings } = validateConfig(
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
			const { config, warnings } = validateConfig(
				{ footer: { meta: "MIT · no telemetry" } },
				CONFIG_PATH,
			);
			expect(config.footer).toEqual({ meta: "MIT · no telemetry" });
			expect(warnings).toEqual([]);
		});

		it("throws when footer.meta is not a string", () => {
			expect(() => validateConfig({ footer: { meta: 5 } }, CONFIG_PATH)).toThrowError(
				/"footer\.meta" must be a string \(got number\)/,
			);
		});

		it("warns on meta inside header (footer-only key)", () => {
			const { warnings } = validateConfig({ header: { meta: "nope" } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"header.meta"');
		});

		it("warns on links inside footer (footer uses groups, not links)", () => {
			const { warnings } = validateConfig(
				{ footer: { links: [{ label: "x", href: "/x/" }] } },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"footer.links"');
		});

		it("accepts a header with no links", () => {
			const { config } = validateConfig({ header: {} }, CONFIG_PATH);
			expect(config.header).toEqual({});
		});

		it.each(["header", "footer"] as const)('throws when "%s" is not an object', (key) => {
			expect(() => validateConfig({ [key]: "nope" }, CONFIG_PATH)).toThrowError(
				new RegExp(`"${key}" must be an object \\(got string\\)`),
			);
		});

		it("throws when header.links is not an array", () => {
			expect(() => validateConfig({ header: { links: "nope" } }, CONFIG_PATH)).toThrowError(
				/"header\.links" must be an array \(got string\)/,
			);
		});

		it("throws when a link is missing a label", () => {
			expect(() =>
				validateConfig({ header: { links: [{ href: "/x/" }] } }, CONFIG_PATH),
			).toThrowError(/"header\.links\[0\]\.label" must be a string \(got undefined\)/);
		});

		it("throws when a link href is not a string", () => {
			expect(() =>
				validateConfig({ header: { links: [{ label: "x", href: 5 }] } }, CONFIG_PATH),
			).toThrowError(/"header\.links\[0\]\.href" must be a string \(got number\)/);
		});

		it("warns on an unknown key inside header", () => {
			const { warnings } = validateConfig({ header: { typo: true } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"header.typo"');
		});

		it("warns on an unknown key inside a link", () => {
			const { warnings } = validateConfig(
				{ header: { links: [{ label: "x", href: "/x/", extra: 1 }] } },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"header.links[0].extra"');
		});
	});

	describe("footer.groups", () => {
		it("throws when footer.groups is not an array", () => {
			expect(() => validateConfig({ footer: { groups: "nope" } }, CONFIG_PATH)).toThrowError(
				/"footer\.groups" must be an array \(got string\)/,
			);
		});

		it("throws when a footer group is not an object", () => {
			expect(() => validateConfig({ footer: { groups: ["nope"] } }, CONFIG_PATH)).toThrowError(
				/"footer\.groups\[0\]" must be an object \(got string\)/,
			);
		});

		it("throws when a footer group is missing a title", () => {
			expect(() =>
				validateConfig({ footer: { groups: [{ links: [{ label: "x", href: "/x/" }] }] } }, CONFIG_PATH),
			).toThrowError(/"footer\.groups\[0\]\.title" must be a string \(got undefined\)/);
		});

		it("throws when a footer group's title is an empty string", () => {
			expect(() =>
				validateConfig(
					{ footer: { groups: [{ title: "", links: [{ label: "x", href: "/x/" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.title" must not be empty/);
		});

		it("throws when a footer group is missing links", () => {
			expect(() =>
				validateConfig({ footer: { groups: [{ title: "Project" }] } }, CONFIG_PATH),
			).toThrowError(/"footer\.groups\[0\]\.links" must be an array \(got undefined\)/);
		});

		it("throws when a footer group's links array is empty", () => {
			expect(() =>
				validateConfig({ footer: { groups: [{ title: "Project", links: [] }] } }, CONFIG_PATH),
			).toThrowError(/"footer\.groups\[0\]\.links" must not be empty/);
		});

		it("throws when a footer link is missing a label", () => {
			expect(() =>
				validateConfig(
					{ footer: { groups: [{ title: "Project", links: [{ href: "/x/" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.links\[0\]\.label" must be a string \(got undefined\)/);
		});

		it("throws when a footer link's label is an empty string", () => {
			expect(() =>
				validateConfig(
					{ footer: { groups: [{ title: "Project", links: [{ label: "", href: "/x/" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.links\[0\]\.label" must not be empty/);
		});

		it("throws when a footer link's href is an empty string", () => {
			expect(() =>
				validateConfig(
					{ footer: { groups: [{ title: "Project", links: [{ label: "x", href: "" }] }] } },
					CONFIG_PATH,
				),
			).toThrowError(/"footer\.groups\[0\]\.links\[0\]\.href" must not be empty/);
		});

		it("throws when a footer link's note is not a string", () => {
			expect(() =>
				validateConfig(
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
			const { warnings } = validateConfig({ footer: { typo: true } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"footer.typo"');
		});

		it("warns on an unknown key inside a footer group", () => {
			const { warnings } = validateConfig(
				{ footer: { groups: [{ title: "Project", links: [{ label: "x", href: "/x/" }], typo: 1 }] } },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"footer.groups[0].typo"');
		});

		it("warns on an unknown key inside a footer link", () => {
			const { warnings } = validateConfig(
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
			const { config, warnings } = validateConfig(
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
			const { config } = validateConfig(
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
			expect(() => validateConfig({ sidebar: "nope" }, CONFIG_PATH)).toThrowError(
				/"sidebar" must be an array \(got string\)/,
			);
		});

		it("throws when a sidebar group is not an object", () => {
			expect(() => validateConfig({ sidebar: ["nope"] }, CONFIG_PATH)).toThrowError(
				/"sidebar\[0\]" must be an object \(got string\)/,
			);
		});

		it("throws when a sidebar group label is missing", () => {
			expect(() => validateConfig({ sidebar: [{ items: [] }] }, CONFIG_PATH)).toThrowError(
				/"sidebar\[0\]\.label" must be a string \(got undefined\)/,
			);
		});

		it("throws when a sidebar group's items is not an array", () => {
			expect(() =>
				validateConfig({ sidebar: [{ label: "x", items: "nope" }] }, CONFIG_PATH),
			).toThrowError(/"sidebar\[0\]\.items" must be an array \(got string\)/);
		});

		it("throws naming the nested path when a deeply nested item is invalid", () => {
			expect(() =>
				validateConfig(
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
				/"sidebar\[0\]\.items\[0\]\.items\[0\]\.label" must be a string \(got undefined\)/,
			);
		});

		it("warns on an unknown key inside a sidebar group", () => {
			const { warnings } = validateConfig(
				{ sidebar: [{ label: "x", items: [], typo: 1 }] },
				CONFIG_PATH,
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"sidebar[0].typo"');
		});

		it("accepts a sidebar group with a link", () => {
			const { config, warnings } = validateConfig(
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
			const { config } = validateConfig(
				{
					sidebar: [
						{
							label: "Guides",
							items: [
								{ label: "Advanced", link: "guides/advanced", items: ["guides/ci"] },
							],
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
				validateConfig({ sidebar: [{ label: "x", items: [], link: 5 }] }, CONFIG_PATH),
			).toThrowError(/"sidebar\[0\]\.link" must be a string \(got number\)/);
		});
	});

	describe("version/sidebarMeta", () => {
		it("accepts a version and sidebarMeta string", () => {
			const { config, warnings } = validateConfig(
				{ version: "v2.4.1", sidebarMeta: "MIT licensed\nno telemetry" },
				CONFIG_PATH,
			);
			expect(config.version).toBe("v2.4.1");
			expect(config.sidebarMeta).toBe("MIT licensed\nno telemetry");
			expect(warnings).toEqual([]);
		});
	});

	describe("toc", () => {
		it("accepts a toc note and editLink", () => {
			const { config, warnings } = validateConfig(
				{ toc: { note: "updated for 2.4", editLink: "https://github.com/acme/proj/edit/main/{path}" } },
				CONFIG_PATH,
			);
			expect(config.toc).toEqual({
				note: "updated for 2.4",
				editLink: "https://github.com/acme/proj/edit/main/{path}",
			});
			expect(warnings).toEqual([]);
		});

		it("accepts a toc with no keys set", () => {
			const { config } = validateConfig({ toc: {} }, CONFIG_PATH);
			expect(config.toc).toEqual({});
		});

		it("throws when toc is not an object", () => {
			expect(() => validateConfig({ toc: "nope" }, CONFIG_PATH)).toThrowError(
				/"toc" must be an object \(got string\)/,
			);
		});

		it("throws when toc.note is not a string", () => {
			expect(() => validateConfig({ toc: { note: 5 } }, CONFIG_PATH)).toThrowError(
				/"toc\.note" must be a string \(got number\)/,
			);
		});

		it("throws when toc.editLink is not a string", () => {
			expect(() => validateConfig({ toc: { editLink: 5 } }, CONFIG_PATH)).toThrowError(
				/"toc\.editLink" must be a string \(got number\)/,
			);
		});

		it("warns on an unknown key inside toc", () => {
			const { warnings } = validateConfig({ toc: { typo: true } }, CONFIG_PATH);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain('"toc.typo"');
		});
	});

	it("warns once per unknown top-level key even alongside header/footer/sidebar", () => {
		const { warnings } = validateConfig(
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

	it("parses a full docs.config.yaml, including header/footer/sidebar", () => {
		const root = makeRoot();
		fs.writeFileSync(
			path.join(root, "docs.config.yaml"),
			[
				"title: My Project",
				"repoUrl: https://github.com/acme/proj",
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

		const cfg = resolveConfig({ root, out: path.join(root, "dist") });

		expect(cfg.title).toBe("My Project");
		expect(cfg.repoUrl).toBe("https://github.com/acme/proj");
		expect(cfg.site).toBe("https://acme.github.io");
		expect(cfg.base).toBe("/proj/");
		expect(cfg.content).toEqual(["packages/*/README.md"]);
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

	it("returns defaults when no docs.config.yaml exists", () => {
		const root = makeRoot();
		const cfg = resolveConfig({ root, out: path.join(root, "dist") });
		expect(cfg.content).toEqual([]);
		expect(cfg.header).toBeUndefined();
		expect(cfg.footer).toBeUndefined();
		expect(cfg.sidebar).toBeUndefined();
		expect(cfg.version).toBeUndefined();
		expect(cfg.sidebarMeta).toBeUndefined();
		expect(cfg.toc).toBeUndefined();
	});

	it("throws naming the file and the parser's message on invalid YAML", () => {
		const root = makeRoot();
		fs.writeFileSync(path.join(root, "docs.config.yaml"), "title: [unterminated");
		expect(() => resolveConfig({ root, out: path.join(root, "dist") })).toThrowError(
			/Failed to parse .*docs\.config\.yaml/,
		);
	});
});

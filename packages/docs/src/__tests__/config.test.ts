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

	it.each(["title", "repoUrl", "base", "site"] as const)(
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
		it("accepts header and footer link lists", () => {
			const { config, warnings } = validateConfig(
				{
					header: { links: [{ label: "Changelog", href: "/changelog/" }] },
					footer: { links: [{ label: "github", href: "https://github.com/acme/proj" }] },
				},
				CONFIG_PATH,
			);
			expect(config.header).toEqual({ links: [{ label: "Changelog", href: "/changelog/" }] });
			expect(config.footer).toEqual({
				links: [{ label: "github", href: "https://github.com/acme/proj" }],
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
	});

	it("warns once per unknown top-level key even alongside header/footer/sidebar", () => {
		const { warnings } = validateConfig(
			{ header: { links: [] }, footer: { links: [] }, sidebar: [], typo: 1 },
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
				"  links:",
				"    - label: github",
				"      href: https://github.com/acme/proj",
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
			links: [{ label: "github", href: "https://github.com/acme/proj" }],
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
	});

	it("throws naming the file and the parser's message on invalid YAML", () => {
		const root = makeRoot();
		fs.writeFileSync(path.join(root, "docs.config.yaml"), "title: [unterminated");
		expect(() => resolveConfig({ root, out: path.join(root, "dist") })).toThrowError(
			/Failed to parse .*docs\.config\.yaml/,
		);
	});
});

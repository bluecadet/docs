import { describe, expect, it } from "vitest";
import { validateConfig } from "../config.js";

const CONFIG_PATH = "/repo/docs.config.json";

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
});

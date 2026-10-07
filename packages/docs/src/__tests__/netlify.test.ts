import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeNetlifyFiles } from "../netlify.js";

let cwd: string;

beforeEach(async () => {
	cwd = await mkdtemp(path.join(os.tmpdir(), "docs-netlify-"));
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(cwd, { recursive: true, force: true });
});

describe("writeNetlifyFiles", () => {
	it("writes nothing outside Netlify", async () => {
		vi.stubEnv("NETLIFY", "");
		expect(await writeNetlifyFiles(cwd)).toBe(false);
		expect(existsSync(path.join(cwd, ".netlify"))).toBe(false);
	});

	it("writes the edge function and the .md header rule on Netlify", async () => {
		vi.stubEnv("NETLIFY", "true");
		expect(await writeNetlifyFiles(cwd)).toBe(true);

		const fn = await readFile(
			path.join(cwd, ".netlify/v1/edge-functions/docs-markdown.ts"),
			"utf8",
		);
		expect(fn).toContain('header: { accept: "text/markdown" }');
		const config = JSON.parse(await readFile(path.join(cwd, ".netlify/v1/config.json"), "utf8"));
		expect(config).toEqual({
			headers: [{ for: "/*.md", values: { "Content-Type": "text/markdown; charset=utf-8" } }],
		});
	});

	it("merges into an existing config.json", async () => {
		vi.stubEnv("NETLIFY", "true");
		const v1 = path.join(cwd, ".netlify/v1");
		await mkdir(v1, { recursive: true });
		const other = { for: "/*", values: { "X-Frame-Options": "DENY" } };
		await writeFile(
			path.join(v1, "config.json"),
			JSON.stringify({ redirects: [], headers: [other] }),
		);

		await writeNetlifyFiles(cwd);

		const config = JSON.parse(await readFile(path.join(v1, "config.json"), "utf8"));
		expect(config.redirects).toEqual([]);
		expect(config.headers).toEqual([
			other,
			{ for: "/*.md", values: { "Content-Type": "text/markdown; charset=utf-8" } },
		]);
	});
});

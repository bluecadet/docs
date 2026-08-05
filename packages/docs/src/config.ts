import fs from "node:fs";
import path from "node:path";
import { getGitBranch, getGitRemoteUrl } from "./git.js";
import type { DocsConfig, ResolvedConfig } from "./types.js";

const H1 = /^#[ \t]+(.+?)[ \t]*$/m;
const STRING_KEYS = ["title", "repoUrl", "base", "site"] as const;
const KNOWN_KEYS = new Set<string>([...STRING_KEYS, "content"]);

export interface CliOverrides {
	root: string;
	out: string;
	title?: string;
	repoUrl?: string;
	base?: string;
	site?: string;
}

/** Reads `docs.config.json` (if present), merges CLI overrides, and fills in sensible defaults. */
export function resolveConfig(overrides: CliOverrides): ResolvedConfig {
	const root = overrides.root;
	const configPath = path.join(root, "docs.config.json");
	const fileConfig = readConfigFile(configPath);

	const repoUrl = overrides.repoUrl ?? fileConfig.repoUrl ?? getGitRemoteUrl(root);
	const title =
		overrides.title ??
		fileConfig.title ??
		deriveTitleFromReadme(root) ??
		titleCase(path.basename(root));

	return {
		root,
		out: overrides.out,
		title,
		repoUrl,
		branch: getGitBranch(root),
		content: fileConfig.content ?? [],
		base: overrides.base ?? fileConfig.base,
		site: overrides.site ?? fileConfig.site,
	};
}

function readConfigFile(configPath: string): DocsConfig {
	if (!fs.existsSync(configPath)) return {};
	let raw: string;
	try {
		raw = fs.readFileSync(configPath, "utf8");
	} catch (err) {
		throw new Error(`Failed to read ${configPath}: ${(err as Error).message}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(`Failed to parse ${configPath}: ${(err as Error).message}`);
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${configPath}: expected a JSON object at the top level.`);
	}

	const { config, warnings } = validateConfig(parsed as Record<string, unknown>, configPath);
	for (const warning of warnings) console.warn(`[docs] ${warning}`);
	return config;
}

/**
 * Validates a parsed `docs.config.json` object: known string fields must actually be strings,
 * `content` may be a single glob string (coerced to a one-element array) or an array of glob
 * strings, and unknown keys are reported as warnings rather than errors (typos shouldn't be
 * fatal, but silently ignoring them entirely makes them hard to notice).
 */
export function validateConfig(
	parsed: Record<string, unknown>,
	configPath: string,
): { config: DocsConfig; warnings: string[] } {
	const warnings: string[] = [];
	const config: DocsConfig = {};

	for (const key of Object.keys(parsed)) {
		if (!KNOWN_KEYS.has(key)) {
			warnings.push(`${configPath}: unknown key "${key}" is ignored.`);
		}
	}

	for (const key of STRING_KEYS) {
		const value = parsed[key];
		if (value === undefined) continue;
		if (typeof value !== "string") {
			throw new Error(`${configPath}: "${key}" must be a string (got ${describeType(value)}).`);
		}
		config[key] = value;
	}

	if (parsed.content !== undefined) {
		config.content = validateContent(parsed.content, configPath);
	}

	return { config, warnings };
}

function validateContent(value: unknown, configPath: string): string[] {
	// A bare glob string is friendlier than forcing a single-element array on every consumer.
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) {
		value.forEach((item, i) => {
			if (typeof item !== "string") {
				throw new Error(
					`${configPath}: "content[${i}]" must be a string (got ${describeType(item)}).`,
				);
			}
		});
		return value as string[];
	}
	throw new Error(
		`${configPath}: "content" must be a string or an array of strings (got ${describeType(value)}).`,
	);
}

function describeType(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function deriveTitleFromReadme(root: string): string | undefined {
	const readmePath = path.join(root, "README.md");
	if (!fs.existsSync(readmePath)) return undefined;
	const raw = fs.readFileSync(readmePath, "utf8");
	const match = raw.match(H1);
	return match?.[1]?.replace(/[`*_]/g, "").trim();
}

function titleCase(stem: string): string {
	return stem.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

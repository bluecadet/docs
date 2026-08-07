import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { getGitBranch, getGitRemoteUrl } from "./git.js";
import type {
	ConfigLink,
	ConfigLinks,
	DocsConfig,
	FooterConfig,
	ResolvedConfig,
	SidebarGroup,
	SidebarItem,
} from "./types.js";

const H1 = /^#[ \t]+(.+?)[ \t]*$/m;
const STRING_KEYS = ["title", "repoUrl", "base", "site"] as const;
const KNOWN_KEYS = new Set<string>([...STRING_KEYS, "content", "header", "footer", "sidebar"]);
const LINKS_OBJECT_KEYS = new Set<string>(["links"]);
const FOOTER_KEYS = new Set<string>(["links", "meta"]);
const LINK_KEYS = new Set<string>(["label", "href"]);
const SIDEBAR_GROUP_KEYS = new Set<string>(["label", "items"]);

export interface CliOverrides {
	root: string;
	out: string;
	title?: string;
	repoUrl?: string;
	base?: string;
	site?: string;
}

/** Reads `docs.config.yaml` (if present), merges CLI overrides, and fills in sensible defaults. */
export function resolveConfig(overrides: CliOverrides): ResolvedConfig {
	const root = overrides.root;
	const configPath = path.join(root, "docs.config.yaml");
	const fileConfig = readConfigFile(configPath, root);

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
		header: fileConfig.header,
		footer: fileConfig.footer,
		sidebar: fileConfig.sidebar,
	};
}

function readConfigFile(configPath: string, root: string): DocsConfig {
	if (!fs.existsSync(configPath)) {
		const legacyPath = path.join(root, "docs.config.json");
		if (fs.existsSync(legacyPath)) {
			console.error(
				`[docs] found ${legacyPath} but config files are now YAML — rename/convert it to ${configPath}.`,
			);
		}
		return {};
	}
	let raw: string;
	try {
		raw = fs.readFileSync(configPath, "utf8");
	} catch (err) {
		throw new Error(`Failed to read ${configPath}: ${(err as Error).message}`);
	}
	let parsed: unknown;
	try {
		parsed = parseYaml(raw);
	} catch (err) {
		throw new Error(`Failed to parse ${configPath}: ${(err as Error).message}`);
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`${configPath}: expected a YAML mapping at the top level.`);
	}

	const { config, warnings } = validateConfig(parsed as Record<string, unknown>, configPath);
	for (const warning of warnings) console.warn(`[docs] ${warning}`);
	return config;
}

/**
 * Validates a parsed `docs.config.yaml` object: known string fields must actually be strings,
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

	if (parsed.header !== undefined) {
		config.header = validateLinksObject(parsed.header, "header", configPath, warnings);
	}
	if (parsed.footer !== undefined) {
		config.footer = validateFooter(parsed.footer, configPath, warnings);
	}
	if (parsed.sidebar !== undefined) {
		config.sidebar = validateSidebar(parsed.sidebar, configPath, warnings);
	}

	return { config, warnings };
}

/** Validates the `footer` object: `{ links?: { label, href }[], meta?: string }`. */
function validateFooter(value: unknown, configPath: string, warnings: string[]): FooterConfig {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${configPath}: "footer" must be an object (got ${describeType(value)}).`);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!FOOTER_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "footer.${childKey}" is ignored.`);
		}
	}

	const result: FooterConfig = {};
	if (obj.links !== undefined) {
		result.links = validateLinkArray(obj.links, "footer", configPath, warnings);
	}
	if (obj.meta !== undefined) {
		if (typeof obj.meta !== "string") {
			throw new Error(
				`${configPath}: "footer.meta" must be a string (got ${describeType(obj.meta)}).`,
			);
		}
		result.meta = obj.meta;
	}
	return result;
}

/** Validates the `header` object: `{ links?: { label, href }[] }`. */
function validateLinksObject(
	value: unknown,
	key: "header",
	configPath: string,
	warnings: string[],
): ConfigLinks {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${configPath}: "${key}" must be an object (got ${describeType(value)}).`);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!LINKS_OBJECT_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "${key}.${childKey}" is ignored.`);
		}
	}

	const result: ConfigLinks = {};
	if (obj.links !== undefined) {
		result.links = validateLinkArray(obj.links, key, configPath, warnings);
	}
	return result;
}

function validateLinkArray(
	value: unknown,
	key: string,
	configPath: string,
	warnings: string[],
): ConfigLink[] {
	if (!Array.isArray(value)) {
		throw new Error(`${configPath}: "${key}.links" must be an array (got ${describeType(value)}).`);
	}
	return value.map((item, i) => validateLink(item, `${key}.links[${i}]`, configPath, warnings));
}

function validateLink(
	value: unknown,
	label: string,
	configPath: string,
	warnings: string[],
): ConfigLink {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${configPath}: "${label}" must be an object (got ${describeType(value)}).`);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!LINK_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "${label}.${childKey}" is ignored.`);
		}
	}

	if (typeof obj.label !== "string") {
		throw new Error(
			`${configPath}: "${label}.label" must be a string (got ${describeType(obj.label)}).`,
		);
	}
	if (typeof obj.href !== "string") {
		throw new Error(
			`${configPath}: "${label}.href" must be a string (got ${describeType(obj.href)}).`,
		);
	}
	return { label: obj.label, href: obj.href };
}

/** Validates the top-level `sidebar` array: a list of group objects `{ label, items }`. */
function validateSidebar(value: unknown, configPath: string, warnings: string[]): SidebarGroup[] {
	if (!Array.isArray(value)) {
		throw new Error(`${configPath}: "sidebar" must be an array (got ${describeType(value)}).`);
	}
	return value.map((item, i) => validateSidebarGroup(item, `sidebar[${i}]`, configPath, warnings));
}

function validateSidebarGroup(
	value: unknown,
	label: string,
	configPath: string,
	warnings: string[],
): SidebarGroup {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${configPath}: "${label}" must be an object (got ${describeType(value)}).`);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!SIDEBAR_GROUP_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "${label}.${childKey}" is ignored.`);
		}
	}

	if (typeof obj.label !== "string") {
		throw new Error(
			`${configPath}: "${label}.label" must be a string (got ${describeType(obj.label)}).`,
		);
	}
	if (!Array.isArray(obj.items)) {
		throw new Error(
			`${configPath}: "${label}.items" must be an array (got ${describeType(obj.items)}).`,
		);
	}

	const items: SidebarItem[] = obj.items.map((item, i) =>
		validateSidebarItem(item, `${label}.items[${i}]`, configPath, warnings),
	);

	return { label: obj.label, items };
}

function validateSidebarItem(
	value: unknown,
	label: string,
	configPath: string,
	warnings: string[],
): SidebarItem {
	if (typeof value === "string") return value;
	return validateSidebarGroup(value, label, configPath, warnings);
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

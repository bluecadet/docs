import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { getGitBranch, getGitRemoteUrl } from "./git.js";
import type {
	ConfigLink,
	ConfigLinks,
	ContentEntry,
	DocsConfig,
	FooterConfig,
	FooterGroup,
	FooterLink,
	ResolvedConfig,
	SidebarItem,
	SidebarItemObject,
	TocConfig,
} from "./types.js";

/** Default config filename, resolved against cwd when `--config` isn't passed. */
export const CONFIG_FILENAME = "docs.config.yaml";

const LANDING_EXT = /\.(md|mdx)$/i;
const STRING_KEYS = [
	"title",
	"repoUrl",
	"glyph",
	"accent",
	"accent2",
	"base",
	"site",
	"version",
	"sidebarMeta",
	"landing",
] as const;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const KNOWN_KEYS = new Set<string>([
	...STRING_KEYS,
	"content",
	"header",
	"footer",
	"sidebar",
	"toc",
]);
const CONTENT_ENTRY_KEYS = new Set<string>(["base", "files", "route", "assets"]);
const LINKS_OBJECT_KEYS = new Set<string>(["links"]);
const FOOTER_KEYS = new Set<string>(["groups", "meta"]);
const FOOTER_GROUP_KEYS = new Set<string>(["title", "links"]);
const FOOTER_LINK_KEYS = new Set<string>(["label", "href", "note"]);
const LINK_KEYS = new Set<string>(["label", "href"]);
const SIDEBAR_ITEM_KEYS = new Set<string>(["label", "items", "link"]);
const TOC_KEYS = new Set<string>(["note", "editLink"]);

export interface CliOverrides {
	/** Absolute path to the config file. Everything else in the build resolves from its directory. */
	configPath: string;
	out: string;
	title?: string;
	repoUrl?: string;
	base?: string;
	site?: string;
}

/**
 * Reads the config file at `overrides.configPath` and merges CLI overrides. The config file is the
 * anchor for the whole build: it is required (there is no discovery by convention to fall back on),
 * and its directory — not cwd — is what every relative path in it, and every derived route id,
 * resolves against.
 */
export function resolveConfig(overrides: CliOverrides): ResolvedConfig {
	const configPath = overrides.configPath;
	const configDir = path.dirname(configPath);
	const fileConfig = readConfigFile(configPath);

	const title = overrides.title ?? fileConfig.title;
	if (title === undefined || title === "") {
		throw new Error(`${configPath}: "title" is required (add a \`title:\` line, or pass --title).`);
	}

	return {
		configPath,
		configDir,
		out: overrides.out,
		title,
		repoUrl: overrides.repoUrl ?? fileConfig.repoUrl ?? getGitRemoteUrl(configDir),
		glyph: fileConfig.glyph,
		accent: fileConfig.accent,
		accent2: fileConfig.accent2,
		branch: getGitBranch(configDir),
		content: fileConfig.content ?? [],
		landing: resolveLanding(fileConfig.landing, configDir, configPath),
		base: overrides.base ?? fileConfig.base,
		site: overrides.site ?? fileConfig.site,
		header: fileConfig.header,
		footer: fileConfig.footer,
		sidebar: fileConfig.sidebar,
		version: fileConfig.version,
		sidebarMeta: fileConfig.sidebarMeta,
		toc: fileConfig.toc,
	};
}

/**
 * Resolves `landing` to an absolute path, checking up front that it exists and is markdown — a
 * typo'd landing page should name itself at config-load time, not surface as a missing `/` route
 * after a full sync.
 */
function resolveLanding(
	landing: string | undefined,
	configDir: string,
	configPath: string,
): string | undefined {
	if (landing === undefined) return undefined;
	if (!LANDING_EXT.test(landing)) {
		throw new Error(
			`${configPath}: "landing" must point at a .md or .mdx file (got "${landing}").`,
		);
	}
	const abs = path.resolve(configDir, landing);
	if (!fs.existsSync(abs)) {
		throw new Error(`${configPath}: "landing" points at ${abs}, which does not exist.`);
	}
	return abs;
}

function readConfigFile(configPath: string): DocsConfig {
	if (!fs.existsSync(configPath)) {
		const legacyPath = configPath.replace(/\.ya?ml$/i, ".json");
		if (legacyPath !== configPath && fs.existsSync(legacyPath)) {
			console.error(
				`[docs] found ${legacyPath} but config files are now YAML — rename/convert it to ${configPath}.`,
			);
		}
		throw new Error(
			`no config file at ${configPath}. Every site is driven by a ${CONFIG_FILENAME} — create one there, or point at a different one with --config <path>.`,
		);
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
 * `content` is required and normalized to a list of fully-populated entries, and unknown keys are
 * reported as warnings rather than errors (typos shouldn't be fatal, but silently ignoring them
 * entirely makes them hard to notice).
 *
 * `title` is deliberately NOT checked here even though it's required — the CLI's `--title` can
 * supply it, so the "is it there at all" check belongs in `resolveConfig`, after the merge.
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
		if ((key === "accent" || key === "accent2") && !HEX_COLOR.test(value)) {
			throw new Error(`${configPath}: "${key}" must be a 6-digit hex color, e.g. "#9cc3a9" (got "${value}").`);
		}
		config[key] = value;
	}

	config.content = validateContent(parsed.content, configPath, warnings);

	if (parsed.header !== undefined) {
		config.header = validateLinksObject(parsed.header, "header", configPath, warnings);
	}
	if (parsed.footer !== undefined) {
		config.footer = validateFooter(parsed.footer, configPath, warnings);
	}
	if (parsed.sidebar !== undefined) {
		config.sidebar = validateSidebar(parsed.sidebar, configPath, warnings);
	}
	if (parsed.toc !== undefined) {
		config.toc = validateToc(parsed.toc, configPath, warnings);
	}

	return { config, warnings };
}

/** Validates the `footer` object: `{ groups?: { title, links }[], meta?: string }`. */
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
	if (obj.groups !== undefined) {
		result.groups = validateFooterGroups(obj.groups, configPath, warnings);
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

/** Validates the `footer.groups` array: a list of group objects `{ title, links }`. */
function validateFooterGroups(
	value: unknown,
	configPath: string,
	warnings: string[],
): FooterGroup[] {
	if (!Array.isArray(value)) {
		throw new Error(
			`${configPath}: "footer.groups" must be an array (got ${describeType(value)}).`,
		);
	}
	return value.map((item, i) =>
		validateFooterGroup(item, `footer.groups[${i}]`, configPath, warnings),
	);
}

function validateFooterGroup(
	value: unknown,
	label: string,
	configPath: string,
	warnings: string[],
): FooterGroup {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${configPath}: "${label}" must be an object (got ${describeType(value)}).`);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!FOOTER_GROUP_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "${label}.${childKey}" is ignored.`);
		}
	}

	if (typeof obj.title !== "string") {
		throw new Error(
			`${configPath}: "${label}.title" must be a string (got ${describeType(obj.title)}).`,
		);
	}
	if (obj.title.length === 0) {
		throw new Error(`${configPath}: "${label}.title" must not be empty.`);
	}

	if (!Array.isArray(obj.links)) {
		throw new Error(
			`${configPath}: "${label}.links" must be an array (got ${describeType(obj.links)}).`,
		);
	}
	if (obj.links.length === 0) {
		throw new Error(`${configPath}: "${label}.links" must not be empty.`);
	}

	const links = obj.links.map((item, i) =>
		validateFooterLink(item, `${label}.links[${i}]`, configPath, warnings),
	);

	return { title: obj.title, links };
}

function validateFooterLink(
	value: unknown,
	label: string,
	configPath: string,
	warnings: string[],
): FooterLink {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${configPath}: "${label}" must be an object (got ${describeType(value)}).`);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!FOOTER_LINK_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "${label}.${childKey}" is ignored.`);
		}
	}

	if (typeof obj.label !== "string") {
		throw new Error(
			`${configPath}: "${label}.label" must be a string (got ${describeType(obj.label)}).`,
		);
	}
	if (obj.label.length === 0) {
		throw new Error(`${configPath}: "${label}.label" must not be empty.`);
	}

	if (typeof obj.href !== "string") {
		throw new Error(
			`${configPath}: "${label}.href" must be a string (got ${describeType(obj.href)}).`,
		);
	}
	if (obj.href.length === 0) {
		throw new Error(`${configPath}: "${label}.href" must not be empty.`);
	}

	const link: FooterLink = { label: obj.label, href: obj.href };
	if (obj.note !== undefined) {
		if (typeof obj.note !== "string") {
			throw new Error(
				`${configPath}: "${label}.note" must be a string (got ${describeType(obj.note)}).`,
			);
		}
		link.note = obj.note;
	}
	return link;
}

/** Validates the `toc` object: `{ note?: string, editLink?: string }`. */
function validateToc(value: unknown, configPath: string, warnings: string[]): TocConfig {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${configPath}: "toc" must be an object (got ${describeType(value)}).`);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!TOC_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "toc.${childKey}" is ignored.`);
		}
	}

	const result: TocConfig = {};
	if (obj.note !== undefined) {
		if (typeof obj.note !== "string") {
			throw new Error(
				`${configPath}: "toc.note" must be a string (got ${describeType(obj.note)}).`,
			);
		}
		result.note = obj.note;
	}
	if (obj.editLink !== undefined) {
		if (typeof obj.editLink !== "string") {
			throw new Error(
				`${configPath}: "toc.editLink" must be a string (got ${describeType(obj.editLink)}).`,
			);
		}
		result.editLink = obj.editLink;
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

/** Validates the top-level `sidebar` array: a list of `SidebarItem`s. */
function validateSidebar(value: unknown, configPath: string, warnings: string[]): SidebarItem[] {
	if (!Array.isArray(value)) {
		throw new Error(`${configPath}: "sidebar" must be an array (got ${describeType(value)}).`);
	}
	return value.map((item, i) => validateSidebarItem(item, `sidebar[${i}]`, configPath, warnings));
}

/**
 * Validates a single `SidebarItem`: a bare content-id string, or an object needing `link`,
 * `items`, or both. `items` present makes it a group (which may still also carry its own `link`);
 * without `items` it's a leaf, equivalent to the bare string case plus an optional `label`
 * override. An object with neither `link` nor `items` has nothing to render and is a config error,
 * as is an `items` group with no `label` and no `link` to fall back on for its own heading.
 */
function validateSidebarItem(
	value: unknown,
	label: string,
	configPath: string,
	warnings: string[],
): SidebarItem {
	if (typeof value === "string") return value;
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(
			`${configPath}: "${label}" must be a string or an object (got ${describeType(value)}).`,
		);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!SIDEBAR_ITEM_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "${label}.${childKey}" is ignored.`);
		}
	}

	const item: SidebarItemObject = {};

	if (obj.label !== undefined) {
		if (typeof obj.label !== "string") {
			throw new Error(
				`${configPath}: "${label}.label" must be a string (got ${describeType(obj.label)}).`,
			);
		}
		item.label = obj.label;
	}

	if (obj.link !== undefined) {
		if (typeof obj.link !== "string") {
			throw new Error(
				`${configPath}: "${label}.link" must be a string (got ${describeType(obj.link)}).`,
			);
		}
		item.link = obj.link;
	}

	if (obj.items !== undefined) {
		if (!Array.isArray(obj.items)) {
			throw new Error(
				`${configPath}: "${label}.items" must be an array (got ${describeType(obj.items)}).`,
			);
		}
		item.items = obj.items.map((child, i) =>
			validateSidebarItem(child, `${label}.items[${i}]`, configPath, warnings),
		);
	}

	if (item.link === undefined && item.items === undefined) {
		throw new Error(
			`${configPath}: "${label}" must have a "link", "items", or both (got neither).`,
		);
	}
	if (item.items !== undefined && item.label === undefined && item.link === undefined) {
		throw new Error(
			`${configPath}: "${label}" has "items" but no "label" or "link" to use as its own heading — add one or the other.`,
		);
	}

	return item;
}

/**
 * Validates the required `content` array. Each element is either a bare glob string — sugar for
 * `{ base: ".", files: "<string>", route: "" }` — or an object entry, and both normalize to the
 * same fully-populated `ContentEntry` so nothing downstream has to re-handle the sugar.
 */
function validateContent(value: unknown, configPath: string, warnings: string[]): ContentEntry[] {
	if (value === undefined) {
		throw new Error(
			`${configPath}: "content" is required — list the files this site publishes, e.g.\ncontent:\n  - "docs/**/*.md"`,
		);
	}
	const raw = Array.isArray(value) ? value : [value];
	if (raw.length === 0) {
		throw new Error(`${configPath}: "content" must not be empty.`);
	}
	return raw.map((item, i) => validateContentEntry(item, `content[${i}]`, configPath, warnings));
}

function validateContentEntry(
	value: unknown,
	label: string,
	configPath: string,
	warnings: string[],
): ContentEntry {
	if (typeof value === "string") {
		return {
			base: ".",
			files: [requireNonEmpty(value, `${label}`, configPath)],
			route: "",
			assets: [],
		};
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(
			`${configPath}: "${label}" must be a glob string or an object with a "files" key (got ${describeType(value)}).`,
		);
	}
	const obj = value as Record<string, unknown>;

	for (const childKey of Object.keys(obj)) {
		if (!CONTENT_ENTRY_KEYS.has(childKey)) {
			warnings.push(`${configPath}: unknown key "${label}.${childKey}" is ignored.`);
		}
	}

	return {
		base: validateBase(obj.base, label, configPath),
		files: validateGlobList(obj.files, `${label}.files`, configPath, true),
		route: validateRoute(obj.route, label, configPath),
		assets: validateGlobList(obj.assets, `${label}.assets`, configPath, false),
	};
}

/** `base` is an ordinary relative directory path; `..` is explicitly allowed (sibling dirs, packages). */
function validateBase(value: unknown, label: string, configPath: string): string {
	if (value === undefined) return ".";
	if (typeof value !== "string") {
		throw new Error(
			`${configPath}: "${label}.base" must be a string (got ${describeType(value)}).`,
		);
	}
	if (value === "") {
		throw new Error(`${configPath}: "${label}.base" must not be empty (omit it for ".").`);
	}
	if (path.isAbsolute(value)) {
		throw new Error(
			`${configPath}: "${label}.base" must be relative to the config file, not absolute (got "${value}").`,
		);
	}
	return value;
}

/**
 * `route` is a route prefix, not a filesystem path: it has to be a clean sequence of segments so
 * the ids it produces are stable and can't escape the site (`..`) or double up separators.
 */
function validateRoute(value: unknown, label: string, configPath: string): string {
	if (value === undefined) return "";
	if (typeof value !== "string") {
		throw new Error(
			`${configPath}: "${label}.route" must be a string (got ${describeType(value)}).`,
		);
	}
	if (value === "") return "";
	const posix = value.split(path.sep).join("/");
	if (posix.startsWith("/") || posix.endsWith("/")) {
		throw new Error(
			`${configPath}: "${label}.route" must not start or end with "/" (got "${value}").`,
		);
	}
	const segments = posix.split("/");
	if (segments.some((s) => s === "" || s === "." || s === "..")) {
		throw new Error(
			`${configPath}: "${label}.route" must be a plain route prefix — no empty, "." or ".." segments (got "${value}").`,
		);
	}
	return posix;
}

/** Normalizes a `string | string[]` glob field, optionally requiring at least one pattern. */
function validateGlobList(
	value: unknown,
	label: string,
	configPath: string,
	required: boolean,
): string[] {
	if (value === undefined) {
		if (required) {
			throw new Error(`${configPath}: "${label}" is required (a glob string or array of globs).`);
		}
		return [];
	}
	const raw = Array.isArray(value) ? value : [value];
	if (required && raw.length === 0) {
		throw new Error(`${configPath}: "${label}" must not be empty.`);
	}
	return raw.map((item, i) =>
		requireNonEmpty(item, Array.isArray(value) ? `${label}[${i}]` : label, configPath),
	);
}

function requireNonEmpty(value: unknown, label: string, configPath: string): string {
	if (typeof value !== "string") {
		throw new Error(`${configPath}: "${label}" must be a string (got ${describeType(value)}).`);
	}
	if (value === "") {
		throw new Error(`${configPath}: "${label}" must not be empty.`);
	}
	return value;
}

function describeType(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

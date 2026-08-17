// Reads the `DOCS_CONFIG` JSON payload the CLI sets before running Astro (see
// ../../../src/build.ts's `applyEnv`). This is the app-side entry point for config-driven
// features (header/footer links, config-driven sidebar); components should prefer
// `getDocsConfig()` over reaching into `process.env` directly.
//
// The shape here is intentionally a duplicate of `DocsConfig`/`ResolvedConfig` in
// packages/docs/src/types.ts, not a shared import: the app is published as a standalone bundle
// (see packages/docs/package.json's `files`, which ships `app/src/lib` but not `src/`), so it
// can't reach across into the CLI package's source at runtime.

/** A single labeled link, e.g. in `header.links`. */
export interface ConfigLink {
	label: string;
	href: string;
}

/** An optional set of extra links rendered in the header chrome. */
export interface ConfigLinks {
	links?: ConfigLink[];
}

/** A single labeled link within a footer group, e.g. in `footer.groups[].links`. */
export interface FooterLink {
	label: string;
	href: string;
	/** Short muted annotation rendered after the label, e.g. a sibling project's domain. */
	note?: string;
}

/** A titled group of footer links, e.g. `{ title: "Project", links: [...] }`. */
export interface FooterGroup {
	title: string;
	links: FooterLink[];
}

/** Footer chrome: optional grouped links plus an optional right-aligned meta string. */
export interface FooterConfig {
	groups?: FooterGroup[];
	/** e.g. `ISC licensed · builds to static files`. Rendered on every page. */
	meta?: string;
}

/** The "on this page" TOC's optional bottom meta block (aside/desktop variant only). */
export interface TocConfig {
	/** Short attention-accented note, e.g. `updated for 2.4`. */
	note?: string;
	/**
	 * URL template for the per-page "edit this page" link. `{path}` is replaced with the page's
	 * source path relative to the consumer repo root, e.g. `docs/how-to/foo.md`.
	 */
	editLink?: string;
}

/**
 * A sidebar entry: either a bare content id (sugar for `{ link: id }`), or an object. An object
 * needs `link`, `items`, or both — `items` makes it a group node (which may still also carry its
 * own `link`, exactly like today's groups); without `items` it's a leaf, identical to the bare
 * string case except its label can be overridden. See `SidebarItemObject.label` for label
 * resolution.
 */
export type SidebarItem = string | SidebarItemObject;

/** The object form of a `SidebarItem` — see `SidebarItem` for the field-combination rules. */
export interface SidebarItemObject {
	/**
	 * Explicit display label. When omitted and `link` is set, falls back to the linked page's
	 * title. An object with `items` but neither `label` nor `link` has no label source and is a
	 * config error.
	 */
	label?: string;
	/** Content id this item (or, for a group, the group's own heading) links to. */
	link?: string;
	/** Nested items, in author-controlled order. Presence makes this a group node. */
	items?: SidebarItem[];
}

/** The parsed shape of `DOCS_CONFIG`, with fallbacks already applied. */
export interface DocsAppConfig {
	title: string;
	/**
	 * Filename of the favicon the sync step published into `public/`, e.g. `favicon.svg`. Unset when
	 * `docs.config.yaml` has no `favicon:` — no icon is shipped by default, and the page shell then
	 * renders no `<link rel="icon">` at all.
	 */
	favicon?: string;
	/** STATE accent color (hex), e.g. what succeeded, where you are. Falls back to tokens.css's sage default when unset. */
	accent?: string;
	/** ATTENTION accent color (hex), e.g. what changed, what's required. Falls back to tokens.css's amber default when unset. */
	accent2?: string;
	/**
	 * The config file's own basename, e.g. `docs.config.yaml`, or `other-name.yaml` when the CLI
	 * ran with `--config other-name.yaml`. Used in user-facing error messages (see nav.ts) so they
	 * name the file the consumer actually built with.
	 */
	configFileName: string;
	/**
	 * True when `docs.config.yaml` declared a `landing:` page, i.e. route `/` is a real page. When
	 * false there is no landing content and `/` renders a redirect to the first page in the sidebar
	 * instead (see src/pages/index.astro).
	 */
	hasLanding?: boolean;
	repoUrl?: string;
	base?: string;
	site?: string;
	header?: ConfigLinks;
	footer?: FooterConfig;
	sidebar?: SidebarItem[];
	/** Version string, e.g. `v2.4.1`. Rendered in the header and at the bottom of the sidebar. */
	version?: string;
	/** Multiline string; each non-empty line renders as its own row in the sidebar's bottom meta block. */
	sidebarMeta?: string;
	/** Optional bottom meta block for the desktop "on this page" TOC. */
	toc?: TocConfig;
}

const DEFAULTS: Pick<DocsAppConfig, "title" | "configFileName"> = {
	title: "docs",
	configFileName: "docs.config.yaml",
};

function parseDocsConfig(): DocsAppConfig {
	const raw = process.env.DOCS_CONFIG;
	if (!raw) return { ...DEFAULTS };
	try {
		const parsed = JSON.parse(raw) as Partial<DocsAppConfig>;
		return { ...DEFAULTS, ...parsed };
	} catch {
		return { ...DEFAULTS };
	}
}

// Parsed once at module load — `DOCS_CONFIG` is set before the Astro process starts and never
// changes for the lifetime of a build/dev run.
const docsConfig = parseDocsConfig();

/** The CLI-provided config for this build, with a `title: "docs"` fallback. */
export function getDocsConfig(): DocsAppConfig {
	return docsConfig;
}

/** Keep in sync with `FAVICON_EXT` in packages/docs/src/config.ts, which gates the allowed sources. */
const FAVICON_TYPES: Record<string, string> = {
	svg: "image/svg+xml",
	png: "image/png",
	ico: "image/x-icon",
};

/** `type` for the favicon `<link>`, e.g. `favicon.svg` -> `image/svg+xml`. */
export function faviconType(fileName: string): string | undefined {
	return FAVICON_TYPES[fileName.split(".").pop()?.toLowerCase() ?? ""];
}

/**
 * True when `href` is an absolute `http(s)` URL pointing at a different origin than the
 * configured `site` — i.e. it should get the "leaves the site" (↗) affordance. Without a
 * configured `site` to compare against, any absolute `http(s)` URL is treated as external, since
 * there's no way to know our own origin otherwise.
 */
export function isExternalLink(href: string): boolean {
	if (!/^https?:\/\//i.test(href)) return false;
	const { site } = docsConfig;
	if (!site) return true;
	try {
		return new URL(href).origin !== new URL(site).origin;
	} catch {
		return true;
	}
}

/**
 * `rel`/`target` for an `<a href={href}>`, spread directly onto the element: the "leaves the
 * site" pairing (`noopener noreferrer` + a new tab) for an external link, both `undefined` — so
 * neither attribute renders — for an internal one. Shared by every template that renders
 * `isExternalLink`-gated links (footer, nav sheet, header nav) so the pairing can't drift.
 */
export function externalLinkAttrs(href: string): { rel?: string; target?: string } {
	if (!isExternalLink(href)) return {};
	return { rel: "noopener noreferrer", target: "_blank" };
}

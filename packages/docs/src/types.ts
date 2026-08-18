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
	 * title. See `validateSidebarItem` (config.ts) for the "no label source" validation rule.
	 */
	label?: string;
	/** Content id this item (or, for a group, the group's own heading) links to. */
	link?: string;
	/** Nested items, in author-controlled order. Presence makes this a group node. */
	items?: SidebarItem[];
}

/**
 * One `content` entry after validation: the string sugar has been expanded, every field is filled
 * in, and paths are still relative (to the config file's directory for `base`, to `base` for the
 * globs). See `resolveContentEntry` in config.ts.
 */
export interface ContentEntry {
	/**
	 * Directory the globs below are relative to, itself relative to the config file's directory.
	 * `"."` by default. May climb out with `..` — pointing at a sibling checkout or a package
	 * directory outside the docs tree is a first-class use case.
	 */
	base: string;
	/**
	 * Glob patterns relative to `base` matching the `.md`/`.mdx`/`.astro` files to publish. Optional
	 * when `assets` is non-empty — an assets-only entry publishes no pages. An entry with neither
	 * `files` nor `assets` is a config error.
	 */
	files: string[];
	/**
	 * Route prefix for every page this entry publishes, e.g. `"packages"` puts `foo/README.md` at
	 * `/packages/foo/`. `""` (the default) publishes at the site root.
	 */
	route: string;
	/**
	 * Glob patterns relative to `base` matching non-content files to publish (images, casts,
	 * downloads). Empty by default — nothing is published implicitly, so an entry pointed at a
	 * source directory never sweeps up code.
	 */
	assets: string[];
}

/** `docs.config.yaml` — the single source of truth for a site. */
export interface DocsConfig {
	/** Site title. Required. */
	title?: string;
	/** Repo URL used for social links and for rewriting out-of-tree links to GitHub blob URLs. */
	repoUrl?: string;
	/**
	 * Path (relative to the config file) of an `.svg`/`.png`/`.ico` file published as the site's
	 * favicon. No favicon is shipped by default: with this unset, nothing is written to `public/` and
	 * no `<link rel="icon">` is rendered.
	 */
	favicon?: string;
	/** STATE accent color (hex), e.g. what succeeded, where you are. Defaults to the shared sage. */
	accent?: string;
	/** ATTENTION accent color (hex), e.g. what changed, what's required. Defaults to the shared amber. */
	accent2?: string;
	/** Where the site's pages come from. Required and non-empty — no discovery by convention (see `syncContent`, sync.ts). */
	content?: ContentEntry[];
	/**
	 * Path (relative to the config file) of the `.md`/`.mdx` file published at `/`. Optional: with
	 * no landing page, `/` redirects to the first page in the sidebar.
	 */
	landing?: string;
	/** Absolute site origin, e.g. `https://bluecadet.github.io`. */
	site?: string;
	/** Extra links rendered in the header chrome. */
	header?: ConfigLinks;
	/** Grouped links and an optional meta string rendered in the footer chrome. */
	footer?: FooterConfig;
	/**
	 * Author-controlled sidebar structure, and the only source of one — required and non-empty.
	 * Pages left out still build and route, they just get no sidebar entry.
	 */
	sidebar: SidebarItem[];
	/** Version string, e.g. `v2.4.1`. Rendered in the header and at the bottom of the sidebar. */
	version?: string;
	/** Multiline string; each non-empty line renders as its own row in the sidebar's bottom meta block. */
	sidebarMeta?: string;
	/** Optional bottom meta block for the desktop "on this page" TOC. */
	toc?: TocConfig;
}

/** Fully-resolved settings after merging `docs.config.yaml`, CLI flags, and defaults. */
export interface ResolvedConfig {
	/** Absolute path to the `docs.config.yaml` this config came from. */
	configPath: string;
	/**
	 * Absolute path to the directory holding the config file. Every relative path in the config —
	 * and every route id derived from a source file — resolves against this, never against cwd.
	 */
	configDir: string;
	/** Absolute path to the output directory for `build`. */
	out: string;
	title: string;
	repoUrl?: string;
	/** Absolute path to the favicon source file, when one is configured. */
	favicon?: string;
	accent?: string;
	accent2?: string;
	/** Default branch used when building GitHub blob URLs, e.g. "main". */
	branch: string;
	content: ContentEntry[];
	/** Absolute path to the landing page source file, when one is configured. */
	landing?: string;
	site?: string;
	header?: ConfigLinks;
	footer?: FooterConfig;
	sidebar: SidebarItem[];
	version?: string;
	sidebarMeta?: string;
	toc?: TocConfig;
}

/**
 * The shape of the `DOCS_CONFIG` JSON payload `applyEnv` (build.ts) serializes for the bundled app.
 * Mirrors `DocsAppConfig` in `packages/docs/app/src/lib/config.ts`, which can't import this file
 * directly — the app ships as a standalone bundle without `src/` (see that file's own comment) —
 * so the two are instead kept in sync by a conformance test in `__tests__/`.
 */
export interface DocsConfigPayload {
	title: string;
	/** Always set — `cfg.landing !== undefined`, never conditionally omitted like the fields below. */
	hasLanding: boolean;
	configFileName: string;
	repoUrl?: string;
	/** The published favicon filename (see `faviconFileName` in sync.ts), not `cfg.favicon`'s source path. */
	favicon?: string;
	accent?: string;
	accent2?: string;
	site?: string;
	header?: ConfigLinks;
	footer?: FooterConfig;
	sidebar: SidebarItem[];
	version?: string;
	sidebarMeta?: string;
	toc?: TocConfig;
}

/** Maps an absolute source file path to its resolved site route. */
export type RouteMap = Map<string, string>;

/**
 * Maps an absolute asset file path to the single site-root-relative path it is published at, e.g.
 * `/repo/docs/img/x.png` -> `img/x.png`. Built from the `assets` globs before any page is written,
 * so link rewriting resolves a reference by lookup rather than by re-deriving a path — there is
 * exactly one published location per asset, and an asset no glob covers simply isn't in the map.
 * Two different source files computing the same published path is a build error (see
 * `discoverContent` in sync.ts), so the reverse direction is unambiguous too.
 */
export type AssetMap = Map<string, string>;

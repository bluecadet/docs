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

/** A sidebar entry: either a synced page's content id, or a nested group. */
export type SidebarItem = string | SidebarGroup;

/** A labeled sidebar group containing pages and/or nested groups, in author-controlled order. */
export interface SidebarGroup {
	label: string;
	items: SidebarItem[];
	/** Optional content id the group's own heading links to, exactly like a leaf `SidebarItem` string. */
	link?: string;
}

/** Optional `docs.config.yaml` at the root of a consumer repo. */
export interface DocsConfig {
	/** Site title. Falls back to the README's first heading, then the repo directory name. */
	title?: string;
	/** Repo URL used for social links and for rewriting out-of-tree links to GitHub blob URLs. */
	repoUrl?: string;
	/** Extra glob patterns (relative to the repo root) to publish, e.g. a monorepo's per-package READMEs. */
	content?: string[];
	/** Base path for the deployed site, e.g. `/launchpad/` for a GitHub Pages project site. */
	base?: string;
	/** Absolute site origin, e.g. `https://bluecadet.github.io`. */
	site?: string;
	/** Extra links rendered in the header chrome. */
	header?: ConfigLinks;
	/** Grouped links and an optional meta string rendered in the footer chrome. */
	footer?: FooterConfig;
	/**
	 * Author-controlled sidebar structure. When present, drives `getNavTree()` instead of the
	 * default auto-generated (alphabetical, directory-mirroring) tree.
	 */
	sidebar?: SidebarGroup[];
	/** Version string, e.g. `v2.4.1`. Rendered in the header and at the bottom of the sidebar. */
	version?: string;
	/** Multiline string; each non-empty line renders as its own row in the sidebar's bottom meta block. */
	sidebarMeta?: string;
	/** Optional bottom meta block for the desktop "on this page" TOC. */
	toc?: TocConfig;
}

/** Fully-resolved settings after merging `docs.config.yaml`, CLI flags, and defaults. */
export interface ResolvedConfig {
	/** Absolute path to the consumer repo. */
	root: string;
	/** Absolute path to the output directory for `build`. */
	out: string;
	title: string;
	repoUrl?: string;
	/** Default branch used when building GitHub blob URLs, e.g. "main". */
	branch: string;
	content: string[];
	base?: string;
	site?: string;
	header?: ConfigLinks;
	footer?: FooterConfig;
	sidebar?: SidebarGroup[];
	version?: string;
	sidebarMeta?: string;
	toc?: TocConfig;
}

/** A single markdown/mdx source file destined for the published site. */
export interface SourceFile {
	/** Absolute path on disk. */
	absPath: string;
	/** Site route, e.g. "/how-to/install/" or "/" for the landing page. */
	route: string;
}

/** Maps an absolute source file path to its resolved site route. */
export type RouteMap = Map<string, string>;

/** A pending asset copy discovered while rewriting links/images. */
export interface AssetCopy {
	from: string;
	to: string;
}

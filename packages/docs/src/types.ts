/** Optional `docs.config.json` at the root of a consumer repo. */
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
}

/** Fully-resolved settings after merging `docs.config.json`, CLI flags, and defaults. */
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

// Shared nav tree. SidebarNav, NavSheet, Breadcrumb, Pagination, SearchModal, ClosingCta and the
// 404 route payload all read from here, so sidebar order and prev/next order can never drift
// apart.
//
// The tree is built directly from docs.config.yaml's `sidebar`, in the author-ordered group/item
// list. Group nodes are synthetic — they aren't backed by a content id, so `node.id` for a group
// is NOT guaranteed to be a real path prefix of its descendants' ids. `trailFor`/`containsId`
// below both find ancestors by actually walking the tree (not by comparing id strings).
//
// A group (a `SidebarItem` object with `items`) may declare its own page via `link` (a content id,
// exactly like a leaf item) — its node then behaves as a real page (`isPage: true`, `id` set to
// that content id) so active-state/trail matching and pagination treat it like any other page.
// Without a `link`, a group nested below the root still needs somewhere to send a click: its
// `href` becomes its first descendant's href (depth-first, `isPage` stays false so it isn't
// double-counted as a page). Root-level groups with no `link` keep the inert "section heading"
// treatment. A leaf item's `label`, when set, overrides the linked page's title; a group's
// `label`, when omitted, falls back to its `link`'s page title.
import { getCollection } from "astro:content";
import { docsAstroPages, rawAstroPages } from "./astro-pages.js";
import {
	type DocsAppConfig,
	type FooterGroup,
	getDocsConfig,
	LANDING_ENTRY_ID,
	type SidebarItem,
	type SidebarItemObject,
} from "./config.js";

export interface NavNode {
	/** Content-collection id / route path, e.g. `reference/config/base`. Unique across the tree. */
	id: string;
	/** Last path segment, e.g. `base`. Directory nodes render this + a trailing slash. */
	segment: string;
	/** Frontmatter title for pages; the raw path segment for index-less directories. */
	label: string;
	/** Frontmatter description, when the backing page has one. */
	description?: string;
	/** Link target. Absent only for directories/groups with no index page or descendant page. */
	href?: string;
	/** 0 for root-level nodes. */
	depth: number;
	/** True when a real content entry backs this node. */
	isPage: boolean;
	/**
	 * True for config-mode group nodes (a `SidebarItem` object with `items`; see
	 * `SidebarItemObject`). Lets renderers keep the root-level "section heading" treatment even
	 * when the group gains an `href` via `link` or a first-descendant fallback — only nested group
	 * headings adopt the plain sidebar-item look.
	 */
	isGroup?: boolean;
	children: NavNode[];
}

/** A NavNode that is definitely a linkable page. */
export type NavPage = NavNode & { href: string; isPage: true };

export interface NavTree {
	/** Root-level nodes, in display order. */
	nodes: NavNode[];
	/** Every page in the tree, depth-first pre-order — i.e. top-to-bottom sidebar reading order. */
	flat: NavPage[];
}

function collectPages(nodes: NavNode[], into: NavPage[]): void {
	for (const node of nodes) {
		if (isPage(node)) into.push(node);
		collectPages(node.children, into);
	}
}

function isPage(node: NavNode): node is NavPage {
	return node.isPage && typeof node.href === "string";
}

/** The last `/`-separated path segment of a content id, e.g. `reference/config/base` -> `base`. */
function lastSegment(id: string): string {
	return id.slice(id.lastIndexOf("/") + 1);
}

// Every doc-page render pulls the tree several times over (sidebar, nav sheet, search, footer,
// breadcrumb, pagination, header), and content is fixed for the lifetime of a build, so PROD
// caches the in-flight promise after the first call. Dev stays uncached so editing content is
// reflected without a server restart.
let cachedTree: Promise<NavTree> | null = null;

export function getNavTree(): Promise<NavTree> {
	if (!import.meta.env.PROD) return buildNavTree();
	cachedTree ??= buildNavTree();
	return cachedTree;
}

/**
 * Every synced markdown doc page, excluding the landing route (`LANDING_ENTRY_ID`) — the one
 * entry that isn't a sidebar/nav page. Shared by nav-tree building and the `[...slug]` catch-all
 * route, which both need the same "every real doc page" set.
 */
export async function getDocPages() {
	return getCollection("docs", ({ id }) => id !== LANDING_ENTRY_ID);
}

async function buildNavTree(): Promise<NavTree> {
	const base = import.meta.env.BASE_URL;
	const mdEntries = await getDocPages();
	// `layout: "docs"` astro pages (see ./astro-pages.ts) join the tree exactly like a synced
	// markdown entry, so docs.config.yaml sidebar entries and group `link:`s can reference them by
	// id, and breadcrumb/pagination/search-modal/footer — which all derive from this tree — pick
	// them up automatically. `layout: "raw"` pages are deliberately left out: they own their whole
	// document and have nowhere sensible to sit in a doc-page nav.
	const entries: NavEntry[] = [
		...mdEntries.map((entry) => ({
			id: entry.id,
			title: entry.data.title,
			description: entry.data.description,
		})),
		...docsAstroPages.map((page) => ({
			id: page.id,
			// Non-null: astro-pages.ts requires `title` for every `layout: "docs"` page.
			title: page.title as string,
			description: page.description,
		})),
	];
	const { sidebar } = getDocsConfig();

	const nodes = buildConfigNodes(sidebar, entries, base);

	const flat: NavPage[] = [];
	collectPages(nodes, flat);

	return { nodes, flat };
}

/** The bits of either a markdown collection entry or a `layout: "docs"` astro page the tree needs. */
interface NavEntry {
	id: string;
	title: string;
	description?: string;
}

/**
 * Config-driven tree: built directly from `sidebar`, in the order the author wrote it — no
 * sorting. Group nodes are synthetic (see the module-level comment on why `trailFor`/`containsId`
 * can't rely on id prefixes here).
 */
function buildConfigNodes(items: SidebarItem[], entries: NavEntry[], base: string): NavNode[] {
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const usedIds = new Set<string>(entries.map((entry) => entry.id));
	return items.map((item) => buildItemNode(item, byId, usedIds, base, 0));
}

/**
 * Looks up a sidebar-referenced id, throwing a descriptive error if it isn't a real page.
 * `layout: "raw"` astro pages get a clearer error than the generic "unknown page" one — they DO
 * exist, they just can't join a nav tree (they own their entire document; see ./astro-pages.ts).
 */
function requireNavEntry(id: string, byId: Map<string, NavEntry>): NavEntry {
	const entry = byId.get(id);
	if (entry) return entry;
	// Named after the file the consumer actually built with (see `configFileName` on
	// `DocsAppConfig`) rather than a hardcoded "docs.config.yaml", which would misname the file
	// under `--config other-name.yaml`.
	const configFileName = getDocsConfig().configFileName;
	if (rawAstroPages.some((page) => page.id === id)) {
		throw new Error(
			`${configFileName}: sidebar references "${id}", but that page has \`layout: "raw"\` — raw astro pages own their entire document and can't join the sidebar/nav. Use layout: "docs" instead, or remove this sidebar entry.`,
		);
	}
	throw new Error(
		`${configFileName}: sidebar references unknown page "${id}" (no synced content with that id).`,
	);
}

/** Builds a group node (a `SidebarItem` object with `items`). Validation guarantees `group.items`
 * is set, and that a group with no `link` has a `label` to use as its own heading. */
function buildGroupNode(
	group: SidebarItemObject,
	byId: Map<string, NavEntry>,
	usedIds: Set<string>,
	base: string,
	depth: number,
): NavNode {
	// Non-null: only called with objects that have `items` (see buildItemNode).
	const items = group.items as SidebarItem[];
	const children = items.map((item) => buildItemNode(item, byId, usedIds, base, depth + 1));

	if (group.link !== undefined) {
		const entry = requireNavEntry(group.link, byId);
		return {
			id: group.link,
			segment: lastSegment(group.link),
			label: group.label ?? entry.title,
			description: entry.description,
			href: `${base}${group.link}/`,
			depth,
			isPage: true,
			isGroup: true,
			children,
		};
	}

	// Non-null: config validation requires a `label` when a group has no `link` (see config.ts).
	const label = group.label as string;
	const id = uniqueSlug(label, usedIds);
	return {
		id,
		segment: id,
		label,
		depth,
		isPage: false,
		isGroup: true,
		// Nested groups with no page of their own link through to their first descendant instead;
		// root-level groups keep the inert "section heading" treatment (see SidebarNav.astro).
		href: depth > 0 ? firstHrefOf(children) : undefined,
		children,
	};
}

/** Builds a leaf node: a bare content-id string, or an object with `link` and no `items`. */
function buildItemNode(
	item: SidebarItem,
	byId: Map<string, NavEntry>,
	usedIds: Set<string>,
	base: string,
	depth: number,
): NavNode {
	if (typeof item === "object" && item.items !== undefined) {
		return buildGroupNode(item, byId, usedIds, base, depth);
	}

	// Non-null: string sugar for `{ link: item }`, or config validation requires an object leaf
	// (no `items`) to have `link` (see config.ts).
	const id = typeof item === "string" ? item : (item.link as string);
	const labelOverride = typeof item === "string" ? undefined : item.label;

	const entry = requireNavEntry(id, byId);
	return {
		id,
		segment: lastSegment(id),
		label: labelOverride ?? entry.title,
		description: entry.description,
		href: `${base}${id}/`,
		depth,
		isPage: true,
		children: [],
	};
}

function slugify(label: string): string {
	return (
		label
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "group"
	);
}

/** Slugifies `label`, disambiguating against every id already in use (real or synthetic). */
function uniqueSlug(label: string, usedIds: Set<string>): string {
	const base = slugify(label);
	let id = base;
	let n = 2;
	while (usedIds.has(id)) {
		id = `${base}-${n}`;
		n++;
	}
	usedIds.add(id);
	return id;
}

/** The first linkable page at or below `node`, in sidebar order. */
export function firstPageOf(node: NavNode): NavPage | undefined {
	if (isPage(node)) return node;
	for (const child of node.children) {
		const page = firstPageOf(child);
		if (page) return page;
	}
	return undefined;
}

/** The href of the first linkable page depth-first among `nodes`, or undefined if there isn't one. */
function firstHrefOf(nodes: NavNode[]): string | undefined {
	for (const node of nodes) {
		const page = firstPageOf(node);
		if (page) return page.href;
	}
	return undefined;
}

/**
 * Where a "docs" link points: the first page of the nav tree, falling back to the site root for
 * a repo with no doc pages at all. One target for every "docs" link in the chrome (header nav,
 * footer fallback, landing hero/CTAs) so the link never changes destination between templates.
 */
export async function docsEntryHref(): Promise<string> {
	const { nodes } = await getNavTree();
	const first = nodes[0] && firstPageOf(nodes[0]);
	return first?.href ?? import.meta.env.BASE_URL;
}

/**
 * `config.footer.groups`, falling back to a single "project" group with the default links the
 * footer has always shown — the docs entry point, plus the repo link when configured. Shared by
 * Footer.astro (renders the groups as columns) and NavSheet.astro (flattens them into one link
 * row), so the two can never drift apart.
 */
export async function footerGroups(config: DocsAppConfig): Promise<FooterGroup[]> {
	if (config.footer?.groups) return config.footer.groups;
	return [
		{
			title: "project",
			links: [
				{ label: "docs", href: await docsEntryHref() },
				...(config.repoUrl ? [{ label: "github", href: config.repoUrl }] : []),
			],
		},
	];
}

/** Root-to-node path (inclusive) for `id`, or an empty array when `id` isn't in the tree. */
export function trailFor(nodes: NavNode[], id: string): NavNode[] {
	for (const node of nodes) {
		if (node.id === id) return [node];
		const rest = trailFor(node.children, id);
		if (rest.length > 0) return [node, ...rest];
	}
	return [];
}

/** True when `id` is `node` itself or lives underneath it (actual descent, not an id comparison). */
export function containsId(node: NavNode, id: string | undefined): boolean {
	if (id === undefined) return false;
	if (node.id === id) return true;
	return node.children.some((child) => containsId(child, id));
}

/**
 * Shared by SidebarNav.astro and NavSheet.astro, which render the same recursive tree at
 * different breakpoints: children of a root-level directory keep the flat "group" treatment (dim
 * `guides/` label, items flush in the same column), while every deeper list becomes the indented,
 * hairline-bordered sub-page column.
 */
export function childrenAreNested(node: NavNode, nested: boolean): boolean {
	return nested || node.isPage || node.depth > 0;
}

/**
 * Shared by SidebarNav.astro and NavSheet.astro: root-level sidebar groups (a `SidebarItem` object with `items`; see `SidebarItemObject`
 * in ./config.ts) keep the dim mono "section heading" look even once they gain an `href` via `link`
 * — only a group nested below the root switches to the plain sidebar-item treatment other links
 * at its depth use.
 */
export function isSectionHeading(node: NavNode): boolean {
	return node.depth === 0 && Boolean(node.isGroup);
}

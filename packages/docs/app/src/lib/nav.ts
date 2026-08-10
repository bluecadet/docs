// Shared nav tree. SidebarNav, NavSheet, Breadcrumb, Pagination, SearchModal, ClosingCta and the
// 404 route payload all read from here, so sidebar order and prev/next order can never drift
// apart.
//
// Two build modes:
//
// - Auto (no `sidebar` in docs.config.yaml): the tree is genuinely recursive over content ids.
//   `docs/reference/config/base.md` syncs to content id `reference/config/base` and becomes a
//   depth-2 node under a `config` node under `reference`. An intermediate directory may or may not
//   have its own page: the CLI collapses `docs/guides/index.md` onto route `/guides/` (content id
//   `guides`), so a `guides` node can be BOTH a real page and a parent of `guides/*` children.
//   A root-level directory with no index page is an inert label node (no `href`); a nested one
//   still gets an `href` (its first descendant page, see `fillDirectoryHrefs`) so it's clickable.
//   Ordering is alphabetical —
//   there is no author-controlled ordering mechanism in auto mode. The one display convention
//   layered on top: at each level, leaf pages sort before nodes that have children, so a section's
//   own pages read before its subsections.
//
// - Config-driven (docs.config.yaml has a `sidebar`): the tree is built directly from the
//   author-ordered group/item list instead. Group nodes are synthetic — they aren't backed by a
//   content id, so unlike auto mode, `node.id` for a group is NOT guaranteed to be a real path
//   prefix of its descendants' ids. `trailFor`/`containsId` below both find ancestors by actually
//   walking the tree (not by comparing id strings), so this holds in both modes.
//
// A group may declare its own page via `SidebarGroup.link` (a content id, exactly like a leaf
// item) — its node then behaves as a real page (`isPage: true`, `id` set to that content id) so
// active-state/trail matching and pagination treat it like any other page. Without a `link`, a
// group nested below the root still needs somewhere to send a click: its `href` becomes its first
// descendant's href (depth-first, `isPage` stays false so it isn't double-counted as a page).
// Root-level groups with no `link` keep the inert "section heading" treatment. Auto mode mirrors
// the no-link case for nested directories with no index page.
import { type CollectionEntry, getCollection } from "astro:content";
import {
	type DocsAppConfig,
	type FooterGroup,
	getDocsConfig,
	type SidebarGroup,
	type SidebarItem,
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
	 * True for config-mode group nodes (see `SidebarGroup`). Lets renderers keep the root-level
	 * "section heading" treatment even when the group gains an `href` via `link` or a first-descendant
	 * fallback — only nested group headings adopt the plain sidebar-item look.
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

function compareNodes(a: NavNode, b: NavNode): number {
	const aHasChildren = a.children.length > 0;
	const bHasChildren = b.children.length > 0;
	if (aHasChildren !== bHasChildren) return aHasChildren ? 1 : -1;
	return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
}

function sortTree(nodes: NavNode[]): void {
	nodes.sort(compareNodes);
	for (const node of nodes) sortTree(node.children);
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

async function buildNavTree(): Promise<NavTree> {
	const base = import.meta.env.BASE_URL;
	// `index` is the landing route (src/pages/index.astro), not a sidebar entry.
	const entries = await getCollection("docs", ({ id }) => id !== "index");
	const { sidebar } = getDocsConfig();

	const nodes = sidebar ? buildConfigNodes(sidebar, entries, base) : buildAutoNodes(entries, base);

	const flat: NavPage[] = [];
	collectPages(nodes, flat);

	return { nodes, flat };
}

type DocsEntry = CollectionEntry<"docs">;

/** Default tree: alphabetical, mirrors the content ids' directory structure. */
function buildAutoNodes(entries: DocsEntry[], base: string): NavNode[] {
	const nodes: NavNode[] = [];
	const byId = new Map<string, NavNode>();

	// Materializes a node and every missing ancestor above it. Ancestors created this way start
	// as inert directory labels; they become links if an entry with that exact id turns up.
	function nodeFor(id: string): NavNode {
		const existing = byId.get(id);
		if (existing) return existing;

		const cut = id.lastIndexOf("/");
		const segment = id.slice(cut + 1);
		const node: NavNode = {
			id,
			segment,
			label: segment,
			depth: id.split("/").length - 1,
			isPage: false,
			children: [],
		};
		byId.set(id, node);

		if (cut === -1) nodes.push(node);
		else nodeFor(id.slice(0, cut)).children.push(node);

		return node;
	}

	for (const entry of entries) {
		const node = nodeFor(entry.id);
		node.isPage = true;
		node.label = entry.data.title;
		node.description = entry.data.description;
		node.href = `${base}${entry.id}/`;
	}

	sortTree(nodes);
	fillDirectoryHrefs(nodes);
	return nodes;
}

/**
 * A directory with no index page still needs somewhere to send a click once it's nested below the
 * root: give it its first descendant page's href, depth-first in display order. Root-level
 * directories with no index page keep the inert label treatment (see SidebarNav.astro).
 */
function fillDirectoryHrefs(nodes: NavNode[]): void {
	for (const node of nodes) {
		fillDirectoryHrefs(node.children);
		if (!node.isPage && node.depth > 0) {
			node.href = firstHrefOf(node.children);
		}
	}
}

const CONFIG_PATH = "docs.config.yaml";

/**
 * Config-driven tree: built directly from `sidebar`, in the order the author wrote it — no
 * sorting. Group nodes are synthetic (see the module-level comment on why `trailFor`/`containsId`
 * can't rely on id prefixes here).
 */
function buildConfigNodes(groups: SidebarGroup[], entries: DocsEntry[], base: string): NavNode[] {
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const usedIds = new Set<string>(entries.map((entry) => entry.id));
	return groups.map((group) => buildGroupNode(group, byId, usedIds, base, 0));
}

function buildGroupNode(
	group: SidebarGroup,
	byId: Map<string, DocsEntry>,
	usedIds: Set<string>,
	base: string,
	depth: number,
): NavNode {
	const children = group.items.map((item) => buildItemNode(item, byId, usedIds, base, depth + 1));

	if (group.link !== undefined) {
		const entry = byId.get(group.link);
		if (!entry) {
			throw new Error(
				`${CONFIG_PATH}: sidebar references unknown page "${group.link}" (no synced content with that id).`,
			);
		}
		const cut = group.link.lastIndexOf("/");
		return {
			id: group.link,
			segment: group.link.slice(cut + 1),
			label: group.label,
			description: entry.data.description,
			href: `${base}${group.link}/`,
			depth,
			isPage: true,
			isGroup: true,
			children,
		};
	}

	const id = uniqueSlug(group.label, usedIds);
	return {
		id,
		segment: id,
		label: group.label,
		depth,
		isPage: false,
		isGroup: true,
		// Nested groups with no page of their own link through to their first descendant instead;
		// root-level groups keep the inert "section heading" treatment (see SidebarNav.astro).
		href: depth > 0 ? firstHrefOf(children) : undefined,
		children,
	};
}

function buildItemNode(
	item: SidebarItem,
	byId: Map<string, DocsEntry>,
	usedIds: Set<string>,
	base: string,
	depth: number,
): NavNode {
	if (typeof item !== "string") return buildGroupNode(item, byId, usedIds, base, depth);

	const entry = byId.get(item);
	if (!entry) {
		throw new Error(
			`${CONFIG_PATH}: sidebar references unknown page "${item}" (no synced content with that id).`,
		);
	}
	const cut = item.lastIndexOf("/");
	return {
		id: item,
		segment: item.slice(cut + 1),
		label: entry.data.title,
		description: entry.data.description,
		href: `${base}${item}/`,
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

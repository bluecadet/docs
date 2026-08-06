// Shared nav tree. SidebarNav, NavSheet, Breadcrumb, Pagination, SearchModal, the landing CTA
// cards and the 404 route payload all read from here, so sidebar order and prev/next order can
// never drift apart.
//
// The tree is genuinely recursive: `docs/reference/config/base.md` syncs to content id
// `reference/config/base` and becomes a depth-2 node under a `config` node under `reference`.
// An intermediate directory may or may not have its own page: the CLI collapses
// `docs/guides/index.md` onto route `/guides/` (content id `guides`), so a `guides` node can be
// BOTH a real page and a parent of `guides/*` children. Directories with no index page are inert
// label nodes (no `href`).
//
// Ordering is alphabetical — there is no author-controlled ordering mechanism in this stack. The
// one display convention layered on top: at each level, leaf pages sort before nodes that have
// children, so a section's own pages read before its subsections.
import { getCollection } from "astro:content";

export interface NavNode {
	/** Content-collection id / route path, e.g. `reference/config/base`. Unique across the tree. */
	id: string;
	/** Last path segment, e.g. `base`. Directory nodes render this + a trailing slash. */
	segment: string;
	/** Frontmatter title for pages; the raw path segment for index-less directories. */
	label: string;
	/** Frontmatter description, when the backing page has one. */
	description?: string;
	/** Link target. Absent only for directories that have no index page. */
	href?: string;
	/** 0 for root-level nodes. */
	depth: number;
	/** True when a real content entry backs this node. */
	isPage: boolean;
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

export async function getNavTree(): Promise<NavTree> {
	const base = import.meta.env.BASE_URL;
	// `index` is the landing route (src/pages/index.astro), not a sidebar entry.
	const entries = await getCollection("docs", ({ id }) => id !== "index");

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

	const flat: NavPage[] = [];
	collectPages(nodes, flat);

	return { nodes, flat };
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

/** How many linkable pages sit at or below `node`. */
export function pageCount(node: NavNode): number {
	let total = isPage(node) ? 1 : 0;
	for (const child of node.children) total += pageCount(child);
	return total;
}

/** Root-to-node path (inclusive) for `id`, or an empty array when `id` isn't in the tree. */
export function trailFor(nodes: NavNode[], id: string): NavNode[] {
	for (const node of nodes) {
		if (node.id === id) return [node];
		if (id.startsWith(`${node.id}/`)) {
			const rest = trailFor(node.children, id);
			if (rest.length > 0) return [node, ...rest];
		}
	}
	return [];
}

/** True when `id` is `node` itself or lives underneath it. */
export function containsId(node: NavNode, id: string | undefined): boolean {
	return id !== undefined && (node.id === id || id.startsWith(`${node.id}/`));
}

// Shared nav-tree builder. SidebarNav, Pagination (and Breadcrumb, indirectly) all need the
// same grouping/ordering of docs entries so the sidebar order and prev/next order never drift
// apart. Grouped by top-level directory, matching the CLI's Diátaxis-flavored `docs/` tree.
import { getCollection } from "astro:content";

export interface NavItem {
	id: string;
	label: string;
	href: string;
}

export interface NavGroup {
	key: string;
	label: string;
	items: NavItem[];
}

export interface NavTree {
	/** Entries directly under docs/ with no subdirectory. */
	topLevel: NavItem[];
	/** Entries grouped by their top-level subdirectory (e.g. `tutorials/`). */
	groups: NavGroup[];
	/** topLevel, then each group's items in order — the order used for prev/next pagination. */
	flat: NavItem[];
}

export async function getNavTree(): Promise<NavTree> {
	const base = import.meta.env.BASE_URL;
	const entries = await getCollection("docs", ({ id }) => id !== "index");

	const topLevel: NavItem[] = [];
	const groupsByKey = new Map<string, NavGroup>();

	for (const entry of entries) {
		const parts = entry.id.split("/");
		const item: NavItem = { id: entry.id, label: entry.data.title, href: `${base}${entry.id}/` };

		if (parts.length === 1) {
			topLevel.push(item);
			continue;
		}

		const key = parts[0];
		let group = groupsByKey.get(key);
		if (!group) {
			group = { key, label: `${key}/`, items: [] };
			groupsByKey.set(key, group);
		}
		group.items.push(item);
	}

	topLevel.sort((a, b) => a.label.localeCompare(b.label));
	const groups = [...groupsByKey.values()].sort((a, b) => a.key.localeCompare(b.key));
	for (const group of groups) group.items.sort((a, b) => a.label.localeCompare(b.label));

	const flat = [...topLevel, ...groups.flatMap((group) => group.items)];

	return { topLevel, groups, flat };
}

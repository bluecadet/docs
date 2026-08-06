// Landing-page-only helper: groups the docs collection into top-level "sections" by first path
// segment, the same grouping SidebarNav.astro uses for its doc-page groups. Kept as a separate,
// small reimplementation here (rather than a shared import) per this page's ownership boundary —
// SidebarNav.astro belongs to a concurrent agent.
import { type CollectionEntry, getCollection } from "astro:content";

export interface NavSection {
	/** First path segment, e.g. "reference". */
	key: string;
	/** Humanized section title, e.g. "Reference". */
	title: string;
	/** All entries in this section, sorted by id. */
	entries: CollectionEntry<"docs">[];
	/** Section's first entry (by id order) — the section's landing target. */
	firstEntry: CollectionEntry<"docs">;
}

function labelFromSlug(slug: string): string {
	return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns top-level doc sections (excluding the index entry), sorted alphabetically by title —
 * the same order SidebarNav.astro uses, so the landing rail/CTA numbering matches the doc nav.
 */
export async function getNavSections(): Promise<NavSection[]> {
	const entries = await getCollection("docs", ({ id }) => id !== "index");

	const byKey = new Map<string, CollectionEntry<"docs">[]>();
	for (const entry of entries) {
		const key = entry.id.split("/")[0];
		const group = byKey.get(key);
		if (group) {
			group.push(entry);
		} else {
			byKey.set(key, [entry]);
		}
	}

	const sections: NavSection[] = [...byKey.entries()].map(([key, sectionEntries]) => {
		const sorted = [...sectionEntries].sort((a, b) => a.id.localeCompare(b.id));
		return {
			key,
			title: labelFromSlug(key),
			entries: sorted,
			firstEntry: sorted[0],
		};
	});

	sections.sort((a, b) => a.title.localeCompare(b.title));
	return sections;
}

export function hrefFor(base: string, entry: CollectionEntry<"docs">): string {
	return `${base}${entry.id}/`;
}

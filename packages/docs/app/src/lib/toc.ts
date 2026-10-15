import type { MarkdownHeading } from "astro";

export interface TocSection extends MarkdownHeading {
	children: TocSection[];
}

/** Keep the layout's rail and both TOC variants in sync. H1 is the page title. */
export function isTocHeading(heading: MarkdownHeading): boolean {
	return heading.depth >= 2 && heading.depth <= 4;
}

/** Nest under the nearest preceding shallower heading, including when levels are skipped. */
export function buildToc(headings: MarkdownHeading[]): TocSection[] {
	const sections: TocSection[] = [];
	const ancestors: TocSection[] = [];
	for (const heading of headings.filter(isTocHeading)) {
		let parent = ancestors.at(-1);
		while (parent && parent.depth >= heading.depth) {
			ancestors.pop();
			parent = ancestors.at(-1);
		}
		const section: TocSection = { ...heading, children: [] };
		(parent ? parent.children : sections).push(section);
		ancestors.push(section);
	}
	return sections;
}

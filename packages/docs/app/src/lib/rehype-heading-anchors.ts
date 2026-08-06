// Turns the sage "#" beside article H2/H3 headings into a real, clickable, keyboard-focusable
// anchor link to that heading — rather than the purely decorative CSS `::before` glyph it replaces
// (see article.css's history). Runs as a `markdown.rehypePlugins` entry, but — unlike its siblings
// `rehype-code-blocks.ts`/`rehype-tables.ts` — it depends on headings already having an `id`.
//
// Astro's own heading-id assignment (`rehypeHeadingIds` from `@astrojs/markdown-remark`, using
// github-slugger) always runs as the *last* rehype step, strictly after every plugin listed in
// `markdown.rehypePlugins` — that ordering is hardcoded in `@astrojs/markdown-remark`'s and
// `@astrojs/mdx`'s processor setup, not configurable from here. So this plugin can't simply expect
// `node.properties.id` to be set by the time it runs in the normal case. `astro.config.mjs` works
// around this by also listing `rehypeHeadingIds` itself, *before* this plugin, so ids exist here.
// That earlier call is harmless to duplicate: Astro's mandatory final pass only assigns an id when
// one isn't already a string, so it leaves ours alone.
//
// The anchor is deliberately left with NO text children. The visible "#" glyph is drawn by
// `article.css`'s `.heading-anchor::before { content: "#" }` instead. That's not just a styling
// choice: Astro's mandatory final `rehypeHeadingIds` pass also recomputes each heading's `text`
// metadata (the label `Toc.astro` renders verbatim in the "on this page" rail) by walking the
// heading's entire subtree — including whatever this plugin injects. A literal "#" text node here
// would get swept into that walk, silently turning a TOC entry like "Install lathe" into
// "#Install lathe". Keeping the anchor empty (id/label only, glyph via CSS) sidesteps that.
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

/** H1 is the page title (lifted out of the article body entirely — see article.css) and never
    gets an anchor. H2 is the only level the design draws a "#" prefix on; H3 is included too since
    it's just as valid a deep-link target and gets an `id` from the same slugger, even though it
    doesn't appear in the `Toc`/sidebar "on this page" lists (those only track depth-2 headings). */
const ANCHORED_HEADINGS = new Set(["h2", "h3"]);

export function rehypeHeadingAnchors() {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element) => {
			if (!ANCHORED_HEADINGS.has(node.tagName)) return;

			const id = node.properties.id;
			if (typeof id !== "string" || id.length === 0) return;

			const anchor: Element = {
				type: "element",
				tagName: "a",
				properties: {
					className: ["heading-anchor"],
					href: `#${id}`,
					ariaLabel: "Link to this section",
				},
				children: [],
			};

			node.children.unshift(anchor);
		});
	};
}

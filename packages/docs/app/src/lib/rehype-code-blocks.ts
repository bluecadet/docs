// Wraps Shiki's fenced-code output (`<pre class="astro-code" data-language="...">`, see
// @astrojs/internal-helpers/shiki.js) in a header bar carrying the language tag and a copy
// button, so `article.css` has a container to draw the code-block chrome around and
// `code-copy.ts` has a button to attach clipboard behavior to. Runs as a `markdown.rehypePlugins`
// entry, which Astro places *after* its own Shiki transform — the `<pre>` this looks for already
// exists by the time this plugin sees the tree.
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

export function rehypeCodeBlocks() {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (node.tagName !== "pre" || index === undefined || !parent) return;

			// Shiki's `pre` transformer (see @astrojs/internal-helpers/dist/shiki.js) sets
			// `properties.class` as a plain string, not the hast-conventional `properties.className`
			// array — so both forms are checked here.
			const classNames = node.properties.className ?? node.properties.class;
			const classes = Array.isArray(classNames)
				? classNames.map(String)
				: typeof classNames === "string"
					? classNames.split(/\s+/)
					: [];
			if (!classes.includes("astro-code")) return;

			const lang =
				typeof node.properties.dataLanguage === "string" ? node.properties.dataLanguage : "text";

			const header: Element = {
				type: "element",
				tagName: "div",
				properties: { className: ["code-block-header"] },
				children: [
					{
						type: "element",
						tagName: "span",
						properties: { className: ["code-block-lang"] },
						children: [{ type: "text", value: lang }],
					},
					{
						type: "element",
						tagName: "button",
						properties: { type: "button", className: ["code-copy"] },
						children: [{ type: "text", value: "copy" }],
					},
				],
			};

			const wrapper: Element = {
				type: "element",
				tagName: "div",
				properties: { className: ["code-block"] },
				children: [header, node],
			};

			parent.children[index] = wrapper;
		});
	};
}

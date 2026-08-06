// Wraps every rendered `<table>` in `<div class="table-wrap">` so `article.css` can put the
// container border/radius/overflow-x:auto on a plain block element instead of on `<table>`
// itself (border-radius clips badly on tables with `border-collapse`).
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

export function rehypeTables() {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (node.tagName !== "table" || index === undefined || !parent) return;

			const wrapper: Element = {
				type: "element",
				tagName: "div",
				properties: { className: ["table-wrap"] },
				children: [node],
			};

			parent.children[index] = wrapper;
		});
	};
}

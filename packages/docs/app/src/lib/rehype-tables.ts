// Wraps every rendered `<table>` in `<div class="table-wrap">` so `article.css` can put the
// container border/radius/overflow-x:auto on a plain block element instead of on `<table>`
// itself (border-radius clips badly on tables with `border-collapse`).
//
// Also stamps each column's header text onto its data cells as a `data-label` attribute — read by
// article.css's mobile row->card degradation (`td::before { content: attr(data-label) }`) so a
// stacked card still shows which value is which without a visible header row.
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import { textContent } from "./hast-text.js";

export function rehypeTables() {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (node.tagName !== "table" || index === undefined || !parent) return;

			// Assumes a single header row (the common case). Tables with multi-row/nested headers
			// still render fine — they just won't get per-cell `data-label`s on mobile.
			const headerLabels: string[] = [];
			visit(node, "element", (el: Element) => {
				if (el.tagName === "th") headerLabels.push(textContent(el).trim());
			});

			if (headerLabels.length > 0) {
				visit(node, "element", (row: Element) => {
					if (row.tagName !== "tr") return;
					const cells = row.children.filter(
						(child): child is Element => child.type === "element" && child.tagName === "td",
					);
					cells.forEach((cell, cellIndex) => {
						const label = headerLabels[cellIndex];
						if (label) cell.properties = { ...cell.properties, dataLabel: label };
					});
				});
			}

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

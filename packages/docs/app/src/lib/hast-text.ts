// Concatenates all text-node values under a hast node, in document order. A lightweight
// substitute for hast-util-to-text — not worth adding as a dependency for the two call sites that
// need it (rehype-heading-anchors.ts, rehype-tables.ts). Callers that need a trimmed result trim
// it themselves at the call site.
import type { Element } from "hast";
import { visit } from "unist-util-visit";

export function textContent(node: Element): string {
	let text = "";
	visit(node, "text", (textNode) => {
		text += textNode.value;
	});
	return text;
}

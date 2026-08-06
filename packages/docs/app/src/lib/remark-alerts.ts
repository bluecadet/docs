// Turns GitHub-style markdown alerts (synced content is GitHub-flavored) into the two callout
// variants `article.css` knows how to draw:
//
//   > [!NOTE]      > [!TIP]        -> neutral callout, label is the keyword itself
//   > [!IMPORTANT] > [!WARNING]    -> amber/attention callout, label "HEADS UP"
//   > [!CAUTION]
//
// A matching blockquote is rewritten in place (via mdast->hast `data.hName`/`hProperties`, the
// standard technique for custom hast output from a remark plugin) into:
//
//   <div class="callout callout--amber">
//     <div class="callout-label">HEADS UP</div>
//     <div class="callout-body">...rest of the blockquote's content...</div>
//   </div>
//
// Non-matching blockquotes (plain `> quote`) are left untouched and fall back to the base
// `.prose blockquote` styling.
import type { BlockContent, Blockquote, DefinitionContent, Paragraph, Root, Text } from "mdast";
import { visit } from "unist-util-visit";

type BlockquoteChild = BlockContent | DefinitionContent;

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/;
const AMBER_KEYWORDS = new Set(["IMPORTANT", "WARNING", "CAUTION"]);

export function remarkAlerts() {
	return (tree: Root): void => {
		visit(tree, "blockquote", (node: Blockquote) => {
			const first = node.children[0];
			if (first?.type !== "paragraph") return;

			const firstText = first.children[0];
			if (firstText?.type !== "text") return;

			const match = MARKER.exec(firstText.value);
			if (!match) return;

			const keyword = match[1] as "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";
			const amber = AMBER_KEYWORDS.has(keyword);
			const label = amber ? "HEADS UP" : keyword;

			const bodyChildren = stripMarker(node.children, first, firstText, match[0].length);

			const labelCarrier: Paragraph = {
				type: "paragraph",
				children: [],
				data: {
					hName: "div",
					hProperties: { className: ["callout-label"] },
					hChildren: [{ type: "text", value: label }],
				},
			};

			// A second carrier node (borrowing the `blockquote` mdast type purely for its matching
			// `children` shape) whose real mdast children are reused as-is, so the normal
			// mdast->hast transform still renders paragraphs/code/lists inside the callout body
			// instead of us having to hand-build hast for arbitrary block content.
			const bodyCarrier: Blockquote = {
				type: "blockquote",
				children: bodyChildren,
				data: { hName: "div", hProperties: { className: ["callout-body"] } },
			};

			node.children = [labelCarrier, bodyCarrier];
			node.data = {
				hName: "div",
				hProperties: { className: ["callout", amber ? "callout--amber" : "callout--neutral"] },
			};
		});
	};
}

/** Removes the `[!KEYWORD]` marker text (and a following hard break, if any) from the first
 * paragraph, dropping the paragraph entirely if the marker was its only content. Returns the
 * blockquote's remaining children, to be reused as the callout body. */
function stripMarker(
	children: BlockquoteChild[],
	firstParagraph: Paragraph,
	markerText: Text,
	markerLength: number,
): BlockquoteChild[] {
	const rest = markerText.value.slice(markerLength).replace(/^\s+/, "");
	if (rest) {
		markerText.value = rest;
		return children;
	}

	firstParagraph.children.shift();
	if (firstParagraph.children[0]?.type === "break") firstParagraph.children.shift();
	return firstParagraph.children.length > 0 ? children : children.slice(1);
}

import type { MarkdownHeading } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildToc, isTocHeading } from "../../app/src/lib/toc.js";
import { setupTocScrollSpy } from "../../app/src/scripts/toc.js";

const heading = (depth: number, slug: string): MarkdownHeading => ({ depth, slug, text: slug });

describe("TOC outline", () => {
	it("includes exactly H2–H4, in authored order", () => {
		const headings = [1, 2, 3, 4, 5, 6].map((depth) => heading(depth, `h${depth}`));
		expect(headings.filter(isTocHeading).map((entry) => entry.depth)).toEqual([2, 3, 4]);
		expect(buildToc(headings)).toEqual([
			{
				...heading(2, "h2"),
				children: [{ ...heading(3, "h3"), children: [{ ...heading(4, "h4"), children: [] }] }],
			},
		]);
	});

	it("handles missing parents, skipped levels, and a return to a shallower heading", () => {
		const tree = buildToc([
			heading(4, "orphan"),
			heading(3, "start"),
			heading(4, "child"),
			heading(2, "section"),
			heading(4, "skipped"),
			heading(3, "sibling"),
		]);
		expect(tree.map((entry) => entry.slug)).toEqual(["orphan", "start", "section"]);
		expect(tree[1]?.children.map((entry) => entry.slug)).toEqual(["child"]);
		expect(tree[2]?.children.map((entry) => entry.slug)).toEqual(["skipped", "sibling"]);
	});

	it("produces no TOC for empty or excluded headings", () => {
		expect(buildToc([])).toEqual([]);
		expect(buildToc([heading(1, "title"), heading(5, "minor")])).toEqual([]);
	});
});

// The scroll-spy needs only links, heading positions and browser events. Keeping these doubles
// small exercises both responsive copies without adding a DOM implementation to the package.
function browser() {
	const positions = [120, 220, 320];
	const ids = ["section", "nested", "café"];
	const links = [0, 1].flatMap(() =>
		ids.map((id) => {
			const attributes = new Map<string, string>();
			const classes = new Set<string>();
			return {
				hash: `#${encodeURIComponent(id)}`,
				getAttribute: (name: string) => (name === "href" ? `#${id}` : null),
				classList: {
					toggle: (name: string, active: boolean) => {
						if (active) classes.add(name);
						else classes.delete(name);
					},
				},
				setAttribute: (name: string, value: string) => attributes.set(name, value),
				removeAttribute: (name: string) => attributes.delete(name),
				attributes,
				classes,
			};
		}),
	);
	const events = new Map<string, () => void>();
	const location = { hash: "" };
	vi.stubGlobal("document", {
		documentElement: { scrollHeight: 2000 },
		querySelectorAll: () => links,
		getElementById: (id: string) => {
			const index = ids.indexOf(id);
			return index < 0 ? null : { getBoundingClientRect: () => ({ top: positions[index] }) };
		},
	});
	const viewport = {
		location,
		scrollY: 0,
		innerHeight: 800,
		addEventListener: (name: string, callback: () => void) => events.set(name, callback),
	};
	vi.stubGlobal("window", viewport);
	vi.stubGlobal("getComputedStyle", () => ({ scrollMarginBlockStart: "84px" }));
	vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
	const activeHashes = () =>
		links
			.filter((link) => link.attributes.get("aria-current") === "location")
			.map((link) => link.hash);
	return { links, positions, location, events, activeHashes, viewport };
}

afterEach(() => vi.unstubAllGlobals());

describe("TOC scroll-spy", () => {
	it("tracks H3/H4 on downward and upward scrolling in both variants", () => {
		const page = browser();
		setupTocScrollSpy();
		expect(page.activeHashes()).toEqual(["#section", "#section"]);
		page.positions.splice(0, 3, -200, -100, 84);
		page.events.get("scroll")?.();
		expect(page.activeHashes()).toEqual(["#caf%C3%A9", "#caf%C3%A9"]);
		page.positions.splice(0, 3, -50, 84, 184);
		page.events.get("scroll")?.();
		expect(page.activeHashes()).toEqual(["#nested", "#nested"]);
		expect(page.links.filter((link) => link.classes.has("is-active"))).toHaveLength(2);
	});

	it("honors initial deep links and subsequent fragment changes, including Unicode IDs", () => {
		const page = browser();
		page.location.hash = "#caf%C3%A9";
		setupTocScrollSpy();
		expect(page.activeHashes()).toEqual(["#caf%C3%A9", "#caf%C3%A9"]);
		page.location.hash = "#nested";
		page.events.get("hashchange")?.();
		expect(page.activeHashes()).toEqual(["#nested", "#nested"]);
	});

	it("keeps a visible fragment current when the document end prevents full scroll alignment", () => {
		const page = browser();
		setupTocScrollSpy();
		page.viewport.scrollY = 1200;
		page.positions.splice(0, 3, -200, 100, 200);
		page.location.hash = "#nested";
		page.events.get("hashchange")?.();
		page.events.get("scroll")?.();
		expect(page.activeHashes()).toEqual(["#nested", "#nested"]);
		page.location.hash = "";
		page.events.get("scroll")?.();
		expect(page.activeHashes()).toEqual(["#caf%C3%A9", "#caf%C3%A9"]);
	});

	it("does nothing when there are no TOC targets", () => {
		browser();
		vi.stubGlobal("document", { querySelectorAll: () => [] });
		expect(() => setupTocScrollSpy()).not.toThrow();
	});
});

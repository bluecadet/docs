import { describe, expect, it } from "vitest";
import { generateFaviconSvg } from "../favicon.js";

describe("generateFaviconSvg", () => {
	it("renders the glyph in the given accent color", () => {
		const svg = generateFaviconSvg("▲", "#8fb4d6");
		expect(svg).toContain(">▲<");
		expect(svg).toContain('fill="#8fb4d6"');
	});

	it("falls back to the shared default accent when none is given", () => {
		const svg = generateFaviconSvg("✓");
		expect(svg).toContain('fill="#9cc3a9"');
	});

	it("escapes XML-significant characters in the glyph", () => {
		const svg = generateFaviconSvg("<&>");
		expect(svg).toContain(">&lt;&amp;&gt;<");
	});
});

import { describe, expectTypeOf, it } from "vitest";
import type { DocsAppConfig } from "../../app/src/lib/config.js";
import type { DocsConfigPayload } from "../types.js";

// `applyEnv` (build.ts) serializes `DocsConfigPayload` into the `DOCS_CONFIG` env var, and
// `getDocsConfig()` (app/src/lib/config.ts) parses it back out as `DocsAppConfig`. The app can't
// import the CLI's types (it ships as a standalone bundle without `src/`), so the two shapes are
// hand-duplicated — this conformance test is the only thing that would catch one side drifting
// without the other, since a key added to one alone otherwise fails silently at runtime instead of
// at compile time.
//
// It's a `.test-d.ts` file, type-checked by vitest's `typecheck` runner (see vitest.config.ts and
// tsconfig.vitest.json) rather than executed through esbuild: plain type assertions in a regular
// `.test.ts` file are erased at runtime and would never actually fail.
//
// Only one assignability direction is asserted, not full mutual assignability: `hasLanding` is
// always set by `applyEnv` (required on `DocsConfigPayload`) but declared optional on
// `DocsAppConfig` (which has no default for it and treats an absent value as falsy) — a legitimate,
// intentional asymmetry, not drift. Asserting `DocsAppConfig extends DocsConfigPayload` would make
// this test permanently red for a reason unrelated to any real bug. `DocsConfigPayload extends
// DocsAppConfig` is the direction that actually matters: it's what promises the app can read every
// field the CLI sends with a compatible type.
describe("DOCS_CONFIG payload / app config shape", () => {
	it("declares exactly the fields DocsAppConfig knows about", () => {
		expectTypeOf<keyof DocsConfigPayload>().toEqualTypeOf<keyof DocsAppConfig>();
	});

	it("every DocsConfigPayload field is assignable to DocsAppConfig", () => {
		expectTypeOf<DocsConfigPayload>().toExtend<DocsAppConfig>();
	});
});

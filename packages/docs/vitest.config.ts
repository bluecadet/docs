import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		environment: "node",
		// Picks up `*.test-d.ts` type-only conformance tests (see
		// `__tests__/config-payload.test-d.ts`) alongside the regular runtime suite.
		typecheck: {
			enabled: true,
			tsconfig: "./tsconfig.vitest.json",
		},
	},
});

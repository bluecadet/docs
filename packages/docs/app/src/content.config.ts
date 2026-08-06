import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

// The CLI syncs the consumer repo's markdown into src/content/docs/ before every build/dev run
// (see ../../src/sync.ts). We load from that synced copy rather than glob-loading the consumer
// repo directly: an external `glob({ base })` loader over the consumer repo never copies assets
// and mixes the two directory trees.
export const collections = {
	docs: defineCollection({
		loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
		schema: z.object({
			title: z.string(),
			description: z.string().optional(),
		}),
	}),
};

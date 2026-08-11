import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// The CLI syncs the consumer repo's markdown into src/content/docs/ before every build/dev run
// (see ../../src/sync.ts). We load from that synced copy rather than glob-loading the consumer
// repo directly: an external `glob({ base })` loader over the consumer repo never copies assets
// and mixes the two directory trees.
//
// The landing page's hero is an MDX component (<Hero>, see src/components/landing/Hero.astro),
// not frontmatter — there is no landing-only schema to merge in here. The schema below is shared
// by every page in the collection (Astro allows one schema per collection); `title`/`description`
// double as the landing page's page title / Open Graph description (src/pages/index.astro) on top
// of their usual doc-page job.
export const collections = {
	docs: defineCollection({
		loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
		schema: z.object({
			title: z.string(),
			description: z.string().optional(),
			/**
			 * This page's source markdown path relative to the directory holding `docs.config.yaml`
			 * (see sync.ts), e.g. `docs/how-to/foo.md`. Used to build `toc.editLink` URLs; omitted for
			 * pages with no on-disk source.
			 */
			sourcePath: z.string().optional(),
		}),
	}),
};

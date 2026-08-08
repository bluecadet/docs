import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// The CLI syncs the consumer repo's markdown into src/content/docs/ before every build/dev run
// (see ../../src/sync.ts). We load from that synced copy rather than glob-loading the consumer
// repo directly: an external `glob({ base })` loader over the consumer repo never copies assets
// and mixes the two directory trees.
// Landing-page-only frontmatter. The landing route (src/pages/index.astro) renders its hero from
// frontmatter *before* it renders the MDX body, so anything that has to sit inside or beside the
// hero can't be an MDX component — it has to be authored up here. Everything is optional: a repo
// whose landing page is a plain README still gets a clean page, with each of these pieces
// rendering nothing at all.
//
// The schema is shared by every page in the collection (Astro allows one schema per collection).
// On a non-landing page these fields are simply never read.
const landingFields = {
	/** Up to 3 uppercase mono chips above the hero headline. */
	eyebrows: z
		.array(
			z.object({
				label: z.string(),
				/** state = STATE accent, attention = ATTENTION accent, neutral = plain outline. */
				tone: z.enum(["state", "attention", "neutral"]).default("neutral"),
			}),
		)
		.max(3)
		.optional(),
	/** Shown as a copyable `$ …` chip under the hero lead, e.g. `npx @bluecadet/docs build`. */
	installCommand: z.string().optional(),
	/** Marginalia beside the hero. The first renders in the attention accent, a second (max) renders neutral. */
	heroNotes: z.array(z.string()).max(2).optional(),
};

export const collections = {
	docs: defineCollection({
		loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
		schema: z.object({
			title: z.string(),
			description: z.string().optional(),
			/**
			 * Repo-root-relative path to this page's source markdown (see sync.ts), e.g.
			 * `docs/how-to/foo.md`. Used to build `toc.editLink` URLs; omitted for pages with no
			 * on-disk source.
			 */
			sourcePath: z.string().optional(),
			...landingFields,
		}),
	}),
};

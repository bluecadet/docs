import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

// The CLI syncs the consumer repo's markdown into src/content/docs/ before every build/dev run
// (see ../../src/sync.ts). We load from that synced copy rather than glob-loading the consumer
// repo directly: an external `glob({ base })` loader leaks ".." sidebar groups
// (withastro/starlight#1257) and never copies assets.
export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};

---
description: Describes how the built-in Pagefind search index is built, used, and its known limits.
---

# Search

The built site ships full-text search over every published page, powered by
[Pagefind](https://pagefind.app). No external service, no API key — the index is a set of static
files generated at build time and served alongside the rest of the site.

## When the index exists

- `docs build` generates the index as the last step of the Astro build: an `astro:build:done` hook
  runs Pagefind over the built HTML output and writes the index to `<out>/pagefind/`.
- `docs dev` never builds, so no index exists yet. Opening search in `dev` shows a "search index is
  built at build time" notice instead of results — run `docs build` (or preview its `dist/`) to test
  search for real.

## Using it

- Click the search field in the header, or press `/` anywhere on the site (except while typing in a
  text input) to open the search modal.
- Before you type anything, the modal shows your recently visited pages plus a short "start here"
  list — the site's top-level sections and each section's first page.
- Results are grouped by top-level section, the same grouping the sidebar uses, and ranked by
  Pagefind's relevance scoring.
- `↑`/`↓` moves between results, `Enter` opens the highlighted one, `Esc` closes the modal.
- A query with no matches links out to search or open the repo's GitHub issues, if `repoUrl` is
  configured — see [docs.config.json](/reference/docs-config-json/).

## Limitations

- The index only reflects content published at build time; it's rebuilt from scratch on every
  `docs build`, so nothing goes stale between deploys, but there's no incremental or live indexing.
- Recently-visited tracking is stored in `localStorage`, so it's per-browser and won't survive
  private/incognito sessions.

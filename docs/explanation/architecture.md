---
description: Explains why docs are synced into a bundled Astro app and rewritten, not read in place.
---

# Architecture and design decisions

## Copy-with-transform, not in-place

`@bluecadet/docs` ships its own Astro app (`packages/docs/app`), with its own `node_modules`.
Rather than pointing Astro's content collection loader at the consumer repo directly, every
`build`/`dev` invocation first **syncs** the files named by `docs.config.yaml`'s `content` and
`landing` into that bundled app's `src/content/docs/` (and each entry's `assets` globs into its
`public/`), applying title injection and link/asset rewriting along the way. Only then does
Astro's content `glob()` loader read from the synced copy.

This is a copy step, not a glob pattern reaching into the consumer repo, for two reasons:

- **Content-collection loaders read from a fixed location.** The `glob()` loader expects
  `src/content/docs/` inside the app it's configured for; there's no supported way to point it at
  an arbitrary external directory that also varies per invocation (`--config`'s directory).
- **Rewriting needs a write target.** Link/asset rewriting (see
  [content conventions](/reference/content-conventions/)) produces different bytes than the
  source file — a link becomes a site route, an image path becomes a `public/`-relative path. That
  transformed content has to live somewhere Astro can read it verbatim; the bundled app's own
  content directory is that place.

The tradeoff: every invocation re-syncs from scratch (the previous synced copy is wiped first).
`docs dev` does watch `docs.config.yaml`'s directory and each content entry's `base` for changes
and re-syncs automatically (see [CLI](/reference/cli/#docs-dev)), but re-syncing is still a batch
step run between file-change and Astro's own HMR, not a live pipeline — accepted as reasonable
given the target use case (docs built once per CI run, or a short local preview).

## The astro-pages escape hatch

Markdown/MDX covers most pages, but some need arbitrary components or build-time logic MDX can't
express cleanly. Any `content`-matched `.astro` file takes the copy-with-transform idea one step
further: the sync step copies it verbatim (no rewriting — it isn't markdown) into the bundled app's
`src/astro-pages/`, at a path that mirrors its route. The app globs that directory eagerly at
build time (`lib/astro-pages.ts`), validates each module's `layout`/`title`/`description` exports,
and the catch-all route (`pages/[...slug].astro`) renders a `layout: "docs"` page inside the same
chrome a markdown page gets, or a `layout: "raw"` page bare, with no chrome at all — see
[content conventions](/reference/content-conventions/#astro-pages) for the full contract.

## Why titles are injected pre-validation

The bundled app's `docs` content collection schema requires a `title` field. Source markdown in a
consumer repo very often doesn't have frontmatter at all — it's plain, GitHub-flavored markdown
with a leading `# Heading`. Rather than requiring every consumer repo to add frontmatter, the sync
step lifts the first `# Heading` into a `title:` frontmatter field (and strips the heading from the
body, so the page layout doesn't render the title twice) **before** the file is written into the
content collection. By the time Astro's schema validation runs, every synced file already has a
valid `title`, so the loader never sees (or has to work around) a schema violation.

## The link route map

Link rewriting needs to know, for every relative link in every file, whether its target is
(a) another published doc, and if so at what route, (b) an asset to copy, or (c) something outside
the published set entirely. That requires knowing the full set of published files and their
routes *before* rewriting any individual file's links — a link in the first file processed might
point at the last file discovered.

The sync step resolves this in two passes: first `discoverContent()` walks every `content` entry
(plus the configured `landing` page, if any) to build the complete file list and every file's final
route — applying the `index`/`README` collapse and failing fast on any collision — all before any
file's markdown is parsed or rewritten. Only then does `syncContent()`'s per-file loop run,
resolving each relative link against that complete map.

## Known limitations

See [content conventions](/reference/content-conventions/#known-limitations) and the
[CLI reference](/reference/cli/) for the concrete, user-facing list (MDX passthrough, first-wins
asset collisions, single-quoted HTML attributes, unresolved reference-style links). These are
documented tradeoffs, not oversights: each traces back to one of the design decisions above — MDX
passthrough follows directly from "rewriting needs to understand the AST it's rewriting," and
re-syncing on every change (rather than patching the synced copy in place) follows directly from
"sync is a batch step, not a live pipeline."

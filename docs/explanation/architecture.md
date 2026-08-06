# Architecture and design decisions

## Copy-with-transform, not in-place

`@bluecadet/docs` ships its own Astro app (`packages/docs/app`), with its own `node_modules`.
Rather than pointing Astro's content collection loader at the consumer repo directly, every
`build`/`dev` invocation first **syncs** the consumer's `README.md` and `docs/` tree into that
bundled app's `src/content/docs/` (and copies referenced assets into its `public/`), applying
title injection and link/asset rewriting along the way. Only then does Astro's content `glob()`
loader read from the synced copy.

This is a copy step, not a glob pattern reaching into the consumer repo, for two reasons:

- **Content-collection loaders read from a fixed location.** The `glob()` loader expects
  `src/content/docs/` inside the app it's configured for; there's no supported way to point it at
  an arbitrary external directory that also varies per invocation (`--root`).
- **Rewriting needs a write target.** Link/asset rewriting (see
  [content conventions](/reference/content-conventions/)) produces different bytes than the
  source file — a link becomes a site route, an image path becomes a `public/`-relative path. That
  transformed content has to live somewhere Astro can read it verbatim; the bundled app's own
  content directory is that place.

The tradeoff: every invocation re-syncs from scratch (the previous synced copy is wiped first), and
`docs dev` doesn't watch the consumer repo for changes — restarting is the way to pick up edits.
Both are accepted as reasonable given the target use case (docs built once per CI run, or a short
local preview), rather than a long-running authoring workflow.

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

The sync step resolves this in two passes: first `discoverContent()` walks the repo (`docs/`, the
chosen landing page, any `content` globs) to build the complete file list, then `buildRouteMap()`
computes every file's final route (applying the `index`/`README` collapse and the landing-page
`/` vs. `/overview/` conflict rule) — all before any file's markdown is parsed or rewritten. Only
then does the per-file rewrite pass run, resolving each relative link against that complete map.

## Known limitations

See [content conventions](/reference/content-conventions/#known-limitations) and the
[CLI reference](/reference/cli/) for the concrete, user-facing list (MDX passthrough, `dev` not
watching, single-quoted HTML attributes, unresolved reference-style links). These are documented
tradeoffs, not oversights: each traces back to one of the design decisions above — MDX passthrough
follows directly from "rewriting needs to understand the AST it's rewriting," and `dev` not
watching follows directly from "sync is a batch step, not a live pipeline."

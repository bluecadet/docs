---
description: Details which files get published, how routes and titles are derived, and how links get rewritten.
---

# Content conventions

## What gets published

`content` in `docs.config.yaml` is the only source of pages — required, non-empty, and nothing is
discovered by convention. Each entry is a `base` directory, one or more `files` globs relative to
it, an optional `route` prefix, and an optional `assets` globs list; see
[docs.config.yaml](/reference/docs-config-yaml/#content) for the full shape. A bare glob string is
sugar for `{ base: ".", files: "<string>", route: "" }`.

- Every file a `files` glob matches is published, one page per `.md`/`.mdx`/`.astro` file. Matches
  of any other extension are ignored.
- A file matched by more than one `content` entry is a build error naming both entries.
- `landing` (optional, top-level) points at one `.md`/`.mdx` file that becomes `/`. If a `content`
  glob also matches it, that entry skips it — it's already published — and a notice is printed, not
  an error.
- With no `landing` set, there is no `/` page: the build emits a meta-refresh redirect from `/` to
  the first page in the resolved sidebar instead. A build with zero pages at all (no matching
  `content` glob and no `landing`) is an error.

## Routing

- A page's route is its path relative to its entry's `base`, prefixed with the entry's `route`,
  extension stripped and lowercased. `docs/How-To/Deploy.md` with `base: docs` is
  `/how-to/deploy/`.
- `index`/`README` basenames (case-insensitive) collapse onto their parent directory's route:
  `docs/how-to/index.md` (`base: docs`) → `/how-to/`; `packages/docs/README.md`
  (`base: packages, route: packages`) → `/packages/docs/`.
- **`base` is what gets stripped, not `route`.** With the default `base: "."`, a glob like
  `"docs/**/*.md"` keeps the `docs/` segment in every route (`/docs/reference/cli/`) — set
  `base: docs` to publish at `/reference/cli/` instead.
- Two files resolving to the same route (e.g. `docs/how-to.md` and `docs/how-to/index.md` both
  naturally routing to `/how-to/`) is a build error naming both files. Routes are never
  silently overwritten.

## Title derivation

Checked in order, first match wins:

1. Frontmatter `title:`, if present.
2. The first `# Heading` in the body — lifted into the title and stripped from the body (the page
   layout already renders the title from frontmatter, so leaving the heading in place would show
   it twice).
3. The filename, title-cased (`install-preflight.md` → "Install Preflight").

`.mdx` files use the same order, except the heading is left in the body (see
[MDX passthrough](#mdx-passthrough) below) and title extraction is a best-effort regex rather than
a full markdown parse.

## Frontmatter

Two fields are read by the site, both optional:

| Field | Effect |
| --- | --- |
| `title` | The page title. If omitted, derived per [Title derivation](#title-derivation) above. |
| `description` | Rendered as the page's `<meta name="description">`. On the `landing:` page specifically, it's also the landing page's hero lead paragraph, under the `title`-driven headline. |

No other frontmatter fields are read — the content schema is just `{ title, description? }`.

Sidebar navigation is generated from the published file tree by default, or from `docs.config.yaml`'s
`sidebar` field when set — see [docs.config.yaml](/reference/docs-config-yaml/#sidebar-semantics).
Full-text search — see [Search](/reference/search/) — is always generated from the published file
tree; there's no separate search config. Neither reads frontmatter beyond `title`/`description`.

## Markdown features

Beyond standard GitHub-flavored markdown, the site renders a few things specially.

### Alerts

GitHub-style alert blockquotes render as designed callouts:

```md
> [!NOTE]
> Neutral, informational.

> [!TIP]
> Neutral, a suggestion.

> [!IMPORTANT]
> Attention — something the reader needs to know.

> [!WARNING]
> Attention — something that could go wrong.

> [!CAUTION]
> Attention — something that will break.
```

`NOTE` and `TIP` render as a neutral callout labeled with the keyword itself. `IMPORTANT`,
`WARNING`, and `CAUTION` all render as a single attention-styled callout labeled "HEADS UP" — the
design system reserves its amber accent for attention (what changed, what's required, what will
break), so all three attention-level keywords share that one treatment rather than three separate
colors. A blockquote without a `[!KEYWORD]` marker renders as a plain quote.

### Code blocks

Fenced code blocks with a language tag (` ```sh `, ` ```ts `, etc.) get a header bar showing that
language and a copy button — no configuration needed, this applies automatically to every fenced
block.

Add a brace-delimited line list right after the language tag to highlight specific lines — single
numbers and ranges both work, comma-separated. ` ```ts {2,5-7} ` highlights lines 2 and 5 through
7:

```ts {2,5-7}
function greet(name: string) {
  console.log(`Hello, ${name}!`);
}

const config = {
  retries: 3,
  timeout: 5000,
};
```

### Tables

Standard markdown tables render in a bordered, horizontally-scrollable container. No extra syntax
required.

## Link and asset rewriting

Every published `.md` file (not `.mdx` — see below) is parsed into a markdown AST and rewritten
during the sync step:

- **Relative links to other published docs** (`[x](../how-to/y.md)`) become their site route
  (`/how-to/y/`), preserving any `?query` and/or `#hash` suffix, including reference-style links
  (`[x][ref]` + `[ref]: ../y.md`), and links inside raw HTML (`<a href="...">`, double-quoted
  attributes only).
- **Relative image/asset references** are rewritten to the single path an `assets` glob published
  the file at (`<route>/<path relative to base>`). This is a lookup against the published asset
  map, not a guess — a page never sees an asset it didn't declare in `assets`. A reference to a
  file no `assets` glob covers gets a build warning naming the page and the file, and is still
  rewritten to a `/`-rooted path so the build finishes with one visibly broken image instead of
  aborting — see [docs.config.yaml](/reference/docs-config-yaml/#content) for the `assets` field.
- **Relative links pointing outside the published set** (source directories, `LICENSE`,
  `CONTRIBUTING.md`, etc.) become a GitHub blob URL (`{repoUrl}/blob/{branch}/{path}`) when a
  `repoUrl` is known; otherwise the link is unwrapped to plain text (the hyperlink is dropped, the
  link text stays).
- All of the above respect the configured base path — generated links and asset paths are
  prefixed accordingly.
- Absolute-looking (`/`-rooted) links and images already present in source markdown are treated as
  site-root-relative and get the configured base path prefixed at rewrite time (e.g. `/foo/` →
  `/launchpad/foo/` under `base: "/launchpad/"`) — they are not otherwise validated or resolved.

### MDX passthrough

`.mdx` files (typically a rich `landing:` page) are copied through untransformed — no link/asset
rewriting, no heading extraction beyond a best-effort regex for the title. This is deliberate: a
full markdown AST pass doesn't understand JSX or component imports and would corrupt them. One
consequence: MDX gets **no base-path prefixing either**, since that prefixing happens in the same
rewrite pass. Give MDX files explicit `title:` frontmatter, and **prefer relative links**
(`reference/cli/`, not `/reference/cli/`) for anything internal — they resolve correctly under any
`base` because the browser resolves them against the current page's URL. This applies to plain
markdown links as well as any JSX component `href`/`src` props or frontmatter-driven links you
author in the MDX yourself.

## `.astro` pages

Any file a `content` glob matches ending in `.astro` is published verbatim as a real Astro
component — an escape hatch for pages that need more than markdown/MDX can express, and it works
from any `content` entry, not just a `docs/` tree. Each page exports a small contract:

```astro
---
export const layout = "docs"; // "docs" | "raw", defaults to "docs"
export const title = "Component Demo"; // required when layout is "docs"
export const description = "Optional lead/meta text."; // "docs" layout only
---
```

- **`layout: "docs"`** (the default) renders inside the normal chrome — the same `BaseLayout`,
  breadcrumb, pagination, and prose article a synced markdown page gets — and is first-class in
  the sidebar, breadcrumb, pagination, and Pagefind search, exactly like a markdown page. `title`
  is required; a page missing it fails the build, naming the offending route. `description` is
  optional and feeds the same places a markdown page's frontmatter `description` does.
- **`layout: "raw"`** owns its entire `<html>` document — the catch-all route renders it bare,
  with no chrome at all — and is invisible to the sidebar, breadcrumb, pagination, and search. A
  `docs.config.yaml` `sidebar` entry referencing a `raw` page is a config error (see
  [docs.config.yaml](/reference/docs-config-yaml/#sidebar-semantics)).

Known limitations:

- No TOC extraction — `.astro` pages render no on-disk headings, so there's no "on this page"
  column (matches a markdown page with no `##` headings).
- No edit link — there's no single source file to point a `toc.editLink` template at.
- No relative imports between consumer files. Each page is synced standalone into the app's own
  source tree; import shared UI from `@bluecadet/docs/components` (see
  [Import paths](/how-to/build-a-rich-landing-page/#import-paths) — the same barrel MDX pages use)
  and your own components through `@docs-src/` ([below](#consumer-components)).
- Assets referenced from an `.astro` page use the same published-path lookup as any other asset
  (see [Link and asset rewriting](#link-and-asset-rewriting)) — `.astro` files themselves aren't
  rewritten, so reference assets by their published path, not a relative import, and make sure an
  `assets` glob on that entry actually covers them.

## Consumer components

Pages can import components from your own repo — a landing-page table built from data only your
repo has, a diagram assembled from a manifest — through the `@docs-src/` prefix. It resolves
against the directory holding `docs.config.yaml`:

```mdx
import Table from "@docs-src/Table.astro";

<Table />
```

The file does not have to be part of your `content` globs, and should not be: `content` publishes
pages, and a component is not a page. Anything under the config file's directory is importable,
including paths above it (`@docs-src/../Packages/widget/Chart.astro`).

Relative specifiers (`./Table.astro`) cannot work here. Sync *copies* every page into the app —
markdown and MDX into its content collection, `.astro` pages under route-normalized paths — so a
relative import resolves next to the copy, in a directory your file has never been in. (`docs dev`
may appear to resolve one anyway: Vite's dev server falls back to the process's working directory,
which is your repo only because that's where you happened to run the CLI. `docs build` runs from the
app and fails with `Could not resolve './Table.astro'`.)

The component itself is *not* copied — it compiles where it lives, so bare imports inside it
(`@bluecadet/docs/components`) resolve against your own install of this package, exactly as they do
in your MDX. One rule applies if the component reads files at build time:

```astro
---
// Not `new URL("..", import.meta.url)`: the build bundles this component into a chunk inside the
// app, so import.meta.url points at the chunk, not at this file.
const configDir = process.env.DOCS_CONFIG_DIR;
const manifests = fs.globSync("*/package.json", { cwd: path.join(configDir, "..", "packages") });
---
```

`DOCS_CONFIG_DIR` is the absolute path of the directory holding `docs.config.yaml`, set by both
`docs dev` and `docs build`. Anchor every path on it — build-time reads, `execFileSync` `cwd`,
anything else that has to find your repo — and the component behaves identically in dev and in the
build. Read-only, and the same caution as any other build-time read applies: nothing outside `--out`
may be written.

## Terminal transcripts and asciinema playback

`Terminal` (from the component barrel) renders a terminal window that either holds a `<Line>`
transcript or, given a `cast` prop, plays back an asciinema v2 recording with custom controls
matched to the terminal chrome. `TerminalBand` wraps it with the landing page's full-bleed
caption/duration band — see [Build a rich landing page](/how-to/build-a-rich-landing-page/#terminalband)
for the transcript form and prop reference. To use recorded playback instead of a hand-authored
transcript, put the `.cast` file under a `content` entry's `base` and cover it with that entry's
`assets` glob, then pass it by its published path:

```yaml
content:
  - base: docs
    files: "**/*.{md,mdx}"
    assets: "**/*.cast"
```

```mdx
import { TerminalBand } from "@bluecadet/docs/components";

<TerminalBand cwd="~/repos/acme" cast="/build.cast" caption="a full build" duration="3.4s" />
```

A `.cast` file with no `assets` glob covering it isn't published at all — passing its would-be
path to `cast` just points at a 404, silently, since `cast` is a plain string prop the sync step
never inspects.

## Known limitations

- **`base: "."` (the default) keeps the leading path segment in every route.** A glob like
  `"docs/**/*.md"` on the default base publishes at `/docs/reference/cli/`, not `/reference/cli/`
  — set `base: docs` on that entry to strip it.
- **An asset matched by two `content` entries publishes at whichever entry claimed it first**
  (config order). Each asset has exactly one published path; there's no merge or override for a
  second entry that happens to cover the same file.
- **With no `landing` configured, `/` is a meta-refresh redirect to the first sidebar page, not a
  real page** — it carries no content, isn't indexed by search, and briefly flashes a
  "Redirecting…" document before the browser follows it.
- Raw HTML link/image rewriting only handles double-quoted attributes.
- Reference-style links/images that can't be resolved and have no configured `repoUrl` are left
  pointing at their original (broken) relative target, rather than unwrapped to plain text like
  inline links are.
- The theme targets horizontal writing modes only (LTR and RTL); vertical writing modes
  (`writing-mode: vertical-*`) are unsupported.

---
description: Documents every docs.config.yaml field, its type, its default, and its CLI override.
---

# docs.config.yaml schema

Required, at `--config`'s path (`./docs.config.yaml` by default). `title` and `content` are
required; everything else is optional. The file's own directory — not the shell's cwd — is what
every relative path below resolves against.

```yaml
title: My Project
repoUrl: https://github.com/org/my-project
glyph: "»"
accent: "#9cc3a9"
accent2: "#e0a75e"
landing: docs/index.mdx

content:
  - base: docs
    files: "**/*.{md,mdx,astro}"
    assets: "img/**/*"
  - base: packages
    files: "*/README.md"
    route: packages

base: /my-project/
site: https://org.github.io

header:
  links:
    - label: changelog
      href: /changelog/

footer:
  groups:
    - title: Project
      links:
        - label: docs
          href: /
        - label: github
          href: https://github.com/org/my-project
    - title: Related
      links:
        - label: caliper docs
          href: https://docs.caliper.dev
          note: docs.caliper.dev
  meta: MIT licensed · no telemetry

sidebar:
  - label: Tutorials
    items:
      - tutorials/getting-started
  - label: Reference
    items:
      - reference/cli
      - label: Config (renamed)
        link: reference/config/overview
      - label: Config
        items:
          - reference/config/base
          - reference/config/advanced

version: v2.4.1
sidebarMeta: |
  MIT licensed
  no telemetry

toc:
  note: updated for 2.4
  editLink: "https://github.com/org/my-project/edit/main/{path}"
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | *required* | Site title. `--title` can supply it instead of the file. |
| `content` | `ContentEntry[]` | *required, non-empty* | Where the site's pages and assets come from — see [Content entries](#content). |
| `landing` | `string` | — | Path (relative to the config file) of the `.md`/`.mdx` file published at `/`. See [Landing page](#landing-page). |
| `repoUrl` | `string` | `git remote get-url origin`, normalized to `https://host/org/repo` | Used to rewrite links pointing outside the published set to GitHub blob URLs, and for the header's default GitHub link. |
| `glyph` | `string` | — (no glyph) | Character (or short string) rendered before the site title in the header and footer. Also used, together with `accent`, to generate the site's favicon — see [Accent colors](#accent-colors). |
| `accent` | `string` (6-digit hex) | `#9cc3a9` (sage) | The STATE accent — where you are, what succeeded. See [Accent colors](#accent-colors). |
| `accent2` | `string` (6-digit hex) | `#e0a75e` (amber) | The ATTENTION accent — what changed, what's required, what will break. See [Accent colors](#accent-colors). |
| `base` | `string` | `/` | Base path for the deployed site. |
| `site` | `string` | — | Absolute site origin. Also drives canonical URLs, Open Graph meta tags, and sitemap generation — set once every page gets a `<link rel="canonical">`, `og:*` tags, and a `sitemap-index.xml`; left unset, all three are skipped. |
| `header.links` | `{ label, href }[]` | — | Extra links rendered in the header after its fixed "docs" link, replacing the default GitHub link entirely when set — see [Notes](#notes). |
| `footer.groups` | `{ title, links: { label, href, note? }[] }[]` | — | Titled groups of links rendered in the footer, replacing the default "docs"/"github" pair entirely when set — see [Notes](#notes). |
| `footer.meta` | `string` | — | Right-aligned meta string in the footer (e.g. `MIT licensed · no telemetry`), rendered on every page. |
| `sidebar` | `SidebarItem[]` | — | Author-controlled sidebar structure. When present, replaces the default auto-generated (alphabetical, route-mirroring) sidebar — see [Sidebar semantics](#sidebar-semantics). |
| `version` | `string` | — | Version string (e.g. `v2.4.1`), rendered as small mono text in the header and at the bottom of the sidebar. |
| `sidebarMeta` | `string` | — | Multiline string rendered at the bottom of the sidebar, below `version` if both are set. Each non-empty line becomes its own row (e.g. `MIT licensed` / `no telemetry`). |
| `toc.note` | `string` | — | Short note shown in the attention accent color (amber by default) below the desktop "on this page" list (e.g. `updated for 2.4`). |
| `toc.editLink` | `string` | — | URL template for a per-page "edit this page" link, also below the desktop "on this page" list. `{path}` is replaced with the page's source path relative to the config file (e.g. `docs/how-to/foo.md`). Omitted on pages with no on-disk source, and on the mobile/tablet disclosure variant of the TOC. |

## Content

`content` is a list of entries. Each entry is either a bare glob string or an object:

```yaml
content:
  # Sugar for { base: ".", files: "CHANGELOG.md", route: "" }.
  - "CHANGELOG.md"

  # The usual shape: a docs tree published at the site root.
  - base: docs
    files: "**/*.{md,mdx,astro}"
    assets: "img/**/*"

  # A monorepo's package READMEs, published under /packages/*/.
  - base: packages
    files: "*/README.md"
    route: packages

  # Assets-only: no `files`, so no pages come from this entry. Useful for publishing a static
  # file that lives outside the docs tree, e.g. an install script at the repo root.
  - base: ..
    assets: ["install.sh", "install.ps1"]
```

`files` is optional when `assets` is set — an entry can publish only static assets, with no pages
of its own. An entry with neither `files` nor `assets` has nothing to publish and is a config
error.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `base` | `string` | `"."` | Directory the entry's globs are relative to, itself relative to the config file. May climb out with `..` — pointing at a sibling checkout or a package directory outside a docs tree is a first-class use case. Must not be absolute. |
| `files` | `string \| string[]` | *required unless `assets` is set* | Glob(s), relative to `base`, matching the `.md`/`.mdx`/`.astro` files to publish. A single glob can be a bare string. Non-content matches (any other extension) are ignored. An entry with neither `files` nor `assets` is a config error. |
| `route` | `string` | `""` | Route prefix for every page and asset the entry publishes. `""` means the site root. No leading/trailing `/`, no `.`/`..` segments. |
| `assets` | `string \| string[]` | `[]` | Glob(s), relative to `base`, matching non-content files to publish (images, casts, downloads). **Nothing is published implicitly** — an entry with no `assets` publishes no files, which is what makes it safe to point `base` at a directory that also holds source code. `.md`/`.mdx`/`.astro` matches are filtered out automatically, so `assets: "**/*"` is safe. |

**Routes.** A page's route is its path relative to its entry's `base`, prefixed with the entry's
`route`, extension stripped and lowercased. A trailing `index` or `README` segment (case-
insensitive) collapses onto its directory. So with `base: docs`, `docs/reference/cli.md` is
`/reference/cli/` and `docs/reference/index.md` is `/reference/`; with `base: packages,
route: packages`, `packages/widget/README.md` is `/packages/widget/`.

`base` is what gets stripped, not `route` — the bare string `"docs/**/*.md"` (sugar for
`base: "."`) publishes at `/docs/...`, not `/...`. Set `base: docs` to strip that segment.

**Collisions are errors, never silently resolved.** Two files resolving to the same route fails
the build naming both. One file matched by two entries' `files` globs also fails the build naming
both entries — a file can only be published once.

**Assets.** An asset matched by two entries publishes at whichever entry's `assets` glob claimed
it first, in config order — see [Known limitations](#known-limitations) below. A relative asset
reference in a page that no `assets` glob covers is a build warning, not an error; see
[link rewriting](/reference/content-conventions/#link-and-asset-rewriting).

## Landing page

`landing` is optional and points at exactly one `.md`/`.mdx` file, relative to the config file.
That file is published at `/`, regardless of whether any `content` entry would also match it.

- If a `content` glob does also match the landing file, that entry skips it (it's already
  published) and a notice — not a warning or an error — is printed during sync.
- The landing file must exist and end in `.md`/`.mdx`; a typo or a non-markdown path is a build
  error naming the config field and the path it resolved to.
- An `.astro` file can never be the landing page, even if it resolves to `/` some other way (e.g.
  a `route` that happens to be empty) — that's also a build error.
- With no `landing` key at all, there is no `/` page: `/` becomes a meta-refresh redirect to the
  first page in the resolved sidebar. See [Known limitations](#known-limitations).
- A build with zero pages — no `content` glob matched anything and no `landing` — is an error.

## Header/footer links

`header.links` is a list of `{ label, href }` objects, rendered in the header in the order written.

`footer.groups` is a list of titled groups — `{ title, links: { label, href, note? }[] }` — each
rendered as its own labeled column in the footer, in the order written. `title` and `links` are
required on every group (`links` must be non-empty), and `label`/`href` are required on every link.
`note` is optional: a short muted annotation rendered after the link's label, e.g. a sibling
project's domain (`docs.caliper.dev`).

The footer's bottom bar — the row that holds `footer.meta` — is part of the fixed chrome and
renders on every page whether or not `meta` is set. On pages where nothing else occupies that row
(doc pages at any width, and every page below desktop widths), an unset `meta` leaves it as an
empty hairline-bordered strip. If you configure `footer.groups`, set `footer.meta` too.

In both cases, `href` is used exactly as written — it is **not** base-prefixed or rewritten the
way links inside published markdown are (see
[link rewriting](/reference/content-conventions/#link-and-asset-rewriting)). For an internal link
under a non-root `base`, either hardcode the base prefix yourself (e.g. `/my-project/changelog/`)
or use a full absolute URL.

An `href` that's an absolute `http(s)` URL pointing at a different origin than `site` (or any
absolute `http(s)` URL at all, when `site` isn't configured) gets the same "leaves the site" (↗)
treatment as the default GitHub link. Anything else — a root-relative path, a relative path, or an
absolute URL that matches `site`'s origin — renders as a plain in-site link.

Setting `header.links`/`footer.groups` fully replaces that chrome's default content (the GitHub
link in the header, the "docs"/"github" pair in the footer) — there's no way to keep the default and
add to it. Leave the field unset to keep the default. The one exception is the header's leading
"docs" link (pointing at your first doc page): it's fixed, renders on every page, and sits before
whatever `header.links` you configure.

## Sidebar semantics

`sidebar` is a list of items: `SidebarItem[]`, where `SidebarItem` is either a bare content-id
string or an object:

```ts
type SidebarItem = string | SidebarItemObject;
interface SidebarItemObject {
  label?: string;   // explicit display label; falls back to the linked page's title when omitted
  link?: string;    // page id, same ids the bare string form uses
  items?: SidebarItem[];  // presence makes this a group node
}
```

A bare string is sugar for `{ link: string }` — its label is always the linked page's title. An
object needs `link`, `items`, or both:

```yaml
sidebar:
  - reference/cli                          # bare string
  - label: Config (renamed)                # labeled leaf
    link: reference/config/base
  - label: Reference                       # group
    items:
      - reference/config/base
      - reference/config/advanced
```

A page id (in a bare string, or in an object's `link`) is a synced page's content id — the route
with the leading/trailing slashes stripped (a `content` entry with `base: docs` publishing
`docs/reference/config/base.md` gives it the id `reference/config/base`). It may also reference a
`content`-matched `.astro` page with `export const layout = "docs"` (see
[`.astro` pages](/reference/content-conventions/#astro-pages)) — it joins the sidebar exactly like
a markdown page. A `layout: "raw"` astro page can't: it owns its entire document and has nowhere to
sit in the nav, so referencing one in `sidebar` is a build error naming the page.

- **The tree is fully explicit.** There's no merging with the auto-generated tree — once `sidebar`
  is set, it's the entire sidebar, in the exact order written. Nothing is sorted for you.
- **Pages not listed in `sidebar` still build and route.** They just don't appear in the sidebar
  (or in prev/next pagination, which walks the same tree) — this is intended, not a bug, for pages
  you want reachable by direct link only (e.g. a page linked from your landing page but not part of
  the day-to-day nav).
- **A `sidebar` entry referencing a page id with no matching synced content is a hard build
  error** naming the missing id — typo'd or renamed page ids don't fail silently.
- **An object with neither `link` nor `items` is a config error** — it has nothing to render.
- **A group (`items` set) with no `label` and no `link` is a config error** — it has no label
  source for its own heading. Add a `label`, a `link` (whose page title is used as a fallback), or
  both.
- A group's own heading can link to a page via `link`, exactly like a leaf item, e.g.
  `{ label: Config, link: reference/config, items: [...] }`. A group with a `link` behaves like any
  other page for active-state highlighting and pagination.

## Accent colors

Every other color in the site is derived from two source tokens — `accent` (STATE: where you are,
what succeeded) and `accent2` (ATTENTION: what changed, is required, or will break). Layout,
type, and every other color are fixed; `accent`/`accent2` are the one theming hook this package
exposes, so each consumer site can carry its own two-color identity without forking the design.

Leave both unset to use the shared default (sage/amber). Set one or both to a 6-digit hex string
to override — an invalid value (not `#rrggbb`) is a build error naming the field.

When `glyph` is set, it's also rendered on the generated favicon in the site's `accent` color
(falling back to the default sage if `accent` itself is unset). A site with no `glyph` keeps the
package's default generic document-icon favicon instead.

## Notes

- Every scalar field (`title`/`repoUrl`/`base`/`site`) can also be set (or overridden) via a CLI
  flag; flags win over the file — see [CLI](/reference/cli/). `content`/`landing`/`header`/
  `footer`/`sidebar`/`version`/`sidebarMeta`/`toc`/`glyph`/`accent`/`accent2` have no CLI flag
  equivalent; they're config-file only.
- A missing config file is a hard build error naming the path the CLI looked at.
- An invalid or malformed `docs.config.yaml` (not valid YAML, not a YAML mapping at the top level, a
  known field with the wrong type, a required field missing, or an empty `content`) is a hard build
  error naming the file path and the offending field.
- Unknown top-level keys — and unknown keys nested inside a `content` entry, `header`, `footer`, a
  footer group, `toc`, a link object, or a sidebar item — are reported as a console warning (not a
  build error) and otherwise ignored; a typo'd field name won't fail your build, but it also won't
  do anything.
- `repoUrl` normalization handles both SSH (`git@github.com:org/repo.git`) and `.git`-suffixed
  remotes, converting them to a plain `https://github.com/org/repo`.
- If neither `docs.config.yaml` nor `git remote get-url origin` provides a repo URL, out-of-tree
  links (e.g. to `LICENSE` or source files) are unwrapped to plain text instead of becoming GitHub
  blob links, and no GitHub icon appears in the site header (unless `header.links` is set, in which
  case that always wins regardless of `repoUrl`).
- A `docs.config.json` sibling next to a missing `docs.config.yaml` prints a warning to convert it
  to YAML; JSON config files aren't read.

## Known limitations

- **`base: "."` (the default) keeps the leading path segment in every route it produces.** A glob
  like `"docs/**/*.md"` on the default base publishes at `/docs/...`, not `/...` — set `base: docs`
  on that entry to publish at the site root instead.
- **An asset matched by two `content` entries' `assets` globs publishes at whichever entry comes
  first in config order.** There's no merge or override for a second entry that happens to cover
  the same source file.
- **With no `landing` configured, `/` is a meta-refresh redirect to the first sidebar page, not a
  real page.** It carries no content and isn't indexed by search.

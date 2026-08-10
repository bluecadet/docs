---
description: Documents every docs.config.yaml field, its type, its default, and its CLI override.
---

# docs.config.yaml schema

Optional, at the repo root. Every field is optional.

```yaml
title: My Project
repoUrl: https://github.com/org/my-project
content:
  - "packages/*/README.md"
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
| `title` | `string` | README's first `#` heading, else the repo directory name (title-cased) | Site title. |
| `repoUrl` | `string` | `git remote get-url origin`, normalized to `https://host/org/repo` | Used to rewrite links pointing outside the docs tree to GitHub blob URLs, and for the header's default GitHub link. |
| `content` | `string \| string[]` | `[]` | Extra glob patterns (relative to the repo root) to publish alongside `docs/`. Each match is routed the same way as a `docs/` file — its `README`/`index` basename collapses onto its directory. A single glob can be a bare string; it's coerced to a one-element array. |
| `base` | `string` | `/` | Base path for the deployed site. |
| `site` | `string` | — | Absolute site origin. |
| `header.links` | `{ label, href }[]` | — | Extra links rendered in the header after its fixed "docs" link, replacing the default GitHub link entirely when set — see [Notes](#header-footer-links). |
| `footer.groups` | `{ title, links: { label, href, note? }[] }[]` | — | Titled groups of links rendered in the footer, replacing the default "docs"/"github" pair entirely when set — see [Notes](#header-footer-links). |
| `footer.meta` | `string` | — | Right-aligned meta string in the footer (e.g. `MIT licensed · no telemetry`), rendered on every page. |
| `sidebar` | array of groups | — | Author-controlled sidebar structure. When present, replaces the default auto-generated (alphabetical, directory-mirroring) sidebar — see [Sidebar semantics](#sidebar-semantics). |
| `version` | `string` | — | Version string (e.g. `v2.4.1`), rendered as small mono text in the header and at the bottom of the sidebar. |
| `sidebarMeta` | `string` | — | Multiline string rendered at the bottom of the sidebar, below `version` if both are set. Each non-empty line becomes its own row (e.g. `MIT licensed` / `no telemetry`). |
| `toc.note` | `string` | — | Short note shown in the attention accent color (amber by default) below the desktop "on this page" list (e.g. `updated for 2.4`). |
| `toc.editLink` | `string` | — | URL template for a per-page "edit this page" link, also below the desktop "on this page" list. `{path}` is replaced with the page's source path relative to the repo root (e.g. `docs/how-to/foo.md`). Omitted on pages with no on-disk source, and on the mobile/tablet disclosure variant of the TOC. |

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

`sidebar` is a list of groups: `{ label: string, items: (pageId | group)[] }`. Each `pageId` string
is a synced page's content id — the same id a page-not-found suggestion or an unresolved internal
link would reference (a `docs/reference/config/base.md` file's id is `reference/config/base`).
Groups can nest.

A `pageId` may also reference a `docs/**/*.astro` page with `export const layout = "docs"` (see
[`.astro` pages](/reference/content-conventions/#astro-pages)) — it joins the sidebar exactly like
a markdown page. A `layout: "raw"` astro page can't: it owns its entire document and has nowhere
to sit in the nav, so referencing one in `sidebar` is a build error naming the page.

- **The tree is fully explicit.** There's no merging with the auto-generated tree — once `sidebar`
  is set, it's the entire sidebar, in the exact order written. Nothing is sorted for you.
- **Pages not listed in `sidebar` still build and route.** They just don't appear in the sidebar
  (or in prev/next pagination, which walks the same tree) — this is intended, not a bug, for pages
  you want reachable by direct link only (e.g. a page linked from your landing page but not part of
  the day-to-day nav).
- **A `sidebar` entry referencing a page id with no matching synced content is a hard build
  error** naming the missing id — typo'd or renamed page ids don't fail silently.
- Group labels are display-only; a group node itself never has its own route or link; its `items`
  are what render as links.

## Notes

- Every scalar field (`title`/`repoUrl`/`base`/`site`) can also be set (or overridden) via a CLI
  flag; flags win over the file — see [CLI](/reference/cli/).
  `content`/`header`/`footer`/`sidebar`/`version`/`sidebarMeta`/`toc` have no CLI flag equivalent;
  they're config-file only.
- An invalid or malformed `docs.config.yaml` (not valid YAML, not a YAML mapping at the top level, a
  known field with the wrong type, or a `content` array containing a non-string) is a hard build
  error naming the file path and the offending field.
- Unknown top-level keys — and unknown keys nested inside `header`, `footer`, a footer group, `toc`,
  a link object, or a sidebar group — are reported as a console warning (not a build error) and
  otherwise ignored; a typo'd field name won't fail your build, but it also won't do anything.
- `repoUrl` normalization handles both SSH (`git@github.com:org/repo.git`) and `.git`-suffixed
  remotes, converting them to a plain `https://github.com/org/repo`.
- If neither `docs.config.yaml` nor `git remote get-url origin` provides a repo URL, out-of-tree
  links (e.g. to `LICENSE` or source files) are unwrapped to plain text instead of becoming GitHub
  blob links, and no GitHub icon appears in the site header (unless `header.links` is set, in which
  case that always wins regardless of `repoUrl`).

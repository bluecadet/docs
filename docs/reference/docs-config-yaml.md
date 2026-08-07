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
  links:
    - label: docs
      href: /
    - label: github
      href: https://github.com/org/my-project
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
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | README's first `#` heading, else the repo directory name (title-cased) | Site title. |
| `repoUrl` | `string` | `git remote get-url origin`, normalized to `https://host/org/repo` | Used to rewrite links pointing outside the docs tree to GitHub blob URLs, and for the header's default GitHub link. |
| `content` | `string \| string[]` | `[]` | Extra glob patterns (relative to the repo root) to publish alongside `docs/`. Each match is routed the same way as a `docs/` file — its `README`/`index` basename collapses onto its directory. A single glob can be a bare string; it's coerced to a one-element array. |
| `base` | `string` | `/` | Base path for the deployed site. |
| `site` | `string` | — | Absolute site origin. |
| `header.links` | `{ label, href }[]` | — | Extra links rendered in the header after its fixed "docs" link, replacing the default GitHub link entirely when set — see [Notes](#header-footer-links). |
| `footer.links` | `{ label, href }[]` | — | Extra links rendered in the footer, replacing the default "docs"/"github" pair entirely when set. |
| `footer.meta` | `string` | — | Right-aligned meta string in the footer (e.g. `MIT licensed · no telemetry`), rendered on every page. |
| `sidebar` | array of groups | — | Author-controlled sidebar structure. When present, replaces the default auto-generated (alphabetical, directory-mirroring) sidebar — see [Sidebar semantics](#sidebar-semantics). |

## Header/footer links

Both `header.links` and `footer.links` are a list of `{ label, href }` objects, rendered in the
order written. `href` is used exactly as written — it is **not** base-prefixed or rewritten the
way links inside published markdown are (see
[link rewriting](/reference/content-conventions/#link-and-asset-rewriting)). For an internal link
under a non-root `base`, either hardcode the base prefix yourself (e.g. `/my-project/changelog/`)
or use a full absolute URL.

An `href` that's an absolute `http(s)` URL pointing at a different origin than `site` (or any
absolute `http(s)` URL at all, when `site` isn't configured) gets the same "leaves the site" (↗)
treatment as the default GitHub link. Anything else — a root-relative path, a relative path, or an
absolute URL that matches `site`'s origin — renders as a plain in-site link.

Setting `header.links`/`footer.links` fully replaces that chrome's default content (the GitHub
link in the header, the "docs"/"github" pair in the footer) — there's no way to keep the default and
add to it. Leave the field unset to keep the default. The one exception is the header's leading
"docs" link (pointing at your first doc page): it's fixed, renders on every page, and sits before
whatever `header.links` you configure.

## Sidebar semantics

`sidebar` is a list of groups: `{ label: string, items: (pageId | group)[] }`. Each `pageId` string
is a synced page's content id — the same id a page-not-found suggestion or an unresolved internal
link would reference (a `docs/reference/config/base.md` file's id is `reference/config/base`).
Groups can nest.

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
  flag; flags win over the file — see [CLI](/reference/cli/). `content`/`header`/`footer`/`sidebar`
  have no CLI flag equivalent; they're config-file only.
- An invalid or malformed `docs.config.yaml` (not valid YAML, not a YAML mapping at the top level, a
  known field with the wrong type, or a `content` array containing a non-string) is a hard build
  error naming the file path and the offending field.
- Unknown top-level keys — and unknown keys nested inside `header`, `footer`, a link object, or a
  sidebar group — are reported as a console warning (not a build error) and otherwise ignored; a
  typo'd field name won't fail your build, but it also won't do anything.
- `repoUrl` normalization handles both SSH (`git@github.com:org/repo.git`) and `.git`-suffixed
  remotes, converting them to a plain `https://github.com/org/repo`.
- If neither `docs.config.yaml` nor `git remote get-url origin` provides a repo URL, out-of-tree
  links (e.g. to `LICENSE` or source files) are unwrapped to plain text instead of becoming GitHub
  blob links, and no GitHub icon appears in the site header (unless `header.links` is set, in which
  case that always wins regardless of `repoUrl`).

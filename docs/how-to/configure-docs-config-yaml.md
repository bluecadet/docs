---
description: "Covers when and how to add a docs.config.yaml to override the CLI's defaults."
---

# Configure docs.config.yaml

Add an optional `docs.config.yaml` at your repo root when the defaults aren't enough — every field
is optional, and CLI flags always take priority over the file.

```yaml
title: My Project
repoUrl: https://github.com/org/my-project
content:
  - "packages/*/README.md"
base: /my-project/
site: https://org.github.io
```

## When you need this

- **No git remote yet, or a remote that isn't the canonical GitHub repo.** The CLI reads
  `git remote get-url origin` for `repoUrl` by default; set it explicitly if that's missing or
  wrong. `repoUrl` drives both the header's default GitHub link and out-of-tree link rewriting
  (source files, `LICENSE`, etc. become GitHub blob links).
- **Deploying to a GitHub Pages *project* site** (`org.github.io/my-project`, not a user/org root
  site). Set `base` to `/my-project/` so generated links and asset paths carry the prefix.
- **A monorepo** with docs living outside `docs/` (e.g. per-package READMEs). Add glob patterns to
  `content` — see [Include package READMEs from a monorepo](/how-to/include-package-readmes-from-a-monorepo/).
- **A title that shouldn't come from your README's first heading** (or you have no README).
- **Extra links in the header or footer** (a changelog, a status page, a second repo) beyond the
  default GitHub link — set `header.links`/`footer.groups`.
- **Author-controlled sidebar order or grouping** instead of the default alphabetical,
  directory-mirroring tree — set `sidebar`.

## Adding header/footer links

```yaml
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
```

Either field, once set, fully replaces that chrome's default content — `header.links` here means no
more default GitHub icon link, and `footer.groups` means no more default "docs"/"github" pair. See
the [reference](/reference/docs-config-yaml/#header-footer-links) for the external-link (↗)
detection rule and the base-prefixing caveat.

## Writing a custom sidebar

```yaml
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

Each string in `items` is a page's content id (its route without the leading/trailing slashes —
`docs/reference/cli.md` is `reference/cli`). Once `sidebar` is set it's the entire sidebar, in the
order written — nothing is auto-sorted or merged in. Pages you leave out still build and are still
reachable by direct link; they just don't show up in the sidebar or in prev/next pagination. A page
id that doesn't match any synced content fails the build, naming the bad id — see
[sidebar semantics](/reference/docs-config-yaml/#sidebar-semantics) for the full rules.

## Precedence

For every scalar field, the CLI resolves in this order, first match wins:

1. The matching CLI flag (`--title`, `--repo-url`, `--base`, `--site`).
2. The `docs.config.yaml` field.
3. A built-in default — see the [reference](/reference/docs-config-yaml/) for what each field
   falls back to.

`content`, `header`, `footer`, and `sidebar` have no CLI equivalent; they're config-file only.

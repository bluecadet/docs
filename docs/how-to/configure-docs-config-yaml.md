---
description: "Covers when and how to add a docs.config.yaml to override the CLI's defaults."
---

# Configure docs.config.yaml

Every site needs a `docs.config.yaml` at its root — `title` and `content` are required, CLI flags
override the file, and this how-to covers the rest of what it can do.

```yaml
title: My Project
repoUrl: https://github.com/org/my-project
content:
  - base: docs
    files: "**/*.md"
  - base: packages
    files: "*/README.md"
    route: packages
base: /my-project/
site: https://org.github.io
```

## When you need more than the required fields

- **No git remote yet, or a remote that isn't the canonical GitHub repo.** The CLI reads
  `git remote get-url origin` for `repoUrl` by default; set it explicitly if that's missing or
  wrong. `repoUrl` drives both the header's default GitHub link and out-of-tree link rewriting
  (source files, `LICENSE`, etc. become GitHub blob links).
- **Deploying to a GitHub Pages *project* site** (`org.github.io/my-project`, not a user/org root
  site). Set `base` to `/my-project/` so generated links and asset paths carry the prefix.
- **A real landing page instead of the default redirect.** With no `landing:` key, `/` redirects
  to the first sidebar page. Point `landing:` at one `.md`/`.mdx` file to publish it at `/` instead.
- **A monorepo** with docs living outside a single `docs/` tree (e.g. per-package READMEs). Add
  another `content` entry — see
  [Include package READMEs from a monorepo](/how-to/include-package-readmes-from-a-monorepo/).
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
the [reference](/reference/docs-config-yaml/#headerfooter-links) for the external-link (↗)
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

Each string in `items` is a page's content id (its route without the leading/trailing slashes — a
`content` entry with `base: docs` publishes `docs/reference/cli.md` at content id `reference/cli`).
Once `sidebar` is set it's the entire sidebar, in the order written — nothing is auto-sorted or
merged in. Pages you leave out still build and are still reachable by direct link; they just don't
show up in the sidebar or in prev/next pagination. A page id that doesn't match any synced content
fails the build, naming the bad id — see
[sidebar semantics](/reference/docs-config-yaml/#sidebar-semantics) for the full rules.

## Precedence

For every scalar field, the CLI resolves in this order, first match wins:

1. The matching CLI flag (`--title`, `--repo-url`, `--base`, `--site`).
2. The `docs.config.yaml` field.
3. A built-in default — see the [reference](/reference/docs-config-yaml/) for what each field
   falls back to. `title` and `content` have none; both are required.

`content`, `landing`, `header`, `footer`, and `sidebar` have no CLI equivalent; they're config-file
only.

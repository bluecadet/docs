---
description: Turns a bare repo into a built, browsable static site and deploys it through CI.
---

# Add docs to your repo

This tutorial takes a repo with no docs at all to a built, browsable static site, using
`@bluecadet/docs`. No Astro project, no `package.json` changes, no install required.

## 1. Write some markdown

`@bluecadet/docs` reads two things: a root `README.md` (your landing page) and a `docs/` tree
(everything else). If you don't have either yet, start small:

```
my-project/
├── README.md
└── docs/
    ├── tutorials/
    │   └── getting-started.md
    ├── how-to/
    │   └── deploy.md
    ├── reference/
    │   └── config.md
    └── explanation/
        └── design.md
```

The folder names (`tutorials/`, `how-to/`, `reference/`, `explanation/`) are a convention
([Diátaxis](https://diataxis.fr/)), not a requirement — the CLI publishes whatever tree it finds
under `docs/` and builds the sidebar from it automatically.

You don't need frontmatter. Give each file a single `# Heading` at the top; the CLI lifts it into
the page title. A file with no heading falls back to a title-cased version of its filename.

## 2. Build the site

From the repo root, with no install step:

```sh
npx @bluecadet/docs build
```

This writes a static site to `./dist`. Open `dist/index.html` in a browser (or serve the folder)
to see:

- Your README as the landing page at `/`.
- A sidebar generated from your `docs/` folder structure.
- Full-text search over every page (press `/` or click the search field) — see
  [Search](/reference/search/).
- The site's built-in design applied automatically; there's no theme to configure.

Prefer a local dev server instead of a one-shot build?

```sh
npx @bluecadet/docs dev
```

Content is synced once at startup — restart the command after editing markdown to pick up
changes. Search is inert in `dev` (the index only exists after a real build) — see
[Search](/reference/search/).

## 3. Wire it into CI

> **Prerequisite:** enable GitHub Pages on your repo first — Settings → Pages → Build and
> deployment → Source → "GitHub Actions". Without this, the deploy step below fails even if the
> build succeeds.

Once the local build looks right, deploy it from CI instead of building locally. This repo
publishes a reusable `workflow_call` workflow for exactly this — add a caller workflow like:

```yaml
# .github/workflows/docs.yml
name: Docs
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  docs:
    uses: bluecadet/docs/.github/workflows/build-docs.yml@main
```

See that workflow's own inputs for deploy targets and options (e.g. GitHub Pages `base` path).

## Next steps

- Need per-repo settings (a custom title, a monorepo's extra READMEs, a non-root base path, header/
  footer links, a hand-ordered sidebar)? See
  [Configure docs.config.yaml](/how-to/configure-docs-config-yaml/).
- Full flag/behavior reference: [CLI](/reference/cli/) and
  [content conventions](/reference/content-conventions/).

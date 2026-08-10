---
description: Turns a bare repo into a built, browsable static site and deploys it through CI.
---

# Add docs to your repo

This tutorial takes a repo with no docs at all to a built, browsable static site, using
`@bluecadet/docs`. No Astro project, no `package.json` changes required.

## 1. Set up registry access

`@bluecadet/docs` is published to [GitHub Packages](https://github.com/bluecadet/docs/pkgs/npm/docs),
not npmjs.com, so `npx`/`npm install` need a one-time registry mapping and a token before they'll
work — even for a public-facing site build.

Add an `.npmrc` at the repo root:

```
@bluecadet:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

**Local dev:** create a classic GitHub personal access token with the `read:packages` scope, then
export it as `NODE_AUTH_TOKEN` (e.g. in your shell profile). Never commit the token.

**GitHub Actions:** set `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on the install step and
`permissions: packages: read` on the job. For repos other than `bluecadet/docs` itself, the package
must also grant the repo access (package settings → Manage Actions access), or use a PAT stored as
a secret. Repos using the reusable `build-docs.yml` workflow (step 5 below) get the registry wiring
from that workflow but still need `permissions: packages: read` on the calling job.

## 2. Write some markdown

`@bluecadet/docs` publishes exactly what a `docs.config.yaml` tells it to — nothing is discovered
by convention. Start with a `docs/` tree:

```
my-project/
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
([Diátaxis](https://diataxis.fr/)), not a requirement — you'll point a glob at this tree in the
next step and it publishes however it's laid out.

You don't need frontmatter. Give each file a single `# Heading` at the top; the CLI lifts it into
the page title. A file with no heading falls back to a title-cased version of its filename.

## 3. Add a docs.config.yaml

At the repo root, next to (not inside) `docs/`:

```yaml
title: my-project
content:
  - base: docs
    files: "**/*.md"
```

`title` and `content` are the only required keys. `content` lists where pages come from; nothing
under `docs/` publishes without a matching entry here. `base: docs` matters — it's what gets
stripped from each route, so `docs/reference/config.md` becomes `/reference/config/`. Leave `base`
at its default (`.`) and the same file would publish at `/docs/reference/config/` instead.

There's no landing page yet, so `/` will redirect to the first page in the sidebar. Want a real
landing page instead? Point `landing:` at one `.md` or `.mdx` file:

```yaml
landing: docs/index.md
```

A file named by `landing:` that's also matched by a `content` glob is fine — it's simply skipped
where the glob finds it, since it's already published.

See [Configure docs.config.yaml](/how-to/configure-docs-config-yaml/) for everything else this
file can do.

## 4. Build the site

From the repo root:

```sh
npx @bluecadet/docs build
```

This reads `./docs.config.yaml` and writes a static site to `./dist`. Open `dist/index.html` in a
browser (or serve the folder) to see:

- A sidebar generated from your published routes.
- Full-text search over every page (press `/` or click the search field) — see
  [Search](/reference/search/).
- The site's built-in design applied automatically; there's no theme to configure.

Prefer a local dev server instead of a one-shot build?

```sh
npx @bluecadet/docs dev
```

It watches `docs.config.yaml` and every content `base` for changes and re-syncs automatically.
Search is inert in `dev` (the index only exists after a real build) — see
[Search](/reference/search/).

## 5. Wire it into CI

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
  packages: read
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

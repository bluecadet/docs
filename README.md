# bluecadet docs

A reusable docs system: a Starlight theme, a CLI, and a reusable CI workflow that turns a repo's
markdown into a branded static site.

Point it at any repo's `README.md` + `docs/` tree and get a fully-built, branded static site — no
Astro project to maintain, no build config to write, no `package.json` required in the consumer
repo.

## Quick start

From any repo (no install required):

```sh
npx @bluecadet/docs build
```

Reads `README.md` and `docs/` from the current directory and writes a static site to `./dist`. Add
an optional `docs.config.json` at the repo root for a custom title, GitHub URL, deploy base path,
or extra content globs (monorepo package READMEs, etc.). Run it from CI with the reusable
`bluecadet/docs/.github/workflows/build-docs.yml@main` workflow.

See the [full docs](https://bluecadet.github.io/docs/) for a tutorial, how-to guides, and
reference material.

## Packages

| Package | Description |
| --- | --- |
| [`@bluecadet/docs`](./packages/docs) | CLI (`npx @bluecadet/docs build`) that syncs a repo's markdown into a bundled Astro+Starlight app and builds a static site. |
| [`@bluecadet/docs-theme`](./packages/docs-theme) | Starlight plugin bundling bluecadet's "Paper" design tokens, fonts, and landing-page components (`CardGrid`, `PackageCard`). |

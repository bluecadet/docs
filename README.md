# bluecadet docs

A reusable docs system: a CLI and a reusable CI workflow that turns a repo's markdown into a
static Astro site.

Point it at any repo's `README.md` + `docs/` tree and get a fully-built, branded static site — no
Astro project to maintain, no build config to write, no `package.json` required in the consumer
repo.

## Quick start

`@bluecadet/docs` is published to [GitHub Packages](https://github.com/bluecadet/docs/pkgs/npm/docs), not npmjs.com, so it needs a one-time registry setup before the first `npx` call.

### One-time setup

Add an `.npmrc` at your repo root:

```
@bluecadet:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

- **Local dev:** create a classic GitHub personal access token with the `read:packages` scope, then
  export it as `NODE_AUTH_TOKEN` (e.g. in your shell profile). Never commit the token.
- **CI (e.g. Netlify):** set `NODE_AUTH_TOKEN` as a build environment variable, using a classic PAT
  with the `read:packages` scope — CI hosts other than GitHub Actions have no GitHub-issued token
  to substitute, so a PAT is the only option.

From any repo:

```sh
npx @bluecadet/docs build
```

Reads `README.md` and `docs/` from the current directory and writes a static site to `./dist`. Add
an optional `docs.config.yaml` at the repo root for a custom title, GitHub URL, deploy base path,
extra content globs (monorepo package READMEs, etc.), header/footer links, or a hand-ordered
sidebar. Deploy it from CI by pointing the build command at `npx @bluecadet/docs build` and the
publish directory at `dist`.

See the [full docs](https://bluecadet.github.io/docs/) for a tutorial, how-to guides, and
reference material.

## Packages

| Package | Description |
| --- | --- |
| [`@bluecadet/docs`](./packages/docs) | CLI (`npx @bluecadet/docs build`) that syncs a repo's markdown into a bundled Astro app and builds a static site with Pagefind search. |

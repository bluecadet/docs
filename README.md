# bluecadet docs

A reusable docs system: a CLI and a reusable CI workflow that turns a repo's markdown into a
static Astro site.

Point it at any repo's `README.md` + `docs/` tree and get a fully-built, branded static site — no
Astro project to maintain, no build config to write, no `package.json` required in the consumer
repo.

## Quick start

`@bluecadet/docs` is published on [npm](https://www.npmjs.com/package/@bluecadet/docs) — no
registry setup needed.

From any repo:

```sh
npx @bluecadet/docs build
```

Reads `README.md` and `docs/` from the current directory and writes a static site to `./dist`. Add
an optional `docs.config.yaml` at the repo root for a custom title, GitHub URL, extra content globs
(monorepo package READMEs, etc.), header/footer links, and a hand-ordered sidebar. Deploy it from CI
by pointing the build command at `npx @bluecadet/docs build` and the publish directory at `dist`.

See the [full docs](https://bluecadet.github.io/docs/) for a tutorial, how-to guides, and
reference material.

## Packages

| Package | Description |
| --- | --- |
| [`@bluecadet/docs`](./packages/docs) | CLI (`npx @bluecadet/docs build`) that syncs a repo's markdown into a bundled Astro app and builds a static site with Pagefind search. |

## License

Source-available, not open source. `@bluecadet/docs` may only be used to build documentation for
Bluecadet projects, including by contributors to Bluecadet's open source repos. Any other use
requires written permission. See [LICENSE](https://github.com/bluecadet/docs/blob/main/LICENSE).

---
"@bluecadet/docs": major
---

`docs.config.yaml` is now the single source of truth — nothing is discovered by convention.

- `--root <dir>` is replaced by `--config <path>` (default `./docs.config.yaml`). The config file's
  directory, not cwd, anchors every relative path in it and every route the site publishes.
  `--out` now defaults to `<config dir>/dist`.
- `content` is required and non-empty, and gains an object form:
  `{ base, files, route, assets }`. A bare glob string is still accepted as sugar for
  `{ base: ".", files: "<glob>", route: "" }`. There is no implicit `docs/` directory.
- `files` matches `.md`, `.mdx` and `.astro`; `.astro` pages are no longer restricted to a
  hardcoded directory.
- `title` is required (or supplied by `--title`). Deriving it from a `README.md` heading or the
  repo directory name is gone.
- The landing page is explicit and optional via the new `landing:` key. The
  `docs/index.mdx` > `docs/index.md` > `README.md` precedence chain, the `/overview/` displacement
  route, and the "no landing page found" error are gone. With no `landing:`, `/` redirects to the
  first page in the sidebar.
- Assets publish only where an `assets` glob names them, at exactly one path each
  (`<route>/<path relative to base>`). The blind copy of every non-markdown file under `docs/` —
  duplicated at two paths — is gone. A reference to an unpublished asset is a build warning naming
  the page, the file, and the glob to add.
- Two files resolving to the same route, or one file matched by two `content` entries, is a build
  error naming both.

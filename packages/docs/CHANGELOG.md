# @bluecadet/docs

## 1.0.0

### Major Changes

- [`81c278e`](https://github.com/bluecadet/docs/commit/81c278e14bb12b0d36fad23164222932625e0e20) - `docs.config.yaml` is now the single source of truth — nothing is discovered by convention.

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

### Minor Changes

- [`82bf1df`](https://github.com/bluecadet/docs/commit/82bf1dffb07d3c6aa9d00761c78169afb0003980) - New `<Button>` component (`primary`, `secondary` or `ghost`; an `<a>` when given an `href`, a
  `<button>` otherwise) and a `<HeroActions>` wrapper that places buttons in the hero's row beside
  the install chip.

  `<Hero>` no longer renders a "read the quickstart" link of its own, and its `quickstartHref` prop
  is gone — add the link yourself:

  ```mdx
  <HeroActions>
    <Button variant="ghost" href="/tutorials/install/">
      read the quickstart →
    </Button>
  </HeroActions>
  ```

- [`7b5cfec`](https://github.com/bluecadet/docs/commit/7b5cfec95af36ce60aa4d673e3c13c0e9f6c4cd1) - Initial release: `@bluecadet/docs`, a CLI that builds a static Astro docs site (with built-in search) from any repo's colocated markdown with near-zero config.

### Patch Changes

- [`b3ebf35`](https://github.com/bluecadet/docs/commit/b3ebf3545f1c34ac7eec2fa17f90a594768c09e4) - `docs build` no longer writes Astro's own build machinery into the repo it is building. Astro
  derives the directory for the SSR/prerender chunks it emits from `process.cwd()`, not from the
  app's root, so those chunks landed in the consumer's repo — where they both left untracked cruft
  behind and failed to resolve Astro's own dependencies, killing every build with
  `Cannot find package 'piccolore'` before a single page was written. The build now runs with the
  bundled app as its working directory, so `--out` is the only thing a build writes.

- [`b3ebf35`](https://github.com/bluecadet/docs/commit/b3ebf3545f1c34ac7eec2fa17f90a594768c09e4) - Two `assets` globs (in different `content` entries) publishing to the same destination path is now
  a build error naming both source files, instead of the second silently overwriting the first in
  `public/`. When two entries' `assets` glob instead match the _same_ physical file, the first
  entry still wins, but a notice now names the file and both entries.

- [`b3ebf35`](https://github.com/bluecadet/docs/commit/b3ebf3545f1c34ac7eec2fa17f90a594768c09e4) - `content`/`assets` globs no longer sweep up `node_modules`, `.git`, `dist`, `.astro`, `.cache`, or
  any dot-directory — a `docs.config.yaml` living next to its own `package.json` (and thus its own
  `node_modules/`) is a first-class layout, and a broad glob like `"**/*.md"` had no other way to
  avoid publishing every markdown file a dependency ships.

- [`b3ebf35`](https://github.com/bluecadet/docs/commit/b3ebf3545f1c34ac7eec2fa17f90a594768c09e4) - Sidebar config errors now name the config file the site was actually built with (via `--config
other-name.yaml`) instead of always saying "docs.config.yaml".

# @bluecadet/docs

## 1.2.0

### Minor Changes

- [#3](https://github.com/bluecadet/docs/pull/3) [`a2980b0`](https://github.com/bluecadet/docs/commit/a2980b0e90028f38c6bb5ea05e6832f844545545) - Every build now writes LLM-friendly copies of the docs: a Markdown version of each page (`/foo/bar/` → `/foo/bar.md`), an `llms.txt` index in sidebar order, and `llms-full.txt` with every page concatenated. Each doc page links its Markdown copy with `<link rel="alternate" type="text/markdown">`.

- [#3](https://github.com/bluecadet/docs/pull/3) [`22b8bbe`](https://github.com/bluecadet/docs/commit/22b8bbe094bd504c3fe354458ad7de58d30de8eb) - Builds on Netlify now serve a page's Markdown copy to requests that send `Accept: text/markdown`, through a generated edge function. Browsers still get HTML, and builds outside Netlify write nothing extra.

## 1.1.0

### Minor Changes

- [`3d75e50`](https://github.com/bluecadet/docs/commit/3d75e507e46c820087a38a03a1d265b2c19f3b87) - Generate a `robots.txt` on every build

  Written to the output root with permissive crawl rules, plus a `Sitemap:` line naming the sitemap
  index when `site` is set. Sitemap generation itself is unchanged.

- [`de5e745`](https://github.com/bluecadet/docs/commit/de5e745268bbed0c927f679cc841f480e02a135e) - Require `sidebar`, and remove the deployed base path

  `sidebar` in `docs.config.yaml` is now required and must be non-empty. The auto-generated sidebar —
  derived from content ids alphabetically whenever `sidebar` was absent — is gone. Sites that relied
  on it must list their pages explicitly; pages left out of `sidebar` still build and route, they
  just get no sidebar entry.

  The `base:` key and the `--base` flag are removed too. Deploying under a subpath is no longer
  supported: a site builds for the root of wherever it is served.

- [`52dcd20`](https://github.com/bluecadet/docs/commit/52dcd2090fc82e72b3c56f0c0951563562aa5214) - Update asciinema player styles

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

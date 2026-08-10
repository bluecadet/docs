# @bluecadet/docs

Turn any repo's colocated markdown docs into a static [Astro](https://astro.build) site — with
sidebar navigation, a table of contents, and built-in [Pagefind](https://pagefind.app) search.
Works from any repo — Go, C#, Node, whatever — since it only reads markdown; it bundles its own
Astro app and `node_modules`, so consumer repos need no `package.json` at all.

A single `docs.config.yaml` is the whole contract. Nothing is discovered by convention: no
directory name is special, no `README.md` is picked up implicitly, and nothing lands in the site
that the config didn't name. The file's own directory — not your shell's cwd — is what every
relative path in it, and every route the site publishes, resolves against.

## Usage

`@bluecadet/docs` is published to [GitHub Packages](https://github.com/bluecadet/docs/pkgs/npm/docs), not npmjs.com, so a consumer repo needs a one-time registry setup before its first `npx` call.

### One-time setup

Add an `.npmrc` at the consumer repo's root:

```
@bluecadet:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

- **Local dev:** create a classic GitHub personal access token with the `read:packages` scope, then
  export it as `NODE_AUTH_TOKEN` (e.g. in your shell profile). Never commit the token.
- **GitHub Actions:** set `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on the install step and
  `permissions: packages: read` on the job. For repos other than `bluecadet/docs` itself, the
  package must also grant the repo access (package settings → Manage Actions access), or use a PAT
  stored as a secret. Repos using the reusable `build-docs.yml` workflow get the registry wiring
  from that workflow but still need `permissions: packages: read` on the calling job.

From any repo, with a `docs.config.yaml` at its root:

```yaml
title: My Project
content:
  - base: docs
    files: "**/*.md"
```

```sh
npx @bluecadet/docs build
```

This reads `./docs.config.yaml` and writes a static site to `./dist`. Run it from CI (e.g. a
GitHub Actions workflow that deploys `dist/` to GitHub Pages). With no config file, the build
fails and names the path it looked at.

Run a local dev server on the same synced content:

```sh
npx @bluecadet/docs dev
```

### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--config <path>` | `./docs.config.yaml` | Config file to build from. Its directory anchors every relative path in the config and every route the site publishes. |
| `--out <dir>` | `<config dir>/dist` | Build output directory (`build` only). |
| `--site <url>` | — | Absolute site origin, e.g. `https://bluecadet.github.io`. |
| `--base <path>` | `/` | Base path for the deployed site, e.g. `/launchpad/` for a GitHub Pages project site. |
| `--title <title>` | — | Override the configured site title (and satisfy the required `title` if the config omits it). |
| `--repo-url <url>` | — | Override the detected GitHub repo URL (used for out-of-tree link rewriting and the header's GitHub link). |
| `-h, --help` | — | Show usage. |

CLI flags always override `docs.config.yaml`.

## Content

Every page comes from a `content` entry. An entry is either a bare glob string or an object:

```yaml
content:
  # Sugar for { base: ".", files: "CHANGELOG.md", route: "" }.
  - "CHANGELOG.md"

  # The usual shape: a docs tree published at the site root.
  - base: docs
    files: "**/*.{md,mdx,astro}"
    assets: "img/**/*"

  # A monorepo's package READMEs, published under /packages/*/.
  - base: packages
    files: "*/README.md"
    route: packages
    assets: "**/*.png"
```

| Key | Default | Description |
| --- | --- | --- |
| `base` | `"."` | Directory the entry's globs are relative to, itself relative to the config file. May climb out with `..` — pointing at a sibling checkout or a package directory outside the docs tree is a first-class use case. |
| `files` | *required* | Glob(s) matching the `.md`/`.mdx`/`.astro` files to publish. A single glob can be a bare string. |
| `route` | `""` | Route prefix for every page and asset the entry publishes. `""` means the site root. No leading/trailing `/`, no `.`/`..` segments. |
| `assets` | `[]` | Glob(s) matching non-content files to publish (images, casts, downloads). **Nothing is published implicitly** — an entry with no `assets` publishes no files, which is what makes it safe to point `base` at a directory full of source code. |

**Routes.** A page's route is its path relative to its entry's `base`, prefixed with the entry's
`route`, extension stripped and lowercased. A trailing `index` or `README` segment collapses onto
its directory. So with `base: docs`, `docs/reference/cli.md` is `/reference/cli/` and
`docs/reference/index.md` is `/reference/`; with `base: packages` and `route: packages`,
`packages/widget/README.md` is `/packages/widget/`. Note that `base` is what gets stripped, so the
bare string `"docs/**/*.md"` (base `"."`) publishes at `/docs/...`, not `/...`.

**Collisions are errors, never last-wins.** Two files resolving to the same route, or one file
matched by two entries, fails the build naming both — routes are never silently overwritten.

**Landing page.** Optional, via the top-level `landing:` key pointing at one `.md`/`.mdx` file.
It becomes `/`. With no `landing:`, `/` becomes a redirect to the first page in the sidebar, so
there's no dead entry point and no obligation to invent a splash page. If a `content` glob also
matches the landing file, it's skipped there (it's already published) and a notice says so.

**Titles.** Frontmatter is optional everywhere. Without a `title:`, the title is lifted from the
first `# Heading` (and removed from the body, since the layout already renders it). Without a
heading either, the filename is title-cased.

**Sidebar.** Autogenerated from the published route tree (alphabetical) by default, or hand-ordered
via `sidebar` — see below.

## `docs.config.yaml`

Required. `title` and `content` are required; everything else is optional:

```yaml
title: My Project
repoUrl: https://github.com/org/my-project
landing: docs/index.mdx
content:
  - base: docs
    files: "**/*.{md,mdx,astro}"
    assets: "img/**/*"
  - base: packages
    files: "*/README.md"
    route: packages
base: /my-project/
site: https://org.github.io

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
  meta: MIT licensed · no telemetry

sidebar:
  - label: Tutorials
    items:
      - tutorials/getting-started
  - label: Reference
    items:
      - reference/cli
```

| Field | Default | Description |
| --- | --- | --- |
| `title` | *required* | Site title. `--title` can supply it instead. |
| `content` | *required* | Where pages and assets come from — see [Content](#content). Must be non-empty. |
| `landing` | — | Path (relative to the config file) of the `.md`/`.mdx` file published at `/`. Without it, `/` redirects to the first sidebar page. Must exist. |
| `repoUrl` | `git remote get-url origin`, normalized to `https://host/org/repo` | Used to rewrite links pointing outside the published set to GitHub blob URLs, and for the header's default GitHub link. |
| `base` | `/` | Base path for the deployed site. |
| `site` | — | Absolute site origin. |
| `header.links` | — | `{ label, href }[]`. When set, fully replaces the header's default GitHub link; the header's leading "docs" link is fixed and always renders first. `href` isn't base-prefixed — use an absolute URL or hardcode the base for internal links under a non-root `base`. An `http(s)` `href` pointing off the configured `site` origin gets the external-link (↗) affordance. |
| `footer.groups` | — | `{ title, links: { label, href, note? }[] }[]`. When set, fully replaces the footer's default "docs"+"github" pair. Each group is a labeled column; `note` is an optional short muted annotation after a link's label. Same `href`/external-link rules as `header.links`. |
| `footer.meta` | — | Right-aligned meta string in the footer (e.g. `MIT licensed · no telemetry`), rendered on every page. |
| `sidebar` | — | Array of `{ label, items }` groups; `items` are page content ids and/or nested groups, in author order. Replaces the default auto-generated sidebar entirely. Pages left out of `sidebar` still build/route, just without a sidebar entry. A `sidebar` entry naming a page id with no matching content is a build error. |

`title`/`repoUrl`/`landing`/`base`/`site` must be strings if present — a wrong type (e.g.
`base: 5`) is a build error naming the field and the value it got. `footer.groups[].title`/`.links`
and each link's `label`/`href` are required (non-empty) — a missing or empty one is also a build
error. Unknown top-level keys (and unknown keys nested inside a `content` entry, `header`,
`footer`, a footer group, a link, or a sidebar group) are a warning, not an error (a typo shouldn't
fail your build, but it also won't do anything).

## Link and asset rewriting

Every published `.md` file is parsed into a markdown AST (via `unified`/`remark`) and rewritten
during the sync step (see [Limitations](#limitations) for what's out of scope):

- **Relative links to other published docs** (`[x](../how-to/y.md)`) become their site route
  (`/how-to/y/`), preserving any `?query` and/or `#hash` suffix, including reference-style links
  (`[x][ref]` + `[ref]: ../y.md`), and links inside raw HTML (`<a href="...">`, double-quoted only).
- **Relative image/asset references** are rewritten to the single path an `assets` glob published
  the file at (`<route>/<path relative to base>`). Publishing is driven entirely by `assets`, so
  this is a lookup, not a guess — there's exactly one published path per asset. A reference to a
  file no `assets` glob covers is a build **warning** naming the page and the file (plus the glob
  to add); the reference is still rewritten to a `/`-rooted path so the build finishes, leaving one
  visibly broken image rather than a silent one.
- **Relative links pointing outside the published set** (source directories, `LICENSE`,
  `CONTRIBUTING.md`, etc.) become a GitHub blob URL (`{repoUrl}/blob/{branch}/{path}`) when a
  `repoUrl` is known; otherwise the link is unwrapped to plain text (the hyperlink is dropped, the
  link text stays).
- **Hand-authored absolute (`/`-rooted) links and images already present in source markdown** are
  treated as site-root-relative and get the configured base path prefixed too (e.g. `/foo/` →
  `/launchpad/foo/`) — they aren't otherwise validated or resolved against the route map.
- All of the above respect the configured `--base`/`base` — generated links and asset paths are
  prefixed accordingly.

### Title injection

Frontmatter `title:` always wins if present. Otherwise the first `# Heading` in the body is lifted
into the title and stripped from the body (the page layout already renders the title from
frontmatter, so leaving the heading in place would show it twice). If there's no heading, the
filename is title-cased (`install-preflight.md` → "Install Preflight").

### MDX passthrough

`.mdx` files (typically a rich `landing:` page) are copied through untransformed
— no link/asset rewriting, no heading extraction beyond a best-effort regex for the title (so the
content schema's required `title` field is still satisfied). This is deliberate: a full markdown
AST pass doesn't understand JSX or component imports and would corrupt them. One consequence: MDX
gets no base-path prefixing either, since that happens in the same rewrite pass. Give MDX files an
explicit `title:` frontmatter, and **use relative links** (`reference/cli/`, not `/reference/cli/`)
for anything internal — a relative link resolves correctly under any `base` because the browser
resolves it against the current page's URL, whereas an absolute one only happens to work when the
site is deployed at the root base. This applies to plain markdown links as well as any
JSX-component props or frontmatter-driven links you author in the MDX yourself.

## How it works

1. **Sync**: the consumer repo's markdown and assets are copied (not glob-loaded in place) into
   the bundled Astro app's `src/content/docs/` and `public/`, with title injection and link/asset
   rewriting applied along the way. Astro's content `glob()` loader then reads from that synced
   copy.
2. **Build**: `astro build({ root, outDir, cacheDir })` runs programmatically, using this
   package's own `astro` install — the consumer repo needs neither. A Pagefind search index is
   generated over the built output as part of the same build.

Re-syncing happens at the start of every `build` or `dev` invocation.

## Development

```sh
npm run build   # tsc -> dist/
npm test        # vitest, against src/__tests__/**
```

Tests cover the pure logic in `links.ts` (link/image/asset resolution, base prefixing, query/hash
handling, out-of-tree GitHub rewriting, unwrap-to-text), `sync.ts` (route derivation from
`base`/`route`, collisions, landing handling, asset publishing), and `config.ts`
(`docs.config.yaml` validation and resolution).

## Limitations

- **Raw HTML link/image rewriting only handles double-quoted attributes** (`<img src="...">`,
  `<a href="...">`). Single-quoted or unquoted HTML attributes are left as-is.
- **Reference-style links/images that can't be resolved and have no configured `repoUrl`** are
  left pointing at their original (broken) relative target, instead of being unwrapped to plain
  text like inline links are — unwrapping would require rewriting every place that reference is
  used, not just its definition.
- **`.mdx` files get no base-path prefixing** (see [MDX passthrough](#mdx-passthrough) above) —
  use relative links in MDX so they work under any `base`.
- **An asset referenced from two entries with different `route` prefixes resolves to whichever
  entry published it first.** Each asset has exactly one published path; if you need the same file
  at two site paths, reference it by its `/`-rooted path explicitly.
- **`docs dev` watches the directories resolved at startup.** Adding a new content `base` to the
  config restarts the dev server, but a `base` directory that doesn't exist yet when it starts
  isn't watched — restart to pick it up. On Linux, `fs.watch` isn't reliably recursive, so edits in
  subdirectories may need a restart there too.
- **MDX is passed through, not transformed** — see [MDX passthrough](#mdx-passthrough) above.

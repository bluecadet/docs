---
description: Lists every CLI flag for build and dev, their defaults, and when the build hard-errors.
---

# CLI

```sh
npx @bluecadet/docs [build|dev] [options]
```

Installing requires GitHub Packages auth — see
[registry setup](/tutorials/add-docs-to-your-repo/#1-set-up-registry-access).

## Commands

| Command | Description |
| --- | --- |
| `build` (default) | Builds a static site. |
| `dev` | Runs the Astro dev server on synced content. |

## Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--config <path>` | `./docs.config.yaml` | Config file to build from. Its directory (`configDir`) anchors every relative path in the config and every route id the build derives — cwd is never consulted. |
| `--out <dir>` | `<config dir>/dist` | Build output directory (`build` only). |
| `--site <url>` | — | Absolute site origin, e.g. `https://bluecadet.github.io`. |
| `--title <title>` | — | Override the configured site title (also satisfies the required `title` if the config omits it). |
| `--repo-url <url>` | — | Override the detected GitHub repo URL (used for out-of-tree link rewriting and the header's GitHub link). |
| `-h, --help` | — | Show usage. |

CLI flags always override `docs.config.yaml` — see [docs.config.yaml](/reference/docs-config-yaml/).

## Exit behavior

- `docs build` and `docs dev` both re-sync content at every invocation before building/serving (see
  [architecture](/explanation/architecture/) for why it's a copy step, not a glob-load).
- A missing config file is a hard error naming the path the CLI looked at. There is no fallback
  location and nothing is discovered by convention.
- `content` missing or empty in the config is a hard error — a site needs at least one glob to
  publish anything, and `landing` alone isn't enough (an `.astro` landing page is also rejected;
  `landing` must be `.md`/`.mdx`).
- Two source files resolving to the same route, or one file matched by two `content` entries, is a
  hard error naming both — see [content conventions](/reference/content-conventions/#routing).
- Unresolved links are non-fatal: the CLI logs up to 10 examples (deduped) to the console and
  either unwraps them to plain text or leaves them as a GitHub blob URL, depending on whether a
  `repoUrl` is known — see [link rewriting](/reference/content-conventions/#link-and-asset-rewriting).
- An asset referenced from a page but not covered by any `assets` glob is also non-fatal: a warning
  names the page and the asset, and the build finishes with one visibly broken image.
- An invalid `docs.config.yaml` (bad YAML, a known field with the wrong type, a missing required
  field, or an empty `content`) is a hard error naming the field; an unknown top-level key is a
  console warning instead — see [docs.config.yaml](/reference/docs-config-yaml/#notes).

## `docs dev`

Runs Astro's dev server against the same synced copy `build` would produce, then watches the config
file's directory and every `content` entry's `base` (when it resolves outside that directory) for
changes. A content/asset edit triggers a debounced re-sync; Astro's own dev server picks up the
change on top of that. Editing `docs.config.yaml` itself re-resolves the config, re-syncs, and
restarts the Astro dev server so the new config takes effect.

A `base` added to the config after `docs dev` starts isn't watched until the command is restarted —
only the bases resolved at startup are watched. On Linux, recursive `fs.watch` isn't reliable, so
edits in subdirectories may need a restart there too.

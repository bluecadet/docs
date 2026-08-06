---
description: Lists every CLI flag for build and dev, their defaults, and when the build hard-errors.
---

# CLI

```sh
npx @bluecadet/docs [build|dev] [options]
```

## Commands

| Command | Description |
| --- | --- |
| `build` (default) | Builds a static site. |
| `dev` | Runs the Astro dev server on synced content. |

## Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--root <dir>` | cwd | Consumer repo to read docs from. |
| `--out <dir>` | `<root>/dist` | Build output directory (`build` only). |
| `--site <url>` | — | Absolute site origin, e.g. `https://bluecadet.github.io`. |
| `--base <path>` | `/` | Base path for the deployed site, e.g. `/launchpad/` for a GitHub Pages project site. |
| `--title <title>` | — | Override the detected site title. |
| `--repo-url <url>` | — | Override the detected GitHub repo URL (used for out-of-tree link rewriting and the header's GitHub link). |
| `-h, --help` | — | Show usage. |

CLI flags always override `docs.config.json` — see [docs.config.json](/reference/docs-config-json/).

## Exit behavior

- `docs build` and `docs dev` both re-sync the consumer repo's content at every invocation before
  building/serving (see [architecture](/explanation/architecture/) for why it's a copy step, not a
  glob-load).
- A missing landing page (no root `README.md`, no `docs/index.md`, and no `docs/index.mdx`) is a
  hard error: the CLI refuses to build a site with no `/` route. So is having both `docs/index.md`
  and `docs/index.mdx` at once — they're mutually exclusive landing pages, and a route collision
  that survives routing (two files mapping to the same URL) is also a hard error — see
  [content conventions](/reference/content-conventions/#routing).
- Unresolved links are non-fatal: the CLI logs up to 10 examples (deduped) to the console and
  either unwraps them to plain text or leaves them as a GitHub blob URL, depending on whether a
  `repoUrl` is known — see [link rewriting](/reference/content-conventions/#link-and-asset-rewriting).
- An invalid `docs.config.json` (bad JSON, a known field with the wrong type, or a non-string
  `content` entry) is a hard error naming the field; an unknown top-level key is a console warning
  instead — see [docs.config.json](/reference/docs-config-json/#notes).

## `docs dev`

Runs Astro's dev server against the same synced copy `build` would produce. Content is synced
**once, at startup** — editing markdown in the consumer repo while `docs dev` is running does not
trigger a re-sync; restart the command to pick up edits.

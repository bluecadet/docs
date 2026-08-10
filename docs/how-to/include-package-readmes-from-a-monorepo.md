---
description: Publishes per-package README files from a monorepo alongside your docs tree.
---

# Include package READMEs from a monorepo

If your repo has multiple packages, each with its own `README.md`, publish them alongside your
main `docs/` tree with a second `content` entry in `docs.config.yaml`.

```yaml
content:
  - base: docs
    files: "**/*.md"
  - base: packages
    files: "*/README.md"
    route: packages
```

`base: packages` points the entry at the packages directory; `route: packages` prefixes every page
it publishes. A page's route is its path relative to `base`, prefixed with `route`, with a trailing
`README`/`index` basename collapsed onto its containing directory. So `packages/docs/README.md`
publishes at `/packages/docs/` and `packages/other-package/README.md` publishes at
`/packages/other-package/`.

This site does exactly that: the [`@bluecadet/docs` package README](/packages/docs/) is published
with this entry and listed in the sidebar under Reference → Packages.

## Notes

- `files` is required and matched relative to `base`, with the same glob engine as any other
  `content` entry — standard `*`/`**` globbing, no extra syntax.
- `files` matches `.md`, `.mdx` and `.astro`; a glob that also happens to match other file types is
  filtered down to those automatically.
- Each matched file gets the same title/heading/link-rewriting treatment as any other content entry
  (see [content conventions](/reference/content-conventions/)), including relative links back into
  that package's own subtree.
- A package README that references its own images needs an `assets` glob on the same entry (e.g.
  `assets: "*/*.png"`) — nothing under `base` is published as an asset unless a glob names it.
- Link them from your hand-written `docs/` pages once you know their routes, e.g.:

  ```md
  See the [other-package README](/packages/other-package/) for its full API reference.
  ```

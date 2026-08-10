---
"@bluecadet/docs": patch
---

`content`/`assets` globs no longer sweep up `node_modules`, `.git`, `dist`, `.astro`, `.cache`, or
any dot-directory — a `docs.config.yaml` living next to its own `package.json` (and thus its own
`node_modules/`) is a first-class layout, and a broad glob like `"**/*.md"` had no other way to
avoid publishing every markdown file a dependency ships.

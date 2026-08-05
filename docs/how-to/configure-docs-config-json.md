# Configure docs.config.json

Add an optional `docs.config.json` at your repo root when the defaults aren't enough — every field
is optional, and CLI flags always take priority over the file.

```json
{
  "title": "My Project",
  "repoUrl": "https://github.com/org/my-project",
  "content": ["Packages/*/README.md"],
  "base": "/my-project/",
  "site": "https://org.github.io"
}
```

## When you need this

- **No git remote yet, or a remote that isn't the canonical GitHub repo.** The CLI reads
  `git remote get-url origin` for `repoUrl` by default; set it explicitly if that's missing or
  wrong. `repoUrl` drives both the header's GitHub link and out-of-tree link rewriting (source
  files, `LICENSE`, etc. become GitHub blob links).
- **Deploying to a GitHub Pages *project* site** (`org.github.io/my-project`, not a user/org root
  site). Set `base` to `/my-project/` so generated links and asset paths carry the prefix.
- **A monorepo** with docs living outside `docs/` (e.g. per-package READMEs). Add glob patterns to
  `content` — see [Include package READMEs from a monorepo](/how-to/include-package-readmes-from-a-monorepo/).
- **A title that shouldn't come from your README's first heading** (or you have no README).

## Precedence

For every field, the CLI resolves in this order, first match wins:

1. The matching CLI flag (`--title`, `--repo-url`, `--base`, `--site`).
2. The `docs.config.json` field.
3. A built-in default — see the [reference](/reference/docs-config-json/) for what each field
   falls back to.

`content` has no CLI equivalent; it's config-file only.

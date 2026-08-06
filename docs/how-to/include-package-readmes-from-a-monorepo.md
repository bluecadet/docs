# Include package READMEs from a monorepo

If your repo has multiple packages, each with its own `README.md`, publish them alongside your
main `docs/` tree with the `content` field in `docs.config.json`.

```json
{
  "content": ["packages/*/README.md"]
}
```

Every match is treated exactly like a file under `docs/`: its `README`/`index` basename collapses
onto its containing directory's route. So `packages/docs/README.md` publishes at `/packages/docs/`
and `packages/other-package/README.md` publishes at `/packages/other-package/`.

## Notes

- Patterns are resolved relative to the repo root, and matched with the same glob engine used for
  `docs/**/*.{md,mdx}` — standard `*`/`**` globbing, no extra syntax.
- Only `.md`/`.mdx` matches are published; a glob that also happens to match other file types is
  filtered down automatically.
- Each matched file gets the same title/heading/link-rewriting treatment as a `docs/` file (see
  [content conventions](/reference/content-conventions/)), including relative links back into that
  package's own subtree.
- Link them from your hand-written `docs/` pages once you know their routes, e.g.:

  ```md
  See the [other-package README](/packages/other-package/) for its full API reference.
  ```

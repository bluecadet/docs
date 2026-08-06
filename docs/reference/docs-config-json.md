---
description: Documents every docs.config.json field, its type, its default, and its CLI override.
---

# docs.config.json schema

Optional, at the repo root. Every field is optional.

```json
{
  "title": "My Project",
  "repoUrl": "https://github.com/org/my-project",
  "content": ["Packages/*/README.md"],
  "base": "/my-project/",
  "site": "https://org.github.io"
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | README's first `#` heading, else the repo directory name (title-cased) | Site title. |
| `repoUrl` | `string` | `git remote get-url origin`, normalized to `https://host/org/repo` | Used to rewrite links pointing outside the docs tree to GitHub blob URLs, and for the header's GitHub link. |
| `content` | `string \| string[]` | `[]` | Extra glob patterns (relative to the repo root) to publish alongside `docs/`. Each match is routed the same way as a `docs/` file — its `README`/`index` basename collapses onto its directory. A single glob can be a bare string; it's coerced to a one-element array. |
| `base` | `string` | `/` | Base path for the deployed site. |
| `site` | `string` | — | Absolute site origin. |

## Notes

- Every field can also be set (or overridden) via a CLI flag; flags win over the file — see
  [CLI](/reference/cli/).
- `content` has no CLI flag equivalent.
- An invalid or malformed `docs.config.json` (not valid JSON, not a JSON object, a known field with
  the wrong type, or a `content` array containing a non-string) is a hard build error naming the
  file path and the offending field.
- Unknown top-level keys are reported as a console warning (not a build error) and otherwise
  ignored — a typo'd field name won't fail your build, but it also won't do anything.
- `repoUrl` normalization handles both SSH (`git@github.com:org/repo.git`) and `.git`-suffixed
  remotes, converting them to a plain `https://github.com/org/repo`.
- If neither `docs.config.json` nor `git remote get-url origin` provides a repo URL, out-of-tree
  links (e.g. to `LICENSE` or source files) are unwrapped to plain text instead of becoming GitHub
  blob links, and no GitHub icon appears in the site header.

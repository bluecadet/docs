---
description: Details which files get published, how routes and titles are derived, and how links get rewritten.
---

# Content conventions

## What gets published

- Landing page precedence: `docs/index.mdx` > `docs/index.md` > root `README.md`. The
  highest-precedence file present becomes `/`.
- `docs/index.md` and `docs/index.mdx` are mutually exclusive — the build errors if both exist.
- Everything else under `docs/` (any depth, any folder names) is published, one page per
  `.md`/`.mdx` file.
- Extra glob patterns from `docs.config.json`'s `content` field are published the same way — see
  [Include package READMEs from a monorepo](/how-to/include-package-readmes-from-a-monorepo/).
- A repo needs a `README.md` at its root, a `docs/index.md`, or a `docs/index.mdx` to have a
  landing page at all; the build hard-errors if none of the three exist.

## Routing

- `index`/`README` basenames (case-insensitive) collapse onto their parent directory's route:
  `docs/how-to/index.md` → `/how-to/`, `packages/docs/README.md` (via a `content` glob) →
  `/packages/docs/`.
- Routes are lowercased, e.g. `docs/How-To/Deploy.md` → `/how-to/deploy/`.
- If the file that wins `/` displaces another landing candidate (e.g. `docs/index.mdx` beats an
  also-present root `README.md`, or — with no `index.mdx` — `docs/index.md` beats `README.md`),
  the displaced file still gets published, at `/overview/` instead of colliding at `/`. A one-line
  notice is printed during sync when this happens.
- If two files still map to the same route after that (e.g. `docs/how-to.md` and
  `docs/how-to/index.md` both naturally routing to `/how-to/`), the build fails with an error
  naming both files.

## Title derivation

Checked in order, first match wins:

1. Frontmatter `title:`, if present.
2. The first `# Heading` in the body — lifted into the title and stripped from the body (the page
   layout already renders the title from frontmatter, so leaving the heading in place would show
   it twice).
3. The filename, title-cased (`install-preflight.md` → "Install Preflight").

`.mdx` files use the same order, except the heading is left in the body (see
[MDX passthrough](#mdx-passthrough) below) and title extraction is a best-effort regex rather than
a full markdown parse.

## Frontmatter

Two fields are read by the site, both optional:

| Field | Effect |
| --- | --- |
| `title` | The page title. If omitted, derived per [Title derivation](#title-derivation) above. |
| `description` | Rendered as the page's `<meta name="description">`. On `docs/index.mdx` specifically, it's also the landing page's hero lead paragraph, under the `title`-driven headline. |

No other frontmatter fields are read — the content schema is just `{ title, description? }`.

Sidebar navigation and full-text search — see [Search](/reference/search/) — are both generated
from the published file tree, not from frontmatter; there's no separate nav or search config.

## Markdown features

Beyond standard GitHub-flavored markdown, the site renders a few things specially.

### Alerts

GitHub-style alert blockquotes render as designed callouts:

```md
> [!NOTE]
> Neutral, informational.

> [!TIP]
> Neutral, a suggestion.

> [!IMPORTANT]
> Attention — something the reader needs to know.

> [!WARNING]
> Attention — something that could go wrong.

> [!CAUTION]
> Attention — something that will break.
```

`NOTE` and `TIP` render as a neutral callout labeled with the keyword itself. `IMPORTANT`,
`WARNING`, and `CAUTION` all render as a single attention-styled callout labeled "HEADS UP" — the
design system reserves its amber accent for attention (what changed, what's required, what will
break), so all three attention-level keywords share that one treatment rather than three separate
colors. A blockquote without a `[!KEYWORD]` marker renders as a plain quote.

### Code blocks

Fenced code blocks with a language tag (` ```sh `, ` ```ts `, etc.) get a header bar showing that
language and a copy button — no configuration needed, this applies automatically to every fenced
block.

### Tables

Standard markdown tables render in a bordered, horizontally-scrollable container. No extra syntax
required.

## Link and asset rewriting

Every published `.md` file (not `.mdx` — see below) is parsed into a markdown AST and rewritten
during the sync step:

- **Relative links to other published docs** (`[x](../how-to/y.md)`) become their site route
  (`/how-to/y/`), preserving any `?query` and/or `#hash` suffix, including reference-style links
  (`[x][ref]` + `[ref]: ../y.md`), and links inside raw HTML (`<a href="...">`, double-quoted
  attributes only).
- **Relative image/asset references** are copied into the site's `public/` directory and rewritten
  to a `/`-rooted path. Every non-markdown file under `docs/` is published at *both* its
  docs-relative and repo-root-relative path, since the same image is often referenced both ways
  (from a `docs/*.md` page vs. the root `README.md`).
- **Relative links pointing outside the published set** (source directories, `LICENSE`,
  `CONTRIBUTING.md`, etc.) become a GitHub blob URL (`{repoUrl}/blob/{branch}/{path}`) when a
  `repoUrl` is known; otherwise the link is unwrapped to plain text (the hyperlink is dropped, the
  link text stays).
- All of the above respect the configured base path — generated links and asset paths are
  prefixed accordingly.
- Absolute-looking (`/`-rooted) links and images already present in source markdown are treated as
  site-root-relative and get the configured base path prefixed at rewrite time (e.g. `/foo/` →
  `/launchpad/foo/` under `base: "/launchpad/"`) — they are not otherwise validated or resolved.

### MDX passthrough

`.mdx` files (currently: an opt-in `docs/index.mdx` landing page) are copied through
untransformed — no link/asset rewriting, no heading extraction beyond a best-effort regex for the
title. This is deliberate: a full markdown AST pass doesn't understand JSX or component imports
and would corrupt them. One consequence: MDX gets **no base-path prefixing either**, since that
prefixing happens in the same rewrite pass. Give MDX files explicit `title:` frontmatter, and
**prefer relative links** (`reference/cli/`, not `/reference/cli/`) for anything internal —
they resolve correctly under any `base` because the browser resolves them against the current
page's URL. This applies to plain markdown links as well as any JSX component `href`/`src` props
or frontmatter-driven links you author in the MDX yourself.

## Known limitations

- `docs dev` does not watch the consumer repo; content is synced once at startup.
- Raw HTML link/image rewriting only handles double-quoted attributes.
- Reference-style links/images that can't be resolved and have no configured `repoUrl` are left
  pointing at their original (broken) relative target, rather than unwrapped to plain text like
  inline links are.
- Assets outside `docs/` are copied once, at their repo-root-relative path — the
  publish-at-both-paths duplication only applies to files under `docs/`.

# Build a rich landing page

By default, your root `README.md` becomes the landing page (`/`), rendered as plain markdown. For
something closer to a Starlight splash page — hero, call-to-action buttons, card grids — author
`docs/index.mdx` instead.

## Why `docs/index.mdx` and not README.md

`.mdx` files are passed through untransformed: no link/asset rewriting, no automatic title
extraction beyond a best-effort regex. That's deliberate — a full markdown parse doesn't
understand JSX or component imports and would corrupt them. It also means an `.mdx` landing page
needs to do a couple of things a plain README doesn't:

- Give it explicit `title:` frontmatter (don't rely on a bare `# Heading`).
- Use **relative** links to other published pages (`how-to/foo/`, not `docs/how-to/foo.md` and
  not `/how-to/foo/`), since MDX gets no relative-link rewriting *and* no base-path prefixing —
  an absolute (`/`-rooted) link only happens to work when the site is deployed at the root base.
  A relative link resolves correctly under any `base`, because the browser resolves it against the
  current page's URL. This applies equally to plain markdown links, JSX component props like
  `PackageCard`'s `href`, and frontmatter-driven links (`hero.actions[].link`).

Landing page precedence is `docs/index.mdx` > `docs/index.md` > root `README.md`, so `docs/index.mdx`
wins `/` even when a root `README.md` also exists — the README is still published, just moved to
`/overview/` instead of `/`, with a one-line notice printed during the build. `docs/index.md` and
`docs/index.mdx` are mutually exclusive, though: keep only one, or the build errors.

## Using Starlight's splash template

```mdx
---
title: My Project
template: splash
hero:
  tagline: One line describing what this project does.
  actions:
    - text: Get started
      link: tutorials/getting-started/
      icon: right-arrow
      variant: primary
---

Some intro markdown/JSX here.
```

## Using theme components

`@bluecadet/docs-theme` ships a `CardGrid` + `PackageCard` pair for linking out to packages or
sections, with an optional version badge:

```mdx
import CardGrid from "@bluecadet/docs-theme/components/CardGrid.astro";
import PackageCard from "@bluecadet/docs-theme/components/PackageCard.astro";

<CardGrid>
  <PackageCard
    title="@bluecadet/docs"
    description="CLI that builds a branded docs site from your repo's markdown."
    href="reference/cli/"
    version="1.4.0"
  />
</CardGrid>
```

`version` is a plain string prop — the component doesn't fetch or resolve it, so pull it from
your own `package.json` at authoring time (or via a small build-time script if you want it to stay
in sync automatically).

See the full prop tables in [theme components reference](/reference/theme-components/).

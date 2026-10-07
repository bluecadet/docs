---
description: Lists the Markdown copies, llms.txt and llms-full.txt every build writes for LLMs and other text-only readers.
---

# LLM-friendly output

Every `docs build` writes a plain-Markdown version of the site next to the HTML, for LLMs, agents
and anything else that would rather not parse a page's chrome. There is no config for it.

## Files

| Path | Contents |
| --- | --- |
| `<route>.md` | One per doc page: the page's content as Markdown. |
| `/llms.txt` | An index of every page in [llms.txt](https://llmstxt.org) format. |
| `/llms-full.txt` | Every page's Markdown, concatenated in `llms.txt` order. |

All three are written by an `astro:build:done` hook after the HTML exists. `docs dev` writes none
of them.

## Page URLs

A page's Markdown copy sits beside its route, with the trailing slash replaced by `.md`:

| Page | Markdown |
| --- | --- |
| `/reference/cli/` | `/reference/cli.md` |
| `/packages/docs/` | `/packages/docs.md` |

Each doc page also advertises its copy in `<head>`:

```html
<link rel="alternate" type="text/markdown" href="/reference/cli.md">
```

The landing page (`/`), the 404 page and `layout: "raw"` astro pages get no Markdown copy.

## Page Markdown

Each file starts with the page title as an H1, then its `description` as a quote when it has one:

```md
# CLI

> Lists every CLI flag for build and dev, their defaults, and when the build hard-errors.
```

The body is converted from the built HTML, not the source file, so MDX components, `.astro`
pages and rewritten links come out as the reader would see them. In the conversion:

- Code blocks become fenced blocks tagged with their language.
- Callouts become GitHub alerts (`> [!NOTE]`, `> [!WARNING]`, …) with their original keyword.
- Tables stay GFM tables.
- Heading anchors, copy buttons and the "on this page" list are dropped.
- Links keep their HTML routes (`/reference/cli/`), not the `.md` URLs.

## llms.txt

```md
# <site title>

> <landing page description>

## <sidebar group>

- [<page title>](<page>.md): <page description>
```

- The H1 is the site `title`. The summary line is the landing page's `description`, left out when
  there's no landing page or it has no `description`.
- Each root-level sidebar group becomes a `##` section, with its pages in sidebar order. Pages in
  nested groups are listed flat under their root group. Root-level pages outside any group are
  listed under `## Docs`.
- Published pages that aren't in the sidebar are listed last, under `## Optional`, which llms.txt
  readers may skip.
- Links are absolute when [`site`](/reference/docs-config-yaml/) is set and root-relative
  otherwise. The `<link rel="alternate">` URLs follow the same rule.

## Content negotiation on Netlify

When the build runs on Netlify (`NETLIFY=true`, which Netlify sets), it also writes
`.netlify/v1/` into the directory the build was started in, using Netlify's
[Frameworks API](https://docs.netlify.com/build/frameworks/frameworks-api/):

- `edge-functions/docs-markdown.ts` answers requests that send `Accept: text/markdown` with the
  page's `.md` copy, as `Content-Type: text/markdown; charset=utf-8` with `Vary: Accept`. When a
  route has no copy, the request gets the normal HTML instead.
- `config.json` serves every `.md` file as `text/markdown; charset=utf-8`. An existing
  `config.json` there is merged into, not replaced.

```sh
curl -H "Accept: text/markdown" https://docs.example.com/reference/cli/
```

Builds anywhere else don't write `.netlify/`. See
[Markdown content negotiation](/explanation/markdown-negotiation/) for how the routing works.

## Known limitations

- Content that only exists as a component has no text equivalent and is missing from the
  Markdown. An asciinema `<Terminal cast>` playback, for example, comes out empty. A hand-written
  `<Line>` transcript comes out as a code block, but its `label` column loses its padding.
- Content negotiation works only on Netlify. On other hosts, the `.md` URLs work but
  `Accept: text/markdown` still gets HTML.
- HTML responses don't carry `Vary: Accept`, only the Markdown responses do. A shared cache in
  front of Netlify could serve a cached HTML response to a Markdown request.
- When a nested sidebar group has no page of its own, its first page is listed under the group's
  label instead of the page title.

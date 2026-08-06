---
description: Shows how to add hero eyebrows, stat strips, transcripts, and feature blocks to your landing page.
---

# Build a rich landing page

Your site's `/` route is generated from whichever landing source the CLI finds — `docs/index.mdx`,
`docs/index.md`, or your root `README.md`. All three give you a working landing page: a headline, a
lead paragraph, a card per top-level section, and a closing call to action.

To get the fuller treatment — eyebrow chips, a copyable install command, a stat strip, a terminal
transcript, feature pillars — switch the landing source to `docs/index.mdx` and add the pieces you
want. Every piece is optional and independent; skipping one just leaves it out.

> [!NOTE]
> `docs/index.md` and `docs/index.mdx` are mutually exclusive. If you have an `index.md`, rename it
> to `index.mdx` rather than adding a second file.

## Hero pieces go in frontmatter

The hero, footer and closing band render before and after your MDX body, so they're authored as
frontmatter rather than as components:

```mdx
---
title: acme build
description: A build tool for people who would rather not think about build tools.
eyebrows:
  - label: static output
    tone: sage
  - label: no config
    tone: amber
  - label: any repo
    tone: neutral
installCommand: npx acme-build
heroNotes:
  - "↖ the config file is optional. it has four keys."
  - nothing here phones home.
footerMeta: MIT licensed · no telemetry
closingAccent: It really is one command.
---
```

| Field | Type | Renders as |
| --- | --- | --- |
| `eyebrows` | up to 3 `{ label, tone }` | Uppercase mono chips above the headline. `tone` is `sage` (solid), `amber` (outlined) or `neutral` (outlined, default). |
| `installCommand` | string | A `$ …` chip under the lead with a copy button, plus a link through to your first doc page. |
| `heroNotes` | up to 2 strings | Marginalia beside the hero. The first is amber, a second is neutral. |
| `footerMeta` | string | Right-aligned meta line in the landing footer. |
| `closingAccent` | string | An italic amber second clause on the closing call to action. |

`title` and `description` do double duty: they're the hero headline and lead. A `title` containing
a comma-separated clause (`Reproducible builds, without the ceremony.`) splits across two lines,
with the second set in italic sage.

## Body blocks are components

Everything between the hero and the section cards is your MDX body. Import the blocks you want from
the package — the CLI leaves `.mdx` imports untouched, and it can always resolve itself:

```mdx
import StatStrip from "@bluecadet/docs/components/landing/StatStrip.astro";
import Stat from "@bluecadet/docs/components/landing/Stat.astro";
```

Ordinary markdown between the blocks stays at the usual reading measure; the blocks themselves run
edge to edge.

### StatStrip

Four figures reads best — the strip is four-up on desktop and two-up below 1024px.

```mdx
<StatStrip>
  <Stat value="1" label="command to build the whole site" />
  <Stat value="0" label="config files required" />
</StatStrip>
```

`label` may also be given as children (`<Stat value="0">…</Stat>`) when it's long enough to want
its own line in the source.

### Terminal

A transcript of a real run. Lines are `<Line>` elements rather than raw text because MDX parses the
children of a JSX block as markdown, which would collapse the leading whitespace a transcript
depends on:

```mdx
<Terminal cwd="~/repos/acme" caption="a full build" duration="499ms">
  <Line prompt>npx acme-build</Line>
  <Line label="reading">src/ + assets/</Line>
  <Line label="bundling">42 modules <Ok>✓</Ok></Line>
  <Line label="hashing">output → <Warn>7f2a91c</Warn></Line>
  <Line />
  <Line><Ok>done</Ok> · 499ms</Line>
</Terminal>
```

- `<Line prompt>` prefixes a dim `$ `.
- `<Line label="…">` renders a dim, fixed-width first column, so aligned output doesn't depend on
  you counting spaces.
- `<Line />` on its own is a blank spacer row.
- `<Ok>` is sage, `<Warn>` is amber. Use them the way the rest of the site does: sage for state and
  success, amber for what changed or needs attention.

### Features

Three numbered pillars. The numerals are not authored — they're generated, and they alternate
sage/amber/sage, so reordering or adding one never leaves a stale `03` behind. Three-up on desktop,
two-up on tablet, stacked on mobile.

```mdx
<Features>
  <Feature title="Reads what you already wrote">
    Body copy. Plain markdown is fine here.
  </Feature>
  <Feature title="Nothing to maintain">…</Feature>
  <Feature title="One command in CI">…</Feature>
</Features>
```

### WillNotDo

The honest-limitations band. `accent` is a substring of `title` to set in italic amber; it's
ignored if it doesn't appear in the title.

```mdx
<WillNotDo
  title="Things acme will not do"
  accent="will not"
  intro="A short list, kept honest."
>
  <WontItem lead="Manage your infrastructure.">It builds. That is the whole surface.</WontItem>
  <WontItem status="yes" lead="Get out of the way.">That is the pitch.</WontItem>
</WillNotDo>
```

`status` defaults to `no` (a dim ✕). `status="yes"` gives a sage ✓ — useful for the one affirmative
row that closes the list.

## Import paths

| Component | Import from |
| --- | --- |
| `StatStrip`, `Stat` | `@bluecadet/docs/components/landing/StatStrip.astro`, `…/Stat.astro` |
| `Terminal`, `Line`, `Ok`, `Warn` | `@bluecadet/docs/components/landing/Terminal.astro`, `…/Line.astro`, `…/Ok.astro`, `…/Warn.astro` |
| `Features`, `Feature` | `@bluecadet/docs/components/landing/Features.astro`, `…/Feature.astro` |
| `WillNotDo`, `WontItem` | `@bluecadet/docs/components/landing/WillNotDo.astro`, `…/WontItem.astro` |

These are the only components the package exports. Layout, colour and type are fixed — there is no
theming hook, deliberately, so every site built with this tool reads the same way.

## Keep it true

The blocks are shaped for concrete claims: a real command, a real transcript, a real number. A stat
strip of four vague adjectives looks worse than no stat strip. If you don't have the numbers, skip
the block — the page is designed to hold together without any of them.

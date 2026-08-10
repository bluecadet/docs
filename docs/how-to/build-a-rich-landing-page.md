---
description: Shows how to add hero eyebrows, stat strips, transcripts, and feature blocks to your landing page.
---

# Build a rich landing page

Your site's `/` route comes from `landing:` in `docs.config.yaml` — a path to one `.md`/`.mdx`
file. Either extension gives you a working landing page: a headline and a lead paragraph, rendered
from the file's title and description.

Everything else — eyebrow chips, a copyable install command, a stat strip, a terminal transcript,
feature pillars, the section card grid, a closing call to action — is optional, and only available
from an `.mdx` landing file: plain markdown has no way to import a component. Point `landing:` at
an `.mdx` file and add the pieces you want; every piece is independent, so skipping one just leaves
it out.

> [!NOTE]
> With no `landing:` key at all, `/` redirects to the first page in the sidebar instead of showing
> a landing page — see [docs.config.yaml](/reference/docs-config-yaml/#landing).

## Hero pieces go in frontmatter

The hero renders before your MDX body, so its pieces are authored as frontmatter rather than as
components:

```mdx
---
title: acme build
description: A build tool for people who would rather not think about build tools.
eyebrows:
  - label: static output
    tone: state
  - label: no config
    tone: attention
  - label: any repo
    tone: neutral
installCommand: npx acme-build
heroNotes:
  - "↖ the config file is optional. it has four keys."
  - nothing here phones home.
---
```

| Field | Type | Renders as |
| --- | --- | --- |
| `eyebrows` | up to 3 `{ label, tone }` | Uppercase mono chips above the headline. `tone` is `state` (solid, sage by default), `attention` (outlined, amber by default) or `neutral` (outlined, default). |
| `installCommand` | string | A `$ …` chip under the lead with a copy button, plus a link through to your first doc page. |
| `heroNotes` | up to 2 strings | Marginalia beside the hero. The first is the attention accent, a second is neutral. |

The footer's right-aligned meta line (`MIT licensed · no telemetry`) isn't landing frontmatter —
it's `footer.meta` in [`docs.config.yaml`](/reference/docs-config-yaml/), because the footer is
the same on every page.

`title` and `description` do double duty: they're the hero headline and lead. A `title` containing
a comma-separated clause (`Reproducible builds, without the ceremony.`) splits across two lines,
with the second set in italic state accent (sage by default).

## Body blocks are components

Everything after the hero is your MDX body. Import the blocks you want from the package — the CLI
leaves `.mdx` imports untouched, and it can always resolve itself:

```mdx
import { StatStrip, Stat } from "@bluecadet/docs/components";
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

### TerminalBand

A transcript of a real run. Lines are `<Line>` elements rather than raw text because MDX parses the
children of a JSX block as markdown, which would collapse the leading whitespace a transcript
depends on:

```mdx
<TerminalBand cwd="~/repos/acme" caption="a full build" duration="499ms">
  <Line prompt>npx acme-build</Line>
  <Line label="reading">src/ + assets/</Line>
  <Line label="bundling">42 modules <Ok>✓</Ok></Line>
  <Line label="hashing">output → <Warn>7f2a91c</Warn></Line>
  <Line />
  <Line><Ok>done</Ok> · 499ms</Line>
</TerminalBand>
```

- `<Line prompt>` prefixes a dim `$ `.
- `<Line label="…">` renders a dim, fixed-width first column, so aligned output doesn't depend on
  you counting spaces.
- `<Line />` on its own is a blank spacer row.
- `<Ok>` is the state accent, `<Warn>` is the attention accent. Use them the way the rest of the
  site does: state for where you are and what succeeded, attention for what changed or needs
  attention.

`TerminalBand` wraps the plain `Terminal` window (title bar + transcript/cast body, `cast`,
`rows`, `cols`, `poster`, `loop` props) with the band's caption row, padding and width cap.
`Terminal` on its own is also exported for use inside an ordinary doc page's prose body, without
any of that band chrome. For asciinema playback instead of a hand-authored transcript, see
[Terminal transcripts and asciinema playback](/reference/content-conventions/#terminal-transcripts-and-asciinema-playback)
for the `cast` prop and where to put `.cast` files.

### Features

Three numbered pillars. The numerals are not authored — they're generated, and they alternate
state/attention/state, so reordering or adding one never leaves a stale `03` behind. Three-up on
desktop, two-up on tablet, stacked on mobile.

```mdx
<Features>
  <Feature title="Reads what you already wrote">
    Body copy. Plain markdown is fine here.
  </Feature>
  <Feature title="Nothing to maintain">…</Feature>
  <Feature title="One command in CI">…</Feature>
</Features>
```

### GlyphList

A glyph-marked list band — originally shipped as the honest-limitations list, and general enough
for any row-per-item list that wants a leading mark. `accent` is a substring of `title` to set in
italic attention accent; it's ignored if it doesn't appear in the title.

```mdx
<GlyphList
  title="Things acme will not do"
  accent="will not"
  intro="A short list, kept honest."
>
  <GlyphItem lead="Manage your infrastructure.">It builds. That is the whole surface.</GlyphItem>
  <GlyphItem glyph="✓" color="var(--accent)" lead="Get out of the way.">That is the pitch.</GlyphItem>
</GlyphList>
```

Each `<GlyphItem>` defaults to a dim `✕`. Pass `glyph` and `color` to use a different mark and
accent — `glyph="✓" color="var(--accent)"` is the state-accented checkmark useful for the one
affirmative row that closes a list like this.

### CtaCards

A full-bleed link grid. `<CtaCards>` is a pure wrapper — compose it from `<CtaCard>` children,
one per destination you want to highlight. The numeral in front of each card's label is not
authored — it's generated, so reordering or adding a card never leaves a stale `03` behind:

```mdx
<CtaCards>
  <CtaCard label="guides" title="Start here" href="/guides/intro/">
    Zero to docs in five minutes.
  </CtaCard>
  <CtaCard label="reference" title="CLI flags" href="/reference/cli/">
    Every flag, its default, and when the build hard-errors.
  </CtaCard>
</CtaCards>
```

`<CtaCard>` takes `label`, `title` and `href` props; its children are an optional description
shown under the title. A childless `<CtaCards>` renders nothing.

### ClosingCta

A closing call to action: a headline pointing at your first doc section, a "read the docs" button,
and a link to your repo when `repoUrl` is configured. Zero-config, it reads its destinations from
your nav tree and site config on its own — pass just an optional accent clause:

```mdx
<ClosingCta accent="It really is one command." />
```

Both halves can be replaced. A `title` prop swaps out the derived headline, and any `<a>` links
passed as children replace the default buttons — the first is styled as the primary button, the
rest as secondary:

```mdx
<ClosingCta title="Ready when you are." accent="Go.">
  <a href="/tutorials/add-docs-to-your-repo/">get started →</a>
  <a href="https://github.com/acme/acme">github ↗</a>
</ClosingCta>
```

## Import paths

Every component is imported from the same barrel:

```mdx
import {
  StatStrip, Stat,
  TerminalBand, Terminal, Line, Ok, Warn,
  Features, Feature,
  GlyphList, GlyphItem,
  CtaCards, CtaCard,
  ClosingCta,
} from "@bluecadet/docs/components";
```

These are the only components the package exports. Layout, colour and type are fixed — there is no
theming hook, deliberately, so every site built with this tool reads the same way.

## Keep it true

The blocks are shaped for concrete claims: a real command, a real transcript, a real number. A stat
strip of four vague adjectives looks worse than no stat strip. If you don't have the numbers, skip
the block — the page is designed to hold together without any of them.

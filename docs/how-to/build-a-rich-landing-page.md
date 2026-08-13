---
description: Shows how to add hero eyebrows, stat strips, transcripts, and feature blocks to your landing page.
---

# Build a rich landing page

Your site's `/` route comes from `landing:` in `docs.config.yaml` — a path to one `.md`/`.mdx`
file. Either extension gives you a working page — your body content, rendered under the site
header — but the hero, the stat strip, the terminal transcript, feature pillars, the section card
grid, a closing call to action, are all components, and plain markdown has no way to import a
component. Point `landing:` at an `.mdx` file and add the pieces you want; every piece is
independent, so skipping one just leaves it out. Without a hero, a `.md` landing page has no
headline of its own — it starts straight into whatever content you write.

> [!NOTE]
> With no `landing:` key at all, `/` redirects to the first page in the sidebar instead of showing
> a landing page — see [docs.config.yaml](/reference/docs-config-yaml/#landing).

## Frontmatter feeds the page, not the hero

```mdx
---
title: acme build
description: A build tool for people who would rather not think about build tools.
---
```

`title` and `description` set the page's `<title>` tag and its Open Graph meta — nothing on the
page itself. They no longer render the hero; that's `<Hero>`, a body component covered below, and
its `title`/`lead` props are free to read differently than what search engines and link previews
show.

The footer's right-aligned meta line (`MIT licensed · no telemetry`) isn't landing frontmatter
either — it's `footer.meta` in [`docs.config.yaml`](/reference/docs-config-yaml/), because the
footer is the same on every page.

## Body blocks are components

The hero and everything after it is your MDX body, built from components. Import the ones you
want from the package — the CLI leaves `.mdx` imports untouched, and it can always resolve itself:

```mdx
import {
  Hero, HeroEyebrows, HeroEyebrow, HeroInstall, HeroNotes, HeroNote,
  StatStrip, Stat,
} from "@bluecadet/docs/components";
```

Ordinary markdown between the blocks stays at the usual reading measure; the blocks themselves run
edge to edge.

### Hero

Six components, composed together — `<Hero>` renders the headline, lead and "read the
quickstart" link itself; everything inside it is its own component. `<HeroEyebrows>` and
`<HeroNotes>` group their chips/notes into a single region each — Astro gives `<Hero>` no way to
tell several flat `<HeroEyebrow>`/`<HeroNote>` children apart from one, so each group is one child
for `<Hero>` to place, not several it would have to spread out on its own:

```mdx
<Hero lead="A build tool for people who would rather not think about build tools.">
  <Fragment slot="title">acme build</Fragment>
  <HeroEyebrows>
    <HeroEyebrow tone="state">static output</HeroEyebrow>
    <HeroEyebrow tone="attention">no config</HeroEyebrow>
    <HeroEyebrow>any repo</HeroEyebrow>
  </HeroEyebrows>
  <HeroInstall>npx acme-build</HeroInstall>
  <HeroNotes>
    <HeroNote>↖ the config file is optional. it has four keys.</HeroNote>
    <HeroNote>nothing here phones home.</HeroNote>
  </HeroNotes>
</Hero>
```

| Component | Props | Renders as |
| --- | --- | --- |
| `<Hero>` | `lead`, `quickstartHref`; a `title` slot (required) | The headline and lead paragraph. `quickstartHref` targets the "read the quickstart" link, which always renders beside the install chip; it defaults to your first sidebar page. |
| `<HeroEyebrows>` | children | Groups `<HeroEyebrow>` chips into the row above the headline. |
| `<HeroEyebrow>` | `tone`: `state` \| `attention` \| `neutral` (default), label as children | Uppercase mono chips above the headline. `state` is solid (sage by default), `attention` is outlined (amber by default), `neutral` is outlined (default). Up to 3 render; extras are hidden. |
| `<HeroInstall>` | command as children | A `$ …` chip under the lead with a copy button. |
| `<HeroNotes>` | children | Groups `<HeroNote>` marginalia into the column beside the lead paragraph (tablet width up) or the row below it (mobile). |
| `<HeroNote>` | note text as children | One marginalia note. The first renders in the attention accent, a second (max) renders neutral; extras are hidden. |

The `title` slot is plain markup, not a prop, so you write exactly what should render: a `<br />`
for a line break, and an `<em>`/`<i>` around the clause you want set in italic attention accent
(`<Fragment slot="title">Reproducible builds, <br /><em>without the ceremony.</em></Fragment>`) — a
bare title with no `<em>` renders as a single plain line.

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
for any row-per-item list that wants a leading mark. The `title` slot is plain markup; wrap the
clause that carries the point in `<em>`/`<i>` to set it in italic attention accent.

```mdx
<GlyphList intro="A short list, kept honest.">
  <Fragment slot="title">Things acme <em>will not</em> do</Fragment>
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
your nav tree and site config on its own:

```mdx
<ClosingCta />
```

Both halves can be replaced. A `title` slot swaps out the derived headline — write the whole
heading yourself, wrapping any clause you want in italic attention accent with `<em>`/`<i>` — and
any `<a>` links passed as children replace the default buttons, the first styled as the primary
button, the rest as secondary:

```mdx
<ClosingCta>
  <Fragment slot="title">Ready when you are. <em>Go.</em></Fragment>
  <a href="/tutorials/add-docs-to-your-repo/">get started →</a>
  <a href="https://github.com/acme/acme">github ↗</a>
</ClosingCta>
```

## Import paths

Every component is imported from the same barrel:

```mdx
import {
  Hero, HeroEyebrows, HeroEyebrow, HeroInstall, HeroNotes, HeroNote,
  StatStrip, Stat,
  TerminalBand, Terminal, Line, Ok, Warn,
  Features, Feature,
  GlyphList, GlyphItem,
  CtaCards, CtaCard,
  ClosingCta,
} from "@bluecadet/docs/components";
```

These are the only components the package exports. Layout and type are fixed, and colour has
exactly one hook — `accent`/`accent2` in `docs.config.yaml` (see
[docs.config.yaml schema](/reference/docs-config-yaml/#accent-colors)) — deliberately narrow so
every site built with this tool still reads the same way.

## Keep it true

The blocks are shaped for concrete claims: a real command, a real transcript, a real number. A stat
strip of four vague adjectives looks worse than no stat strip. If you don't have the numbers, skip
the block — the page is designed to hold together without any of them.

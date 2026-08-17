---
"@bluecadet/docs": minor
---

New `<Button>` component (`primary`, `secondary` or `ghost`; an `<a>` when given an `href`, a
`<button>` otherwise) and a `<HeroActions>` wrapper that places buttons in the hero's row beside
the install chip.

`<Hero>` no longer renders a "read the quickstart" link of its own, and its `quickstartHref` prop
is gone — add the link yourself:

```mdx
<HeroActions>
  <Button variant="ghost" href="/tutorials/install/">read the quickstart →</Button>
</HeroActions>
```

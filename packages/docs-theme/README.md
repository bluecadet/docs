# @bluecadet/docs-theme

A [Starlight](https://starlight.astro.build) plugin bundling bluecadet's "Paper" design
tokens (warm OKLCH neutrals, terracotta accent, Inter / Instrument Serif / JetBrains Mono),
a small set of component overrides, and landing-page components for `docs/index.mdx` splash
pages.

## Install

```sh
npm install @bluecadet/docs-theme
```

Requires `@astrojs/starlight` `>=0.41.7` as a peer dependency.

## Usage

Add the plugin to your Starlight config:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import docsTheme from "@bluecadet/docs-theme";

export default defineConfig({
  integrations: [
    starlight({
      title: "My Docs",
      plugins: [docsTheme()],
    }),
  ],
});
```

This registers the Paper design tokens and bundled fonts as custom CSS, and — unless you've
already set your own `components.Sidebar` — swaps in a Paper-styled sidebar.

### Fonts

Inter, Instrument Serif, and JetBrains Mono are bundled as regular dependencies (via
[Fontsource](https://fontsource.org)) and self-hosted from `node_modules` through Vite's normal
CSS resolution — there's no CDN and nothing else to configure.

## Components

Landing-page components are exported for use in `docs/index.mdx` splash pages (or anywhere else
in your content). They are not registered automatically — import them where you need them:

```mdx
---
title: My Docs
template: splash
---

import CardGrid from "@bluecadet/docs-theme/components/CardGrid.astro";
import PackageCard from "@bluecadet/docs-theme/components/PackageCard.astro";

<CardGrid>
  <PackageCard
    title="@bluecadet/docs"
    description="CLI that builds a branded docs site from your repo's markdown."
    href="/reference/docs-cli/"
    version="1.4.0"
  />
</CardGrid>
```

### `CardGrid`

A responsive grid for laying out cards.

| Prop             | Type     | Default    | Description                                            |
| ---------------- | -------- | ---------- | ------------------------------------------------------- |
| `minColumnWidth` | `string` | `"16rem"`  | Minimum width of a column before it wraps to a new row. |

### `PackageCard`

A card linking to a package's docs, with an optional version badge. This component does not
fetch version numbers itself — resolving a package's version (from a `package.json`, the npm
registry, etc.) is a consumer concern; pass the resolved string as the `version` prop.

| Prop          | Type     | Default | Description                                             |
| ------------- | -------- | ------- | -------------------------------------------------------- |
| `title`       | `string` | —       | Required. Package or card title.                          |
| `description` | `string` | —       | Short description shown below the title.                  |
| `version`     | `string` | —       | Version string rendered as a badge (e.g. `"1.4.0"`). Omitted if not passed. |
| `href`        | `string` | —       | Required. Link target (also accepts any other `<a>` attribute, e.g. `target`). |

## Known limitations

- Syntax highlighting (Expressive Code) themes are not customized; only page chrome and the
  sidebar are restyled.

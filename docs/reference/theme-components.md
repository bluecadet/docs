# Theme components

`@bluecadet/docs-theme` exports Astro components for use in a `docs/index.mdx` landing page (or
anywhere else in your content). They aren't registered automatically by the plugin — import them
explicitly:

```mdx
import CardGrid from "@bluecadet/docs-theme/components/CardGrid.astro";
import PackageCard from "@bluecadet/docs-theme/components/PackageCard.astro";
```

## `CardGrid`

A responsive grid for laying out cards.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `minColumnWidth` | `string` | `"16rem"` | Minimum width of a column before it wraps to a new row. |

## `PackageCard`

A card linking to a package's docs, with an optional version badge. This component does not fetch
version numbers itself — resolving a package's version (from a `package.json`, the npm registry,
etc.) is a consumer concern; pass the resolved string as the `version` prop.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | — | Required. Package or card title. |
| `description` | `string` | — | Short description shown below the title. |
| `version` | `string` | — | Version string rendered as a badge (e.g. `"1.4.0"`). Omitted if not passed. |
| `href` | `string` | — | Required. Link target (also accepts any other `<a>` attribute, e.g. `target`). |

## Registering the plugin

Theme components are separate from the Starlight plugin itself. The plugin (`docsTheme()`) applies
design tokens, bundled fonts, and a sidebar override — it's registered once, in `astro.config.mjs`:

```js
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

The `@bluecadet/docs` CLI does this wiring for you already, inside its bundled Astro app — you
only interact with theme components directly if you're authoring a `docs/index.mdx` landing page.

## Known limitations

- Syntax highlighting (Expressive Code) themes are not customized; only page chrome and the
  sidebar are restyled.

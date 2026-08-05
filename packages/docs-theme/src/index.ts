import { fileURLToPath } from "node:url";
import type { StarlightPlugin, StarlightUserConfig } from "@astrojs/starlight/types";

/**
 * A Starlight plugin that applies bluecadet's "Paper" design tokens (colors, fonts) and a small
 * set of component overrides to a Starlight site. Bundles its own font files (Inter, Instrument
 * Serif, JetBrains Mono) via Fontsource, so consumers get them with zero configuration.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import starlight from "@astrojs/starlight";
 * import docsTheme from "@bluecadet/docs-theme";
 *
 * export default defineConfig({
 *   integrations: [
 *     starlight({
 *       title: "My Docs",
 *       plugins: [docsTheme()],
 *     }),
 *   ],
 * });
 * ```
 */
export default function docsTheme(): StarlightPlugin {
	return {
		name: "bluecadet-docs-theme",
		hooks: {
			"config:setup"({ config, updateConfig }) {
				const newConfig: Partial<StarlightUserConfig> = {
					customCss: [
						"@bluecadet/docs-theme/styles/fonts.css",
						"@bluecadet/docs-theme/styles/vars.css",
						...(config.customCss ?? []),
					],
					components: {
						...config.components,
					},
				};

				// Respect a user-supplied Sidebar override instead of clobbering it.
				if (!config.components?.Sidebar) {
					newConfig.components = {
						...newConfig.components,
						Sidebar: fileURLToPath(new URL("./overrides/Sidebar.astro", import.meta.url)),
					};
				}

				updateConfig(newConfig);
			},
		},
	};
}

#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "node:util";
import { runBuild } from "./build.js";
import { CONFIG_FILENAME, resolveConfig } from "./config.js";
import { runDev } from "./dev.js";

const USAGE = `Usage: docs [build|dev] [options]

Commands:
  build         Build a static site (default)
  dev           Run the Astro dev server on synced content

Options:
  --config <path>    Config file (default: ./${CONFIG_FILENAME}). Its directory is what every
                     relative path in the config, and every route id, resolves against.
  --out <dir>        Build output directory (default: <config dir>/dist)
  --site <url>       Absolute site origin, e.g. https://bluecadet.github.io
  --base <path>      Base path for the deployed site, e.g. /launchpad/
  --title <title>    Override the configured site title
  --repo-url <url>   Override the detected GitHub repo URL
  -h, --help         Show this help message
`;

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		allowPositionals: true,
		options: {
			config: { type: "string" },
			out: { type: "string" },
			site: { type: "string" },
			base: { type: "string" },
			title: { type: "string" },
			"repo-url": { type: "string" },
			help: { type: "boolean", short: "h" },
		},
	});

	if (values.help) {
		console.log(USAGE);
		return;
	}

	const command = positionals[0] ?? "build";
	if (command !== "build" && command !== "dev") {
		console.error(`Unknown command: ${command}\n`);
		console.error(USAGE);
		process.exitCode = 1;
		return;
	}

	const configPath = path.resolve(process.cwd(), values.config ?? CONFIG_FILENAME);
	const out = path.resolve(
		process.cwd(),
		values.out ?? path.join(path.dirname(configPath), "dist"),
	);

	const overrides = {
		configPath,
		out,
		title: values.title,
		repoUrl: values["repo-url"],
		base: values.base,
		site: values.site,
	};

	if (command === "build") {
		await runBuild(resolveConfig(overrides));
	} else {
		await runDev(overrides);
	}
}

main().catch((err: unknown) => {
	console.error(`[docs] ${err instanceof Error ? err.message : String(err)}`);
	process.exitCode = 1;
});

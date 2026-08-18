import path from "node:path";

/** Normalize a path to forward slashes, so routes and globs compare the same on Windows. */
export function toPosix(p: string): string {
	return p.split(path.sep).join("/");
}

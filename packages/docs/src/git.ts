import { execFileSync } from "node:child_process";

/**
 * Best-effort read of the `origin` remote, normalized to an `https://` GitHub-style URL.
 * Returns `undefined` when there is no git repo, no `origin`, or git isn't installed.
 */
export function getGitRemoteUrl(root: string): string | undefined {
	const raw = tryGit(root, ["remote", "get-url", "origin"]);
	if (!raw) return undefined;
	return normalizeRemoteUrl(raw);
}

/** Best-effort current branch name, falling back to "main". */
export function getGitBranch(root: string): string {
	return tryGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]) ?? "main";
}

function tryGit(root: string, args: string[]): string | undefined {
	try {
		return execFileSync("git", args, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return undefined;
	}
}

/** Converts SSH-style (`git@host:org/repo.git`) or `.git`-suffixed remotes to plain `https://host/org/repo`. */
export function normalizeRemoteUrl(remote: string): string {
	let url = remote.trim();
	const sshMatch = url.match(/^git@([^:]+):(.+)$/);
	if (sshMatch) {
		url = `https://${sshMatch[1]}/${sshMatch[2]}`;
	}
	url = url.replace(/^ssh:\/\/git@/, "https://");
	url = url.replace(/\.git$/, "");
	return url;
}

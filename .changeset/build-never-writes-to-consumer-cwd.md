---
"@bluecadet/docs": patch
---

`docs build` no longer writes Astro's own build machinery into the repo it is building. Astro
derives the directory for the SSR/prerender chunks it emits from `process.cwd()`, not from the
app's root, so those chunks landed in the consumer's repo — where they both left untracked cruft
behind and failed to resolve Astro's own dependencies, killing every build with
`Cannot find package 'piccolore'` before a single page was written. The build now runs with the
bundled app as its working directory, so `--out` is the only thing a build writes.

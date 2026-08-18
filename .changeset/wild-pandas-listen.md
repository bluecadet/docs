---
"@bluecadet/docs": minor
---

Require `sidebar`, and remove the deployed base path

`sidebar` in `docs.config.yaml` is now required and must be non-empty. The auto-generated sidebar —
derived from content ids alphabetically whenever `sidebar` was absent — is gone. Sites that relied
on it must list their pages explicitly; pages left out of `sidebar` still build and route, they
just get no sidebar entry.

The `base:` key and the `--base` flag are removed too. Deploying under a subpath is no longer
supported: a site builds for the root of wherever it is served.

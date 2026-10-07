---
description: Explains how a page URL serves Markdown or HTML on Netlify depending on the Accept header, and why it only works there.
---

# Markdown content negotiation

Every build publishes each page twice: as HTML at its route (`/reference/cli/`) and as Markdown
beside it (`/reference/cli.md`, see [LLM-friendly output](/reference/llm-output/)). A reader that
knows about the `.md` URL can fetch it directly. Content negotiation covers the reader that only has
the page URL: it sends `Accept: text/markdown` to `/reference/cli/` and gets the Markdown back from
that same URL.

## Why it needs an edge function

A static host maps one URL to one file. Serving two representations from one URL means choosing
between them per request, which takes code running in front of the files. On Netlify that's an
edge function, and the build writes one through Netlify's
[Frameworks API](https://docs.netlify.com/build/frameworks/frameworks-api/): files under
`.netlify/v1/` in the build's working directory, which Netlify deploys alongside the published
site with no `netlify.toml` changes.

Other hosts have no equivalent the build can write to, so negotiation is Netlify-only. The `.md`
files themselves are plain static files and work on any host.

## What a request goes through

1. The function's config asks Netlify's router to run it only for requests whose `Accept` header
   contains `text/markdown`, and never for asset paths (`/_astro/*`, `/pagefind/*`, `*.md`,
   `*.txt`, …). Browsers don't send that header, so their requests shouldn't reach it at all.
2. The function maps the path to its Markdown URL (`/reference/cli/` → `/reference/cli.md`) and
   fetches it from the same deploy. `*.md` is excluded from the function's own paths, so that
   fetch goes straight to the static file.
3. If the `.md` exists, the function returns it as `text/markdown; charset=utf-8` with
   `Vary: Accept`. If it doesn't (the landing page, a 404), the function steps aside and the
   request gets whatever the route normally serves.

The function checks the `Accept` header itself too, so a browser still gets HTML if the router's
header match is ever not applied.

## Why only on Netlify builds

The build writes `.netlify/` only when `NETLIFY=true`, which Netlify sets in its build
environment. A local or other-CI build otherwise writes nothing outside `--out`, and an unexpected
`.netlify/` directory in a repo would be clutter at best.

## Caching

Only the Markdown responses say `Vary: Accept`. The HTML responses come straight from Netlify's
static file serving, which the edge function never touches, so they don't. Netlify's own cache
keeps the two apart because the function runs before it, but a separate shared cache in front of
Netlify could hand a cached HTML response to a Markdown request.

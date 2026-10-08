---
"@bluecadet/docs": patch
---

Builds with a `landing:` page now write `/index.md`, so `Accept: text/markdown` requests to `/` on Netlify return the landing page's Markdown copy instead of falling through to HTML. Netlify builds also add a `Link: </llms.txt>; rel="describedby"` response header on `/` so agents can discover the llms.txt index from the homepage without parsing HTML.

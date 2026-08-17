---
"@bluecadet/docs": minor
---

Generate a `robots.txt` on every build

Written to the output root with permissive crawl rules, plus a `Sitemap:` line naming the sitemap
index when `site` is set. Sitemap generation itself is unchanged.

Also fixes the sitemap URL and the no-landing sitemap filter when `base` is configured without a
trailing slash.

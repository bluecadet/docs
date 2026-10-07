---
"@bluecadet/docs": minor
---

Every build now writes LLM-friendly copies of the docs: a Markdown version of each page (`/foo/bar/` → `/foo/bar.md`), an `llms.txt` index in sidebar order, and `llms-full.txt` with every page concatenated. Each doc page links its Markdown copy with `<link rel="alternate" type="text/markdown">`.

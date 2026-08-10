---
"@bluecadet/docs": patch
---

Two `assets` globs (in different `content` entries) publishing to the same destination path is now
a build error naming both source files, instead of the second silently overwriting the first in
`public/`. When two entries' `assets` glob instead match the *same* physical file, the first
entry still wins, but a notice now names the file and both entries.

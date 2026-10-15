---
"@bluecadet/docs": patch
---

Remove the synthetic leading `docs /` link from desktop breadcrumbs. Trails now start with the configured sidebar ancestry, matching the mobile navigation pill's root-free behavior. Ancestor links and real `docs`-named entries are preserved; pages with no ancestors show only their title, without a separator. No configuration changes are required.

---
name: keybase-unused-assets
description: Use when finding or deleting unused image/icon assets in the Keybase client codebase (icons, illustrations, iconfont SVGs).
---

# Keybase Unused Assets

Find and delete PNG icons, illustrations, and iconfont SVGs no longer referenced in any TypeScript source.

## Finding Unused Assets

```bash
./skill/keybase-unused-assets/find-unused-assets.sh
```

Scans all `.ts`/`.tsx` files (excluding generated icon constants) and reports assets whose name — or any prefix of it — isn't referenced. Prefix matching catches dynamically-constructed names like `` `icon-phone-revoke-background-${n}` ``.

Light/dark icon pairs (`icon-foo` / `icon-dark-foo`) are treated as a unit: if either is referenced, both are kept.

## Deleting Unused Assets

Pass asset names (without extension) to the delete script:

```bash
./skill/keybase-unused-assets/delete-unused-assets.sh icon-foo-bar illustration-welcome
```

This removes all variants (`@2x`, `@3x`, etc.) for each name across all asset directories, then runs `yarn update-icon-constants` to regenerate the icon constants files.

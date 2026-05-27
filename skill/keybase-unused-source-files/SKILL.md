---
name: keybase-unused-source-files
description: Use when finding orphaned or unused .tsx source files in the Keybase client codebase that are no longer imported anywhere.
---

# Keybase Unused Source Files

Find `.tsx` files that are no longer imported or required anywhere in `shared/`.

## Finding Orphaned Files

```bash
.claude/skills/keybase-unused-source-files/find-unused-tsx.sh
```

Run from the repo root. Outputs a list of candidates to review.

## What the Script Detects

The script collects all import paths from every `.ts`, `.tsx`, `.js`, and `.mts` file, then checks each `.tsx` file against that list.

**Handled automatically:**
- Static imports: `from './foo'`
- Dynamic imports: `React.lazy(async () => import('./foo'))`
- Side-effect imports: `import './foo'`
- Platform-specific files: `foo.native.tsx` matches both `import './foo'` (bundler-resolved) and `import './foo.native'` (explicit)
- Index files: `chat/index.tsx` matches `import '../chat'` and `import '../chat/index'`

**Not detected:**
- Imports constructed at runtime from variables
- Webpack entry points (excluded by name: `node.desktop.tsx`, `preload.desktop.tsx`, `local-debug.tsx`)
- Files referenced only from config objects not using string literals

## Workflow

1. Run the script and review each listed file
2. Open the file and check its exports — if they're unused the file is dead
3. Delete confirmed orphans and run `yarn lint && yarn tsc` to verify

## Adding New Webpack Entry Points

If the script flags a file that's a Webpack entry, add its basename to `ENTRY_POINTS` in `find-unused-tsx.sh`.

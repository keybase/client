---
name: keybase-style-analysis
description: Use when auditing Keybase client styles for helper opportunities, finding border/padding refactor sites, or discovering new style helper candidates.
---

# Keybase Style Analysis

Extracts and analyzes style objects from all TSX source files. Two phases: extract (slow, produces a persistent JSON snapshot) and analyze (fast, reads the snapshot).

## When to use extract

Re-run extract when:
- The snapshot file doesn't exist yet (`/tmp/keybase-styles.json`)
- You've made significant style changes and want fresh data
- User passes `--fresh`

Skip extract when:
- The snapshot already exists and changes since extraction are minor

## Workflow

### Phase 1: Extract (run from shared/)

```bash
cd /Users/chrisnojima/go/src/github.com/keybase/client/shared
node scripts/analyze-styles.mts extract --output /tmp/keybase-styles.json
```

Takes ~10–30 seconds. Writes structured JSON with one entry per style object (styleSheetCreate, platformStyles, and inline JSX style props).

### Phase 2: Analyze

Full audit — gaps + new candidates:
```bash
cd /Users/chrisnojima/go/src/github.com/keybase/client/shared
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json
```

Border gaps only:
```bash
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json --helper border
```

Raise the minimum count threshold (default 3):
```bash
node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json --min-count 5
```

## Interpreting output

### Gap detection output

Each line shows a file and line number where an existing helper could be used but isn't, plus the suggested replacement call:

```
chat/audio/audio-player.tsx:123 (container)
  → ...Kb.Styles.border(Kb.Styles.globalColors.grey, 1, Kb.Styles.borderRadius)
```

When showing these to the user, group by file and present the top 10–15 highest-value sites. Ask which files they want to migrate first.

### New helper candidates output

Shows clusters of border properties that co-occur frequently:

```
[12x]  borderColor+borderRadius+borderStyle+borderWidth
    borderColor: Kb.Styles.globalColors.black_10 | globalColors.grey
    ...
```

When recommending a new helper, include: what it would be named, its signature, the number of call sites it would clean up, and 2–3 example current usages vs. the proposed call.

## After analysis

- For gap sites: offer to migrate them file-by-file or all at once
- For new helper candidates: present the proposed helper signature and get approval before adding it
- After migrating, run `yarn lint && yarn tsc` from `shared/` to verify

# Design: border() Helper + Style Analysis Skill

**Date:** 2026-05-26  
**Status:** Approved

---

## Overview

Two related deliverables:

1. A `Kb.Styles.border()` helper that encodes the dominant border style pattern (42 occurrences) into a single spreadable call — consistent with the existing `padding()` helper.
2. A style analysis skill + script that extracts style objects from the codebase into a persistent JSON file, then runs pattern-detection and gap-detection analysis against it.

---

## Part 1: `border()` Helper

### Location

`shared/styles/shared.tsx`, alongside the existing `padding()` function.

### Signature

```ts
export const border = (color: string, width = 1, radius?: number, justBottom?: boolean) => ({
  borderColor: color,
  borderStyle: 'solid' as const,
  borderWidth: width,
  ...(radius !== undefined
    ? justBottom
      ? {borderBottomLeftRadius: radius, borderBottomRightRadius: radius}
      : {borderRadius: radius}
    : {}),
})
```

### Parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | required | Border color value |
| `width` | `number` | `1` | Border width in pixels |
| `radius` | `number` | `undefined` | If provided, applies `borderRadius` (or bottom corners if `justBottom`) |
| `justBottom` | `boolean` | `undefined` | When true with `radius`, applies only `borderBottomLeftRadius` + `borderBottomRightRadius` |

### Usage patterns

```ts
// Simple solid border (8x pattern)
...Kb.Styles.border(Kb.Styles.globalColors.black_10)

// With explicit width
...Kb.Styles.border(Kb.Styles.globalColors.blue, 2)

// Full border + radius (42x dominant pattern)
...Kb.Styles.border(Kb.Styles.globalColors.grey, 1, Kb.Styles.borderRadius)

// Bottom-only radius (modal/input bottom-rounding, ~20x pattern)
...Kb.Styles.border(Kb.Styles.globalColors.black_10, 1, Kb.Styles.borderRadius, true)
```

### Export

`border` is exported from `shared/styles/shared.tsx` and re-exported through `shared/styles/index.tsx` (which already re-exports everything from shared). It becomes available as `Kb.Styles.border(...)`.

---

## Part 2: Style Analysis Skill + Script

### Script location

`shared/scripts/analyze-styles.mts`

Per project convention, skill bash logic lives in separate script files, not inline in the skill. The project runs scripts directly with `node` (v25, native TS support via `.mts`), matching the existing `desktop/yarn-helper/index.mts` pattern. No `ts-node` needed.

### Two-phase architecture

Extraction is expensive (reads 196+ TSX files). Analysis is cheap (reads one JSON). Separating them lets you re-run analysis with different flags or in future conversations without re-scanning the codebase.

### Phase 1: Extract

```
cd shared && node scripts/analyze-styles.mts extract [--output /tmp/keybase-styles.json]
```

Scans all `*.tsx` files excluding `node_modules`. Extracts style objects from three sources:

1. **`styleSheetCreate` blocks** — `Kb.Styles.styleSheetCreate(() => ({ name: {...}, ... }))`
2. **`platformStyles` calls** — `Kb.Styles.platformStyles({common: {...}, isElectron: {...}, isMobile: {...}, ...})`
3. **Inline JSX style props** — `style={{...}}` and `style={Kb.Styles.collapseStyles([...])}` on any component

#### Output JSON schema

```json
{
  "version": 1,
  "extractedAt": "<ISO timestamp>",
  "entries": [
    {
      "file": "chat/audio/audio-player.tsx",
      "source": "styleSheetCreate",
      "name": "container",
      "platform": "common",
      "line": 123,
      "props": {
        "borderColor": "Kb.Styles.globalColors.grey",
        "borderRadius": "Kb.Styles.borderRadius",
        "borderStyle": "'solid'",
        "borderWidth": "1"
      }
    }
  ]
}
```

`source` values: `"styleSheetCreate"` | `"platformStyles"` | `"inline"`  
`platform` values: `"common"` | `"isElectron"` | `"isMobile"` | `"isPhone"` | `"isTablet"` | `"isIOS"` | `"isAndroid"` | `null` (for styleSheetCreate/inline)  
`name`: the style key name for named styles, `null` for inline  
`props`: raw string values as they appear in source (not evaluated)

### Phase 2: Analyze

```
cd shared && node scripts/analyze-styles.mts analyze [--input /tmp/keybase-styles.json] [--helper <name>] [--min-count 3]
```

#### Analysis pipeline

1. **Group detection** — for each entry, identify which named property clusters are present. A "group" is a set of style property keys that appear together (e.g., `[borderColor, borderStyle, borderWidth]`).

2. **Frequency counting** — count how many distinct entries contain each group (across all files). Normalize values where possible (e.g., `"1"` = `1`, `"'solid'"` = `solid`).

3. **Gap detection** — for each known helper (currently `border`, `padding`), define the property signature it covers. Flag entries that match the signature but are not already using the helper.

4. **Output — New helper candidates** — clusters appearing `--min-count` or more times that aren't covered by any existing helper. For each: cluster keys, frequency count, most common values, example file:line.

5. **Output — Refactor opportunities** — for each gap: file path, line number, current props, and the equivalent helper call.

#### Known helper signatures (for gap detection)

| Helper | Required props | Optional props |
|---|---|---|
| `border` | `borderColor`, `borderStyle: 'solid'`, `borderWidth` | `borderRadius`, `borderBottomLeftRadius + borderBottomRightRadius` |
| `padding` | `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` | — |

### Skill file

`~/.claude/plugins/.../skills/keybase-style-analysis/SKILL.md`

The skill:
- Tells Claude to run extract first if no input file exists (or if `--fresh` is passed)
- Runs analyze with appropriate flags based on user's question
- Interprets the JSON output and presents findings conversationally
- For refactor opportunities: shows the file:line, the current code, and the replacement call

---

## Data flow

```
TSX files (196+)
      │
      ▼  node scripts/analyze-styles.mts extract
/tmp/keybase-styles.json   ◄── persists across conversations
      │
      ▼  node scripts/analyze-styles.mts analyze [--helper border] [--min-count 3]
stdout: new helper candidates + refactor opportunities
      │
      ▼  skill interprets + presents
Claude: "Found 42 places to use border(). Top file: chat/audio/audio-player.tsx:123"
```

---

## What's out of scope

- Evaluating style values (no TypeScript execution — props stored as raw strings)
- Detecting patterns in `Animated` or `StyleSheet.flatten` calls
- Auto-applying refactors (skill reports findings; user decides what to migrate)

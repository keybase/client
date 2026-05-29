# ClickableBox3 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `ClickableBox` and `ClickableBox2` usages with `ClickableBox3`, a single component that combines Box2's layout prop surface with CB2's click/press handling, eliminating the ubiquitous `<CB><Box2>` nesting pattern.

**Architecture:** `ClickableBox3` is `Box2Props & {onClick?, onLongPress?, hitSlop?}` — `direction` is required (same as Box2). On desktop it calls `box2ClassNames()` (shared helper extracted from Box2) and adds `clickable-box2` for cursor. On mobile it calls `box2SharedProps()` and passes the result to `Pressable`.

**Tech Stack:** React, React Native, TypeScript, existing Box2/CB2 internals in `common-adapters/`

---

## Background: CB1 vs CB2 vs CB3

| | CB1 | CB2 | CB3 |
|---|---|---|---|
| Desktop | `<div>` + JS hover state, underlay overlay | `<div>` + `.clickable-box2` CSS cursor | `<div>` + Box2 CSS classes + `.clickable-box2` |
| Mobile | `TouchableOpacity` / `TouchableWithoutFeedback` | `Pressable` | `Pressable` + Box2 style computation |
| Layout | `display:flex, flexDirection:column` injected by default | none | required via `direction` prop (same as Box2) |
| Props | large (hoverColor, underlayColor, feedback, etc.) | minimal | Box2Props + onClick/onLongPress/hitSlop |

---

## ✅ Done: ClickableBox3 implemented and devices/ migrated

Committed in `3ac6c14b82`. Key points for future reference:
- `ClickableBox3Props = Box2Props & {onClick?, onLongPress?, hitSlop?}` — `direction` required; desktop mouse events (`onMouseDown/Up/Leave/Move/Over/Enter`, `onContextMenu`) are in `Box2Props` and passed through to the `<div>`
- `box2ClassNames()` extracted from Box2 and shared; `box2SharedProps` exported from `box.tsx`
- `devices/` pilot complete: 3 CB2 usages → CB3, inner Box2 wrappers eliminated, `mobileAddHeader` style simplified

---

## Migration Checklist (all remaining files)

Use `migrate-clickable-box` skill for each chunk. Run `yarn lint && yarn tsc` and commit after each directory.

### Pilot
- [x] `shared/devices/` (6 total)

### Round 1 — small
- [x] `shared/git/` (3)
- [x] `shared/incoming-share/` (2)
- [x] `shared/signup/` (2)
- [x] `shared/provision/` (4)
- [x] `shared/people/` (2)
- [x] `shared/settings/` (4)
- [x] `shared/profile/` (10)

### Round 2 — medium
- [x] `shared/tracker/` (4)
- [x] `shared/menubar/` (3)
- [x] `shared/app/` (4)
- [x] `shared/router-v2/` (9)
- [x] `shared/teams/` (25+)
- [ ] `shared/team-building/` (9+)

### Round 3 — large
- [ ] `shared/fs/` (10+)
- [ ] `shared/chat/` (60+)

### Last — shared primitives
- [ ] `shared/common-adapters/` (26)

### Completion criteria
- [ ] `grep -rn "ClickableBox[^3]" shared/ | grep -v "clickable-box\|Props\|import\|export"` → zero results
- [ ] `yarn lint && yarn tsc` — zero errors
- [ ] Remove `ClickableBox` default export, `ClickableBox2`, `Props`, `Props2` from `clickable-box.tsx`

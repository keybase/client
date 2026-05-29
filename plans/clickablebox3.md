# ClickableBox3 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `ClickableBox` and `ClickableBox2` usages with `ClickableBox3`, a single component that combines Box2's layout prop surface with CB2's click/press handling, eliminating the ubiquitous `<CB><Box2>` nesting pattern.

**Architecture:** `ClickableBox3` accepts all `Box2Props` (with `direction` optional) plus click props (`onClick`, `onLongPress`, `hitSlop`). On desktop it reuses Box2's CSS class system and adds `clickable-box2` for cursor. On mobile it uses `box2SharedProps` to compute style and passes it to `Pressable`. When `direction` is omitted, no flex layout is applied and CB3 behaves like CB2.

**Tech Stack:** React, React Native, TypeScript, existing Box2/CB2 internals in `common-adapters/`

---

## Background: CB1 vs CB2 vs CB3

| | CB1 | CB2 | CB3 |
|---|---|---|---|
| Desktop | `<div>` + JS hover state, underlay overlay | `<div>` + `.clickable-box2` CSS cursor | `<div>` + Box2 CSS classes + `.clickable-box2` |
| Mobile | `TouchableOpacity` / `TouchableWithoutFeedback` | `Pressable` | `Pressable` + Box2 style computation |
| Layout | `display:flex, flexDirection:column` injected by default | none | optional via `direction` prop |
| Props | large (hoverColor, underlayColor, feedback, etc.) | minimal | Box2Props + onClick/onLongPress/hitSlop |

---

## Task 1: Implement ClickableBox3

**Files:**
- Modify: `shared/common-adapters/box.tsx` — export `box2SharedProps`
- Modify: `shared/common-adapters/clickable-box.tsx` — add `CB3Props` + `ClickableBox3`
- Modify: `shared/common-adapters/index.tsx` — export `ClickableBox3`

- [ ] In `shared/common-adapters/box.tsx`, change `const box2SharedProps` to `export const box2SharedProps`.

- [ ] Add `CB3Props` type to `clickable-box.tsx` (after `Props2`):

```tsx
type CB3Props = {
  direction?: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  alignSelf?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  centerChildren?: boolean
  flex?: number
  fullHeight?: boolean
  fullWidth?: boolean
  justifyContent?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  noShrink?: boolean
  overflow?: 'hidden' | 'scroll' | 'visible' | 'auto'
  padding?: keyof typeof Styles.globalMargins
  relative?: boolean
  gap?: keyof typeof Styles.globalMargins
  gapStart?: boolean
  gapEnd?: boolean
  onClick?: () => void
  onLongPress?: () => void
  onMouseOver?: (event: React.MouseEvent) => void
  hitSlop?: number
  children?: React.ReactNode
  className?: string
  style?: Styles.StylesCrossPlatform
  testID?: string
}
```

- [ ] Add import of `box2SharedProps` at top of `clickable-box.tsx`:

```tsx
import {box2SharedProps} from './box'
```

- [ ] Add `ClickableBox3` component after `ClickableBox2` in `clickable-box.tsx`:

```tsx
export const ClickableBox3 = (p: CB3Props & {ref?: React.Ref<MeasureRef | null>}) => {
  const {
    onClick, onMouseOver, onLongPress, hitSlop,
    direction, alignItems, alignSelf, centerChildren, flex,
    fullHeight, fullWidth, justifyContent, noShrink,
    overflow, padding, relative, gap, gapStart, gapEnd,
    children, className, style, testID, ref,
  } = p

  if (!isMobile) {
    const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
    const reverse = direction === 'verticalReverse' || direction === 'horizontalReverse'
    const cn = Styles.classNames(
      'clickable-box2',
      {
        [`box2_alignItems_${alignItems ?? ''}`]: alignItems,
        [`box2_alignSelf_${alignSelf ?? ''}`]: alignSelf,
        [`box2_gapEnd_${gap ?? ''}`]: gapEnd,
        [`box2_gapStart_${gap ?? ''}`]: gapStart,
        [`box2_gap_${gap ?? ''}`]: gap,
        [`box2_justifyContent_${justifyContent ?? ''}`]: justifyContent,
        [`box2_overflow_${overflow ?? ''}`]: overflow,
        [`box2_padding_${padding ?? ''}`]: padding,
        box2_centered: !!direction && !fullHeight && !fullWidth,
        box2_centeredChildren: centerChildren,
        box2_flex1: flex === 1,
        box2_fullHeight: fullHeight,
        box2_fullWidth: fullWidth,
        box2_horizontal: !!direction && horizontal,
        box2_no_shrink: noShrink,
        box2_relative: relative,
        box2_reverse: !!direction && reverse,
        box2_vertical: !!direction && !horizontal,
      },
      className
    )
    const s = Styles.collapseStyles([flex != null && flex !== 1 ? {flex} : undefined, style]) as React.CSSProperties
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn}
        onClick={onClick}
        onMouseOver={onMouseOver}
        style={s}
        data-testid={testID}
      >
        {children}
      </div>
    )
  }

  if (direction) {
    const {style: s, children: c} = box2SharedProps({
      direction, alignItems, alignSelf, centerChildren, flex,
      fullHeight, fullWidth, justifyContent, noShrink,
      overflow, padding, relative, gap, gapStart, gapEnd,
      style, children,
    })
    return (
      <Pressable
        ref={ref as React.Ref<View>}
        onPress={onClick ? () => { onClick() } : undefined}
        onLongPress={onLongPress}
        style={s}
        hitSlop={hitSlop}
        testID={testID}
      >
        {c}
      </Pressable>
    )
  }
  return (
    <Pressable
      ref={ref as React.Ref<View>}
      onPress={onClick ? () => { onClick() } : undefined}
      onLongPress={onLongPress}
      style={style}
      hitSlop={hitSlop}
      testID={testID}
    >
      {children}
    </Pressable>
  )
}
```

- [ ] Export from `shared/common-adapters/index.tsx`:
```tsx
export {default as ClickableBox, ClickableBox2, ClickableBox3} from './clickable-box'
```

- [ ] From `shared/`, run: `yarn lint && yarn tsc` — expect no new errors.

- [ ] Commit:
```
git commit -m "common-adapters: add ClickableBox3 (clickable Box2)"
```

---

## Task 2: Update migrate-clickable-box skill

**Files:**
- Modify: `.claude/skills/migrate-clickable-box/SKILL.md`

- [ ] Update to target CB3 instead of CB2
- [ ] Add "eliminate inner Box2" pattern as a key migration step
- [ ] Update style cleanup section (CB3 with `direction` provides its own flex; remove flexBoxRow/flexBoxColumn spreads from styles)
- [ ] Update checklist reference to `plans/clickablebox3.md`

---

## Task 3: Migrate devices/ (pilot)

**Files:**
- Modify: `shared/devices/add-device.tsx`
- Modify: `shared/devices/index.tsx`

### add-device.tsx — DeviceOption

Before:
```tsx
<Kb.ClickableBox2 onClick={onClick}>
  <Kb.Box2
    className="hover_background_color_blueLighter2"
    style={Kb.Styles.collapseStyles([styles.deviceOption, isMobile && highlight && styles.deviceOptionHighlighted])}
    direction="vertical"
    centerChildren={true}
    gap="xtiny"
    gapEnd={!isMobile}
  >
    ...content...
  </Kb.Box2>
</Kb.ClickableBox2>
```

After:
```tsx
<Kb.ClickableBox3
  onClick={onClick}
  className="hover_background_color_blueLighter2"
  style={Kb.Styles.collapseStyles([styles.deviceOption, isMobile && highlight && styles.deviceOptionHighlighted])}
  direction="vertical"
  centerChildren={true}
  gap="xtiny"
  gapEnd={!isMobile}
>
  ...content...
</Kb.ClickableBox3>
```

### index.tsx — mobileAddHeader

Before:
```tsx
<Kb.ClickableBox2 onClick={() => onAddDevice()} style={styles.mobileAddHeader}>
  ...
</Kb.ClickableBox2>
```
```tsx
mobileAddHeader: {
  ...Kb.Styles.globalStyles.flexBoxRow,
  ...Kb.Styles.centered(),
  height: isMobile ? 64 : 48,
  ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
  position: 'relative',
},
```

After:
```tsx
<Kb.ClickableBox3
  onClick={() => onAddDevice()}
  direction="horizontal"
  centerChildren={true}
  relative={true}
  style={styles.mobileAddHeader}
>
  ...
</Kb.ClickableBox3>
```
```tsx
mobileAddHeader: {
  height: isMobile ? 64 : 48,
  ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
},
```

### index.tsx — PaperKeyNudge

Before:
```tsx
<Kb.ClickableBox2 onClick={onAddDevice}>
  <Kb.Box2 direction="horizontal" style={styles.paperKeyNudgeContainer} fullWidth={true}>
    ...
  </Kb.Box2>
</Kb.ClickableBox2>
```

After:
```tsx
<Kb.ClickableBox3 onClick={onAddDevice} direction="horizontal" style={styles.paperKeyNudgeContainer} fullWidth={true}>
  ...
</Kb.ClickableBox3>
```

- [x] Apply all three changes
- [x] Run `yarn lint && yarn tsc` — expect no errors
- [ ] Commit: `git commit -m "devices: migrate ClickableBox2 → ClickableBox3"`

---

## Migration Checklist (all remaining files)

Use `migrate-clickable-box` skill for each chunk. Run `yarn lint && yarn tsc` and commit after each directory.

### Pilot
- [x] `shared/devices/` (6 total)

### Round 1 — small
- [ ] `shared/git/` (3)
- [ ] `shared/incoming-share/` (2)
- [ ] `shared/signup/` (2)
- [ ] `shared/provision/` (4)
- [ ] `shared/people/` (2)
- [ ] `shared/settings/` (4)
- [ ] `shared/profile/` (10)

### Round 2 — medium
- [ ] `shared/tracker/` (4)
- [ ] `shared/menubar/` (3)
- [ ] `shared/app/` (4)
- [ ] `shared/router-v2/` (9)
- [ ] `shared/teams/` (25+)
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

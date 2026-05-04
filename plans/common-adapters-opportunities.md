# Common Adapter Opportunities

This is an RFC-style evaluation of `shared/` JSX patterns that look repetitive because the shared `Kb.*`
adapter layer does not expose the right primitive, prop, or variant yet.

The evidence below comes from source inspection only. This checkout does not have `node_modules`, so no
TypeScript, lint, or UI tooling was run.

## Summary

The biggest opportunity is not a brand-new widget. It is reducing style boilerplate around the primitives we
already use most:

| Adapter | Approximate usages in `shared/**/*.tsx` |
| --- | ---: |
| `Kb.Box2` | 1,975 |
| `Kb.Text` | 1,427 |
| `Kb.Icon` | 282 |
| `Kb.Button` | 277 |

High-repetition style patterns:

- `Box2` has only all-side `padding`, but local styles repeatedly add directional padding and margins.
- Card, panel, and pill styles repeat the same `backgroundColor`, `borderRadius`, and 1px border shapes.
- Icon/text rows repeat `horizontal + gap + alignItems=center` wrappers.
- Loading UI repeats direct `ProgressIndicator` placement even though a private `loading-state-view` already exists.
- Buttons on colored backgrounds repeatedly override both container and label styles.
- Text color is often expressed as ad hoc `style={{color: ...}}`, but a broad color prop would be risky without semantic limits.

## Ranked Candidates

### P0: Add Directional Spacing Props To `Box2`

**Why:** `Box2` is the layout workhorse, but it only accepts `padding?: keyof globalMargins`. Source inspection found frequent local style entries such as:

- `paddingRight: Kb.Styles.globalMargins.small`: 83
- `paddingLeft: Kb.Styles.globalMargins.small`: 72
- `padding: Kb.Styles.globalMargins.small`: 65
- `paddingTop: Kb.Styles.globalMargins.tiny`: 64
- `paddingBottom: Kb.Styles.globalMargins.tiny`: 57
- `marginRight: Kb.Styles.globalMargins.tiny`: 49
- `marginTop: Kb.Styles.globalMargins.tiny`: 48

Current `Box2Props` already has the right shape for cross-platform enum-style layout props; this would extend that model instead of adding arbitrary style objects.

**Proposed API:**

```tsx
type Spacing = keyof typeof globalMargins

type Box2Props = {
  padding?: Spacing
  paddingHorizontal?: Spacing
  paddingVertical?: Spacing
  paddingTop?: Spacing
  paddingRight?: Spacing
  paddingBottom?: Spacing
  paddingLeft?: Spacing
  margin?: Spacing
  marginHorizontal?: Spacing
  marginVertical?: Spacing
  marginTop?: Spacing
  marginRight?: Spacing
  marginBottom?: Spacing
  marginLeft?: Spacing
}
```

**Precedence:** apply existing `padding`, then directional/pair props, then `style` last. This preserves current override behavior.

**Before:**

```tsx
<Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.banner}>
  ...
</Kb.Box2>

banner: {
  backgroundColor: Kb.Styles.globalColors.blue,
  paddingBottom: Kb.Styles.globalMargins.xtiny,
  paddingRight: Kb.Styles.globalMargins.tiny,
  paddingTop: Kb.Styles.globalMargins.xtiny,
}
```

**After:**

```tsx
<Kb.Box2
  direction="horizontal"
  fullWidth={true}
  alignItems="center"
  paddingVertical="xtiny"
  paddingRight="tiny"
  style={styles.banner}
>
  ...
</Kb.Box2>
```

**Implementation notes:** update `box.d.ts`, `box.native.tsx`, `box.desktop.tsx`, and `box.css`. Prefer precomputed native maps like the existing gap/padding maps. On desktop, add deterministic classes rather than inline style generation where practical.

**Risk:** medium-low. The API is large, but every value is constrained to the existing spacing scale. The main risk is prop bloat; start with `paddingHorizontal`, `paddingVertical`, and directional margins if we want a smaller first pass.

### P0: Add A General `Surface` Primitive, Then Migrate `RoundedBox`

**Why:** 436 inspected lines contain repeated surface ingredients such as `borderStyle: 'solid'`, `borderWidth: 1`, `borderRadius: Kb.Styles.borderRadius`, `borderColor: black_10`, or common white/blueGrey backgrounds. `RoundedBox` exists, but it is fixed to a white, bordered, padded shape and cannot represent common panel/pill/banner containers.

**Proposed API:**

```tsx
type SurfaceProps = {
  children: React.ReactNode
  direction?: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  gap?: keyof typeof Kb.Styles.globalMargins
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  justifyContent?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  fullWidth?: boolean
  fullHeight?: boolean
  background?: 'white' | 'blueGrey' | 'blueGreyLight' | 'black_10' | 'transparent'
  border?: 'none' | 'black_10' | 'black_20' | 'greyDark'
  radius?: 'none' | 'small' | 'default' | 'round'
  padding?: keyof typeof Kb.Styles.globalMargins
  paddingHorizontal?: keyof typeof Kb.Styles.globalMargins
  paddingVertical?: keyof typeof Kb.Styles.globalMargins
  marginBottom?: keyof typeof Kb.Styles.globalMargins
  role?: 'card' | 'pill' | 'panel'
  style?: Kb.Styles.StylesCrossPlatform
}
```

`role` should be a preset only; explicit props still win before `style`.

**Before:**

```tsx
<Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.pill}>
  <Kb.Text type={Kb.Styles.isMobile ? 'Body' : 'BodySemibold'}>#{channelname}</Kb.Text>
  {onRemove && <Kb.Icon type="iconfont-remove" onClick={onRemove} color={Kb.Styles.globalColors.black_20} />}
</Kb.Box2>

pill: Kb.Styles.platformStyles({
  common: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.tiny),
    backgroundColor: Kb.Styles.globalColors.white,
    borderRadius: Kb.Styles.borderRadius,
    marginBottom: Kb.Styles.globalMargins.xtiny,
  },
  isMobile: {
    borderColor: Kb.Styles.globalColors.black_20,
    borderStyle: 'solid',
    borderWidth: 1,
  },
})
```

**After:**

```tsx
<Kb.Surface
  role="pill"
  direction="horizontal"
  gap="tiny"
  alignItems="center"
  marginBottom="xtiny"
  border={Kb.Styles.isMobile ? 'black_20' : 'none'}
>
  <Kb.Text type={Kb.Styles.isMobile ? 'Body' : 'BodySemibold'}>#{channelname}</Kb.Text>
  {onRemove && <Kb.Icon type="iconfont-remove" onClick={onRemove} color={Kb.Styles.globalColors.black_20} />}
</Kb.Surface>
```

**Implementation notes:** implement `Surface` as a thin `Box2` wrapper and keep it in `common-adapters`. Either migrate `RoundedBox` to use `Surface` internally or keep `RoundedBox` as a compatibility wrapper.

**Risk:** medium. The risk is inventing a second styling system. Keep variants intentionally small and based on existing colors/borders found in the repo.

### P1: Add `IconText` For Inline Icon/Text Rows

**Why:** At least 55 exact matches use `Box2 direction="horizontal"` with `gap` and either `alignItems="center"` or `centerChildren={true}`. Many are just an icon/meta plus text. This is not huge by raw count, but it reduces visual boilerplate and improves consistency.

**Proposed API:**

```tsx
type IconTextProps = {
  icon: Kb.IconType
  children: React.ReactNode
  type?: React.ComponentProps<typeof Kb.Text>['type']
  iconColor?: string
  textColor?: 'primary' | 'secondary' | 'danger' | 'positive' | 'inverse'
  gap?: keyof typeof Kb.Styles.globalMargins
  lineClamp?: number
  onClick?: () => void
  trailingIcon?: Kb.IconType
  style?: Kb.Styles.StylesCrossPlatform
}
```

**Before:**

```tsx
<Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" alignItems="center">
  <Kb.Text type="BodySemibold" lineClamp={1} ellipsizeMode="middle">
    {teamMeta.teamname}
  </Kb.Text>
  {teamMeta.isOpen && <Kb.Meta title="open" backgroundColor={Kb.Styles.globalColors.green} />}
</Kb.Box2>
```

This exact case includes `Meta`, so it might not use `IconText`, but it demonstrates the repeated wrapper pattern. Good first migrations are rows that are strictly `Icon + Text` or `Text + trailing Icon`, such as import/contact/action rows.

**Implementation notes:** keep it compositional. Do not make it a replacement for every horizontal row. It should be used only when the semantic unit is a single inline label with an icon.

**Risk:** low-medium. The main risk is overuse on rows that really need custom layout. Document when not to use it.

### P1: Export And Generalize Loading/Empty State

**Why:** There are 86 `ProgressIndicator` usages. `shared/common-adapters/loading-state-view.tsx` already implements a centered loading layout, but it is not exported from `common-adapters/index.d.ts` and is used only by image/web-view internals.

**Proposed API:**

```tsx
type LoadingStateProps = {
  loading?: boolean
  label?: string
  progress?: number
  white?: boolean
  fullHeight?: boolean
  fullWidth?: boolean
  overlay?: boolean
}

type EmptyStateProps = {
  icon?: Kb.IconType
  title?: string
  body?: React.ReactNode
  actions?: React.ReactNode
  fullHeight?: boolean
}
```

**Before:**

```tsx
<Kb.Box2 direction="vertical" centerChildren={true} style={styles.progressContainer}>
  <Kb.ProgressIndicator />
</Kb.Box2>
```

**After:**

```tsx
<Kb.LoadingState fullHeight={true} label="Loading ..." />
```

**Implementation notes:** rename or re-export `LoadingStateView` as `LoadingState`; keep the old file local if needed. Add `EmptyState` separately only after two or three high-confidence migrations, because empty-state wording and action layout vary more than spinner placement.

**Risk:** low for loading, medium for empty state. Loading is mostly mechanical; empty state can become too product-opinionated.

### P1: Add Button Variants For Icon+Label And Colored Surfaces

**Why:** `Button` supports `children` or `label`, and `IconButton` supports icon-only. Missing is a first-class icon+label case and a semantic way to render buttons on colored banners. Current files repeatedly override `style` and `labelStyle` with names like `primaryOnBlueLabel`, `secondaryOnRedLabel`, and `secondaryOnColorLabel`.

**Proposed API:**

```tsx
type ButtonProps = {
  icon?: Kb.IconType
  iconPosition?: 'left' | 'right'
  context?: 'normal' | 'onBlue' | 'onRed' | 'onYellow' | 'onDark'
}
```

`context` controls contrast-safe container and label colors for the existing `type`/`mode` matrix.

**Before:**

```tsx
<Kb.Button
  label="Dismiss"
  mode="Secondary"
  onClick={props.onDismiss}
  small={true}
  style={styles.secondaryOnColor}
  labelStyle={styles.secondaryOnColorLabel}
/>

secondaryOnColor: Kb.Styles.platformStyles({
  common: {backgroundColor: Kb.Styles.globalColors.black_20},
  isMobile: {borderWidth: 0},
}),
secondaryOnColorLabel: {color: Kb.Styles.globalColors.white},
```

**After:**

```tsx
<Kb.Button
  label="Dismiss"
  mode="Secondary"
  context="onBlue"
  onClick={props.onDismiss}
  small={true}
/>
```

**Implementation notes:** keep `IconButton` for icon-only buttons. Add `icon` to `Button` for icon+label only, and preserve `children` for custom content. Implement `context` with constrained variants instead of continuing to spread arbitrary label styles.

**Risk:** medium. Button contrast/accessibility mistakes are user-visible, so migrate colored banners first and verify visually.

### P2: Add Constrained Semantic Color Props To `Text`

**Why:** Text color overrides are common:

- `black_50`: 49
- `white`: 42
- `black`: 39
- `redDark`: 38
- `blueDark`: 27

However, raw `color={Kb.Styles.globalColors.x}` would make `Text` a parallel style API and encourage one-off visual decisions.

**Proposed API:**

```tsx
type TextTone = 'primary' | 'secondary' | 'disabled' | 'danger' | 'positive' | 'inverse' | 'link'

type TextProps = {
  tone?: TextTone
}
```

**Before:**

```tsx
<Kb.Text type="BodySmall" style={styles.channelDummyInputText}>
  ...
</Kb.Text>

channelDummyInputText: {color: Kb.Styles.globalColors.black_50}
```

**After:**

```tsx
<Kb.Text type="BodySmall" tone="secondary">
  ...
</Kb.Text>
```

**Implementation notes:** map tones to platform/theme-aware colors in `text.styles.*` or `text.shared.tsx`. Do not support arbitrary color names in this prop.

**Risk:** medium-high. Text already has many `type` values encoding typography and link color. Add this only if it does not conflict with existing text types like `BodySmallError`, `BodyPrimaryLink`, or negative text handling.

### P2: Consider `Row` And `Column` Aliases Only After Spacing Props

**Why:** The most frequent `Box2` signatures are simple layout declarations:

- `direction="vertical"`: 344
- `direction="vertical" fullWidth={true}`: 261
- `direction="horizontal"`: 132
- `direction="horizontal" fullWidth={true}`: 114
- `direction="vertical" fullWidth={true} centerChildren={true}`: 66

Aliases could reduce JSX, but they may split the adapter surface and create churn without removing the style blocks that cause most complexity.

**Possible API:**

```tsx
<Kb.Row fullWidth={true} gap="tiny" alignItems="center">
  ...
</Kb.Row>

<Kb.Column fullWidth={true} gap="small">
  ...
</Kb.Column>
```

**Recommendation:** do not implement this first. Add directional spacing and surface primitives first, then revisit whether `Row`/`Column` still buy enough to justify the extra exported components.

## Implementation Order

1. Add `Box2` directional spacing props and migrate a small set of obvious local styles.
2. Add `Surface` with `card`, `panel`, and `pill` presets; migrate `RoundedBox` internally or leave it as a wrapper.
3. Export `LoadingState`; defer `EmptyState` until there are clear target screens.
4. Add `Button` `context` and `icon` support; migrate colored banner buttons.
5. Add `IconText` if the first four changes still leave obvious inline icon/text repetition.
6. Reassess `Text tone` and `Row`/`Column` after the lower-risk changes land.

## Acceptance Criteria For Future Implementation

- All new props use existing design tokens, not arbitrary numbers or color strings.
- Desktop and native behavior remain equivalent unless a platform-specific difference already exists.
- `style` remains the final override.
- No raw DOM is introduced in shared `.tsx` files.
- Existing components stay backward compatible.
- If `node_modules` are available on the implementing machine, run `yarn lint` and `yarn tsc` from `shared/`; otherwise do source-only validation.

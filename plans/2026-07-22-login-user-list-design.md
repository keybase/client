# Login: inline user list replaces dropdown

## Goal

On the logged-out login screen (relogin), replace the user-picker dropdown with an
always-visible, scrollable list of configured accounts, capped at ~5.5 rows tall.
Clicking a signed-in account logs in immediately. The "Log in" button only exists
when a password is actually needed. Applies to both desktop and mobile.

## Current state

- `shared/login/relogin/index.tsx` renders `DesktopLogin` (uses `Kb.Dropdown` with
  custom `UserRow` items) and `NativeLoginRender` (uses `dropdown.native.tsx`, an
  iOS modal picker / invisible Android picker).
- `selectedUserChange` in `ReloginContainer` already clears error/password and calls
  `login(user, '')` immediately when the account has a stored secret.
- `router-v2/account-switcher/index.tsx` has the row pattern we want (`Kb.ListItem`
  + avatar + status subtext + per-row spinner keyed on `C.waitingKeyConfigLogin`).
  We copy the pattern, not the component (it's coupled to logged-in stores).

## Design

### New component: `shared/login/relogin/user-list.tsx`

One cross-platform file (no `.desktop`/`.native` split).

Props:

```ts
type Props = {
  users: Array<T.Config.ConfiguredAccount>
  selectedUser: string
  onSelectUser: (username: string) => void
  onSomeoneElse: () => void
}
```

Behavior:

- One `Kb.ListItem` per account: type `Large` on mobile, `Small` on desktop.
  Icon = `Kb.Avatar` (48 mobile / 32 desktop). Body = username (`BodySemibold`)
  with subtext "Signed in" (has stored secret) or "Signed out".
- Final row: "Someone else..." → `onSomeoneElse`. Placeholder avatar (no username).
- Clicked-row spinner: copy account-switcher's `clicked`/`wasWaiting` local state.
  While `C.Waiting.useAnyWaiting(C.waitingKeyConfigLogin)` is true, the clicked row
  shows a `ProgressIndicator` and all rows have `onClick={undefined}`.
- The selected user's row (relevant when they're signed out and the password field
  is showing) gets a highlight background (`blueLighter2`) so the password input
  below has a visible anchor.
- Container: `Kb.ScrollView` with `maxHeight = 5.5 × rowHeight`, where rowHeight is
  `largeHeight`/`smallHeight` exported from `common-adapters/list-item.tsx`
  (mobile 64 / desktop 48 for the chosen types). Half-visible sixth row signals
  scrollability. With ≤5 accounts the list shrinks to content height.

### Changes to `shared/login/relogin/index.tsx`

Both variants:

- Replace the dropdown with `<UserList users onSelectUser={selectedUserChange}
  onSomeoneElse selectedUser />`.
- Render the "Log in" `WaitingButton` only when `needPassword` is true. Password
  input, Enter-to-submit, "Forgot password?", feedback link, and mobile
  "Create account" button all unchanged.
- Desktop: delete `UserRow`, `userRows`, `selectedIdx`, `_onClickUserIdx`, the
  `other` sentinel, and dropdown-related styles.
- Native: delete the `Dropdown` import/usage.
- `UserCard` avatar continues to track `selectedUser`.

### Deletions

- `shared/login/relogin/dropdown.native.tsx` — file removed entirely. The
  `@react-native-picker/picker` dependency stays (`common-adapters/floating-picker.tsx`
  still uses it).

## Flow

1. Screen shows list of accounts + "Someone else...".
2. Click signed-in account → row spinner, immediate `login(user, '')`. On error,
   errorBanner shows (existing), waiting clears, spinner clears, rows re-enable.
3. Click signed-out account → row highlights, password input + "Log in" button
   appear below the list. Enter or button submits.
4. Click "Someone else..." → `startProvision()` (unchanged).

## Amendment (2026-07-22, post-review)

- The 5.5-row cap is a hard maximum on all platforms, but the list must also
  shrink when the screen is short: `flexShrink: 1` with a floor of
  `minHeight = 2 × rowHeight`. Overflow inside the list scrolls; the screen
  holding the list must never scroll on mobile (no outer ScrollView).
- Native: `UserCard` outer (`card`) and inner (`cardInner`) containers get
  `flexShrink: 1` so the shrink chain reaches the list.
- Desktop: the login screen overrides `UserCard`'s fixed `height: 430` with
  `height: 'auto'`, `minHeight: 430` (via the `outerStyle` it already passes)
  so the card grows to fit 5.5 rows plus the password block instead of
  squeezing the list.

## Amendment 2 (2026-07-22)

- Mobile: "Create account" moves from a full-width bottom button to a small
  `mode="Secondary"` button in the upper right of the screen (first row of the
  column, right-aligned). The bottom button, its flex spacer, and its styles are
  removed. Desktop keeps its header-right link (unchanged).

## Not doing

- Fullname subtext (users store is empty while logged out).
- Any change to signup/recover/feedback flows.
- Stories/tests beyond `yarn lint` + `yarn tsc`; visual verification by user.

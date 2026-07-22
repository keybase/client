# Login Inline User List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the login screen's user-picker dropdown (desktop `Kb.Dropdown`, mobile native picker) with an always-visible scrollable list capped at 5.5 rows; clicking a signed-in account logs in immediately; the "Log in" button renders only when a password is needed.

**Architecture:** One new cross-platform component `shared/login/relogin/user-list.tsx` (row pattern copied from `router-v2/account-switcher`), wired into both `DesktopLogin` and `NativeLoginRender` in `shared/login/relogin/index.tsx`. `shared/login/relogin/dropdown.native.tsx` is deleted.

**Tech Stack:** React + Kb common-adapters (`ListItem`, `Avatar`, `ScrollView`, `ProgressIndicator`), zustand config store (already wired), `C.waitingKeyConfigLogin` waiting key.

**Spec:** `plans/2026-07-22-login-user-list-design.md`

## Global Constraints

- Repo root is `client/`; TS source in `shared/`. All Bash from `shared/`.
- No DOM elements in plain `.tsx` files — `Kb.*` only.
- `yarn` only, never `npm`.
- Validation after TS changes: `yarn lint` then `yarn tsc` (from `shared/`).
- Remove unused code (styles, imports, vars) in files you touch.
- No commits until the user has visually verified and explicitly asks. No `Co-Authored-By` ever.
- Bare globals `isMobile` / `isAndroid` / `isIOS` are ambient in this repo — use them without imports (see `router-v2/account-switcher/index.tsx` for precedent).
- No unit tests for this feature (spec: validation is lint + tsc + user visual check).

---

### Task 1: Create `user-list.tsx`

**Files:**
- Create: `shared/login/relogin/user-list.tsx`

**Interfaces:**
- Consumes: `T.Config.ConfiguredAccount` (`{username: string, hasStoredSecret: boolean, uid: string}`), `C.Waiting.useAnyWaiting`, `C.waitingKeyConfigLogin`, `Kb.ListItem`, `Kb.largeListItemHeight` / `Kb.smallListItemHeight` (exported from `common-adapters/index.tsx:68-71`).
- Produces: default export `UserList` with props:

```ts
type Props = {
  users: Array<T.Config.ConfiguredAccount>
  selectedUser: string
  onSelectUser: (username: string) => void
  onSomeoneElse: () => void
}
```

- [ ] **Step 1: Write the file**

```tsx
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'

type Props = {
  users: Array<T.Config.ConfiguredAccount>
  selectedUser: string
  onSelectUser: (username: string) => void
  onSomeoneElse: () => void
}

const rowType = isMobile ? 'Large' : 'Small'
const rowHeight = isMobile ? Kb.largeListItemHeight : Kb.smallListItemHeight
const avatarSize = isMobile ? 48 : 32

type RowProps = {
  username: string
  hasStoredSecret: boolean
  selected: boolean
  firstItem: boolean
  waiting: boolean
  onSelectUser: (username: string) => void
}

// clicked/wasWaiting mirrors router-v2/account-switcher: spinner on the row that
// started the login, cleared when the waiting key clears
const UserRow = (p: RowProps) => {
  const {username, hasStoredSecret, selected, firstItem, waiting, onSelectUser} = p
  const [{clicked, wasWaiting}, setClickedState] = React.useState(() => ({
    clicked: false,
    wasWaiting: waiting,
  }))
  if (wasWaiting !== waiting) {
    setClickedState({clicked: waiting ? clicked : false, wasWaiting: waiting})
  }
  const onClick = waiting
    ? undefined
    : () => {
        setClickedState({clicked: true, wasWaiting: waiting})
        onSelectUser(username)
      }
  return (
    <Kb.ListItem
      type={rowType}
      firstItem={firstItem}
      icon={<Kb.Avatar size={avatarSize} username={username} />}
      action={clicked ? <Kb.ProgressIndicator type="Large" /> : undefined}
      style={selected ? styles.selectedRow : undefined}
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={waiting ? styles.waiting : undefined}>
          <Kb.Text type="BodySemibold">{username}</Kb.Text>
          <Kb.Text type="BodySmall">{hasStoredSecret ? 'Signed in' : 'Signed out'}</Kb.Text>
        </Kb.Box2>
      }
      onClick={onClick}
    />
  )
}

const UserList = (p: Props) => {
  const {users, selectedUser, onSelectUser, onSomeoneElse} = p
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyConfigLogin)
  return (
    <Kb.ScrollView style={styles.scroll} alwaysBounceVertical={false}>
      {users.map((u, idx) => (
        <UserRow
          key={u.username}
          username={u.username}
          hasStoredSecret={u.hasStoredSecret}
          selected={u.username === selectedUser && !u.hasStoredSecret}
          firstItem={idx === 0}
          waiting={waiting}
          onSelectUser={onSelectUser}
        />
      ))}
      <Kb.ListItem
        type={rowType}
        firstItem={users.length === 0}
        icon={<Kb.Avatar size={avatarSize} username="" />}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true} style={waiting ? styles.waiting : undefined}>
            <Kb.Text type="BodySemibold">Someone else...</Kb.Text>
          </Kb.Box2>
        }
        onClick={waiting ? undefined : onSomeoneElse}
      />
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      scroll: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        flexGrow: 0,
        maxHeight: rowHeight * 5.5,
        width: '100%',
      },
      selectedRow: {backgroundColor: Kb.Styles.globalColors.blueLighter2},
      waiting: {opacity: 0.5},
    }) as const
)

export default UserList
```

- [ ] **Step 2: Verify it compiles**

Run (from `shared/`): `yarn tsc`
Expected: no new errors (file is not imported yet; this catches syntax/type mistakes inside it). Any error mentioning `user-list.tsx` must be fixed before Task 2.

---

### Task 2: Wire into `index.tsx`, delete `dropdown.native.tsx`

**Files:**
- Modify: `shared/login/relogin/index.tsx`
- Delete: `shared/login/relogin/dropdown.native.tsx`

**Interfaces:**
- Consumes: `UserList` default export from Task 1 (props `users`, `selectedUser`, `onSelectUser`, `onSomeoneElse`).
- Produces: no new exports; `ReloginContainer` behavior contract unchanged except button visibility.

- [ ] **Step 1: Update imports in `index.tsx`**

Replace:

```tsx
import Dropdown from './dropdown.native'
```

with:

```tsx
import UserList from './user-list'
```

- [ ] **Step 2: Rework `DesktopLogin`**

Delete the `other` constant and the `UserRow` component (lines ~34-49). In `DesktopLogin`, delete `_onClickUserIdx`, `userRows`, and `selectedIdx`, and replace the `<Kb.Dropdown .../>` element with:

```tsx
<UserList
  users={props.users}
  selectedUser={props.selectedUser}
  onSelectUser={u => {
    props.selectedUserChange(u)
    _inputRef.current?.focus()
  }}
  onSomeoneElse={props.onSomeoneElse}
/>
```

(The `_inputRef` focus preserves the current behavior of focusing the password input after picking a signed-out user; `autoFocus` alone only fires on mount, not when switching between two signed-out users.)

Wrap the desktop `WaitingButton` block so it only renders when a password is needed — replace:

```tsx
<Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} justifyContent="flex-end" flex={1}>
  <Kb.WaitingButton
    disabled={props.needPassword && !props.password}
    fullWidth={true}
    waitingKey={C.waitingKeyConfigLogin}
    style={desktopStyles.loginSubmitButton}
    label="Log in"
    onClick={props.onSubmit}
  />
</Kb.Box2>
```

with:

```tsx
{props.needPassword && (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} justifyContent="flex-end" flex={1}>
    <Kb.WaitingButton
      disabled={!props.password}
      fullWidth={true}
      waitingKey={C.waitingKeyConfigLogin}
      style={desktopStyles.loginSubmitButton}
      label="Log in"
      onClick={props.onSubmit}
    />
  </Kb.Box2>
)}
```

From `desktopStyles` delete the now-unused entries: `other`, `provisioned`, `userRow`, `userDropdown`, `userOverlayStyle`.

- [ ] **Step 3: Rework `NativeLoginRender`**

Replace:

```tsx
<Dropdown
  type="Username"
  value={props.selectedUser}
  onClick={props.selectedUserChange}
  onOther={props.onSomeoneElse}
  options={props.users}
/>
```

with:

```tsx
<UserList
  users={props.users}
  selectedUser={props.selectedUser}
  onSelectUser={props.selectedUserChange}
  onSomeoneElse={props.onSomeoneElse}
/>
```

Replace the native `WaitingButton`:

```tsx
<Kb.WaitingButton
  disabled={props.needPassword && !props.password}
  waitingKey={C.waitingKeyConfigLogin}
  style={props.needPassword ? undefined : nativeStyles.loginButtonGap}
  fullWidth={true}
  label="Log in"
  onClick={props.onSubmit}
/>
```

with:

```tsx
{props.needPassword && (
  <Kb.WaitingButton
    disabled={!props.password}
    waitingKey={C.waitingKeyConfigLogin}
    fullWidth={true}
    label="Log in"
    onClick={props.onSubmit}
  />
)}
```

From `nativeStyles` delete the now-unused `loginButtonGap` entry.

- [ ] **Step 4: Delete the native dropdown**

Run (from `shared/`): `rm login/relogin/dropdown.native.tsx`

Then confirm nothing else imports it: `grep -rn "relogin/dropdown" . --include='*.tsx' --include='*.ts' | grep -v node_modules`
Expected: no output.

- [ ] **Step 5: Validate**

Run (from `shared/`): `yarn lint` then `yarn tsc`
Expected: both clean. Any errors are from these changes (never assume pre-existing) — fix and re-run.

---

### Task 3: User verification + commit gate

- [ ] **Step 1: Hand off for visual check**

Stop. Report done; the user launches the app and verifies desktop + mobile visuals themselves (never drive the Electron app or simulator unasked). Both the immediate-login click path and the signed-out → password → Log in path need eyes.

- [ ] **Step 2: Commit (only when the user explicitly asks)**

```bash
git add shared/login/relogin/user-list.tsx shared/login/relogin/index.tsx plans/2026-07-22-login-user-list-design.md plans/2026-07-22-login-user-list-plan.md
git rm shared/login/relogin/dropdown.native.tsx
git commit -m "feat(login): inline user list replaces dropdown; click to log in"
```

No `Co-Authored-By` line.

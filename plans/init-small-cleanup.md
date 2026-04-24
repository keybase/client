# Init Subscription Small Cleanup

## Summary

Clean up the app-wide Zustand side-effect wiring in `shared/constants/init/shared.tsx` without changing behavior.

The end state is:

- `initSharedSubscriptions` reads as a registry of named effects
- each subscription reacts to a narrow selected value instead of inspecting a whole store callback
- HMR cleanup behavior stays centralized and unchanged
- app-lifetime side effects remain outside React component lifetimes
- stores do not gain new cross-store imports

This is intentionally a small cleanup plan. It does not move engine incoming routing, rewrite startup, or change store ownership.

## Guiding Rules

- Preserve current behavior exactly
- Keep app bootstrap and cross-store orchestration explicit in `constants/init`
- Use store subscriptions for daemon/login/navigation side effects that have app lifetime
- Prefer named handlers over inline multi-branch subscription bodies
- Prefer narrow subscription helpers over full-store `s` / `old` comparisons
- Keep `_sharedUnsubs` as the single shared HMR cleanup list
- Do not move these effects into mounted React components unless the effect is truly owned by a mounted screen
- Do not make stores import and drive each other directly
- Remove dead imports, styles, helpers, and comments created by the cleanup

## Chunk 1: Add A Small Subscription Helper

- [ ] Add a file-local helper near `initSharedSubscriptions` that subscribes to a selected value and invokes a handler only when that value changes
- [ ] Keep the helper local to `shared.tsx` for this pass unless another init file immediately needs it
- [ ] Use strict identity comparison by default, matching the current `s.field !== old.field` behavior
- [ ] Return the underlying unsubscribe so callers can keep using `_sharedUnsubs.push(...)`

Example target shape:

```ts
const subscribeValue = <State, Value>(
  store: {subscribe: (listener: (state: State, prevState: State) => void) => () => void},
  select: (state: State) => Value,
  onChange: (value: Value, previous: Value) => void
) =>
  store.subscribe((state, previousState) => {
    const value = select(state)
    const previous = select(previousState)
    if (value !== previous) {
      onChange(value, previous)
    }
  })
```

## Chunk 2: Extract Config Effects Into Named Handlers

- [ ] Split the config subscription into separate named handlers for:
  - load-on-start phase reaching `startupOrReloginButNotInARush`
  - gregor reachability becoming `Reachable.yes`
  - installer run count changes
  - login state changes
  - revoked trigger changes
  - configured accounts changes
- [ ] Keep the existing startup behavior intact: follower info request, server config update, contact import setting load, and non-phone chat bootstrap refresh
- [ ] Keep login behavior intact: bootstrap status load, KBFS daemon status check, signup draft cleanup, configured account loading, and account refresh rules
- [ ] Keep configured account mirroring into the users store intact
- [ ] Move nested one-off functions out of the subscription body only when it makes the handler easier to scan

## Chunk 3: Extract Daemon, Shell, Provision, And Router Effects

- [ ] Convert the shell `active` subscription into a named `onUserActiveChanged` style handler
- [ ] Split daemon reactions into named handlers for:
  - handshake version changes
  - bootstrap status changes
  - handshake state reaching `done`
- [ ] Keep bootstrap status fanout unchanged: current user bootstrap, default username, login state, HTTP server info, and user reacjis
- [ ] Convert the provision trigger subscription into a named handler while preserving the logout-before-provision behavior
- [ ] Convert the router nav-state subscription into a named route-change handler while preserving:
  - team-building cancellation when leaving team-builder screens
  - FS critical update clearing when leaving the FS tab
  - FS `userIn` / `userOut` transitions
  - team nav badge clearing
  - conversation route-change forwarding

## Chunk 4: Keep The Init Boundary Clear

- [ ] Leave `_onEngineIncoming` behavior out of this cleanup unless a trivial local extraction is needed for readability
- [ ] Do not introduce a new global event bus or module-level mutable cache
- [ ] Do not add `subscribeWithSelector` middleware in this pass unless the local helper proves insufficient
- [ ] If a helper becomes useful in desktop or native init files too, move it to a small shared init utility in a separate follow-up

## Validation

- [ ] Review the diff to confirm subscription triggers are identical to the previous field comparisons
- [ ] Confirm `_sharedUnsubs` still receives every shared subscription unsubscribe
- [ ] Confirm HMR cleanup still unsubscribes before re-subscribing
- [ ] Confirm no stores gained new imports from other stores solely for side effects
- [ ] Confirm no React component lifetime now owns app-wide daemon/login/navigation behavior
- [ ] If node tooling is available on another machine, run `yarn lint` and `yarn tsc` from `shared/`

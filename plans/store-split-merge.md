# Store Split / Merge Cleanup

## Goal

Reduce hidden cross-store coupling without merging `config` and `daemon`.

## Decisions

- Keep `daemon` as the daemon/bootstrap handshake store.
- Keep `current-user` as the dependency-free identity store.
- Shrink `config` by moving feature- and shell-owned state out.
- Use `shared/constants/init/shared.tsx` for real coordination only, not one-store forwarding when a direct owner is clearer.

## Checklist

- [x] Extract `unlock-folders` out of `config` into a dedicated feature-local runtime store.
- [ ] Split app-shell/UI state out of `config`.
- [ ] Clean up the `daemon` / `config` account-refresh seam.
- [ ] Remove dead init-time forwarding from `shared/constants/init/shared.tsx` after each extraction.

## Unlock-Folders Notes

- Ownership now lives in `shared/unlock-folders/store.tsx`.
- Keep renderer-global state there because open/close/error updates come from engine and remote handlers outside the React tree.
- Keep view-local state such as `phase` in `shared/unlock-folders/main2.desktop.tsx`.

## Remaining Work

### App Shell / Prefs

Extract these from `config` into a shell/prefs store:

- `active`
- `appFocused`
- `mobileAppState`
- `networkStatus`
- `windowState`
- `openAtLogin`
- `useNativeFrame`
- `forceSmallNav`
- `notifySound`

### Session / Bootstrap

Keep these in `config` for now:

- `loggedIn`
- `loggedInCausedbyStartup`
- `configuredAccounts`
- `defaultUsername`
- `userSwitching`
- `httpSrv`
- `startup`
- `gregorReachable`

Keep these in `daemon`:

- `handshakeState`
- `handshakeVersion`
- `handshakeWaiters`
- `handshakeRetriesLeft`
- `handshakeFailedReason`
- `bootstrapStatus`
- daemon error state

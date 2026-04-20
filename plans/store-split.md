# Zustand Store Cleanup Series

## Summary

Optimize for store reduction, not store proliferation. Avoid splitting `modal-header` into several tiny stores. If a `modal-header` field can move to route params or feature-local screen state, do that; otherwise leave it alone for now.

For this repo, assume most RPCs hit a local service and are cheap. Default toward reloading in the owning component instead of keeping a convenience cache unless the data truly needs to survive navigation or serve unrelated entry points.

Cross-cutting rule: when an engine action is only a screen-local refresh or prompt nudge, prefer the typed engine listener layer over a one-field store or an `init/shared.tsx` forwarding shim.

Recommended implementation order:

- [x] `settings-email`
- [x] `settings-phone`
- [x] `people`
- [x] `recover-password`
- [ ] `settings-password`
- [ ] `tracker`
- [ ] `team-building`
- [ ] `modal-header` only for param/local-state extraction, not store splitting

## Key Changes

### 1. Shrink `settings-email` to shared contact data only

Current shape:

- `emails` is a shared cache used by account settings and notification settings.
- `addedEmail` is transient account-settings banner state.
- `editEmail` mixes shared mutations with one-shot UI behavior.

Planned change:

- Keep `emails` in the store for now.
- Delete `addedEmail`, `setAddedEmail`, and `resetAddedEmail`.
- Move the “verification email sent” banner trigger into the account-settings flow using route params or local screen state.
- Move verify success UI handling out of `dispatch.editEmail`; keep only the mutation if it still has multiple callers.
- Preserve notification-fed `emails` updates and verified-status updates.

Public/API impact:

- Remove store APIs related to `addedEmail`.
- Update account settings and add-email flow to use explicit success context instead of hidden global banner state.

### 2. Shrink `settings-phone` to shared phone data only

Current shape:

- `phones` is a shared cache used by account settings and startup routing.
- `addedPhone` is transient success-banner state.
- `editPhone` is a thin RPC wrapper.

Planned change:

- Keep `phones` in the store for now.
- Delete `addedPhone`, `setAddedPhone`, and `clearAddedPhone`.
- Move the “phone added” success banner to route params or local screen-owned state in the add/verify flow.
- Move delete/searchability RPCs out of the store if they remain account-settings-only operations.
- Keep pure helpers like `makePhoneError` where they are if still shared.

Public/API impact:

- Remove store APIs related to `addedPhone`.
- Potentially remove `dispatch.editPhone` if all remaining callers can use local hooks/RPCs directly.

### 3. Delete `people` store or reduce it to direct feature wiring

Current shape:

- `refreshCount` exists only to trigger reloads in `people/container.tsx`.
- `markViewed` is a feature RPC, not durable global state.

Planned change:

- Remove `refreshCount` from Zustand.
- Subscribe the People feature directly to `homeUIRefresh` via the typed engine listener layer.
- Move `markViewed` into the People feature layer.
- Delete `shared/stores/people.tsx` if nothing durable remains.

Public/API impact:

- Remove init wiring that only forwards `homeUIRefresh` into the People store.
- Update People feature code to own its own refresh/mark-viewed behavior.

Cross-cutting impact:

- Add a typed engine action listener primitive so later store-pruning passes can move ephemeral engine nudges straight into feature code.

### 4. Delete `recover-password` store by moving callbacks to `flow-handles`

Current shape:

- The store mostly holds runtime callbacks in `dispatch.dynamic`.
- `resetEmailSent` is screen state.
- `startRecoverPassword` is orchestration plus navigation.

Planned change:

- Move live callbacks into `flow-handles` using typed wrappers for:
  - cancel
  - submit device select
  - submit no device
  - submit paper key
  - submit password
  - submit reset password
- Use scoped `flow-handles` registrations that return disposers and keep those disposers local to the flow owner.
- Clear those named handlers when each step or the listener finishes; do not rely only on an inactive guard, and use generation-safe cleanup so an older flow cannot wipe handlers from a newer restart.
- Dispose keyed handlers too if the owning route or listener exits before the token is consumed.
- Move `resetEmailSent` into route params or local screen state.
- Move orchestration into a recover-password feature module, not a store.
- Update screens to read explicit params/handlers rather than selecting `dispatch.dynamic.*`.

Public/API impact:

- Delete `shared/stores/recover-password.tsx` if no durable state remains.
- Add recover-password-local typed helpers around `flow-handles`.

### 5. Leave `modal-header` monolithic for now, but extract route-owned state

Current shape:

- `modal-header` mixes several unrelated concerns, but it should not be replaced with a set of tiny stores.

Planned change:

- Do not split `modal-header` into new stores.
- Only pull fields out when they are clearly route-owned or screen-owned:
  - move transient titles or one-shot payloads to route params where the destination screen already owns them
  - move screen-local flags like edit-avatar “has image” into the owning screen if the header only reflects local form state
  - move per-screen action handlers to local route/screen code only when they do not need shared cross-screen coordination
- Leave device badges, FS filter, and other shared header state in `modal-header` unless there is a clean route/local owner.

Public/API impact:

- Reduce `useModalHeaderState.setState(...)` writes opportunistically.
- Do not introduce new tiny stores as replacements.

### 6. Re-evaluate `settings-password` as a merge candidate only if there is a real home

Current shape:

- Only stores `randomPW`.
- Read by several settings screens and updated by notifications.

Planned change:

- Do not localize this to one screen.
- Merge it only if there is an obviously correct account/session store with the same lifecycle.
- Otherwise leave it as an intentionally retained tiny notification-backed cache.

Public/API impact:

- None unless a clear merge target emerges.

### 7. Split `tracker` by behavior only where it reduces real store coupling

Current shape:

- Mixes durable profile caches with transient tracker UI/session behavior and proof suggestions.

Planned change:

- Keep durable caches (`usernameToDetails`, `usernameToNonUserDetails`) together.
- Pull transient tracker-session behavior out where feasible:
  - `showTrackerSet` is the best candidate for a feature-local/session mechanism
  - move `proofSuggestions` closer to profile/proofs UI if it is not broadly shared
- Keep follow/ignore/load orchestration with the cache until a later pass proves a narrower owner.

Public/API impact:

- Preserve existing read APIs until cache extraction is complete.
- Prefer thin feature helpers over exposing more transient state from the store.

### 8. Prune only the duplicated or screen-owned parts of `team-building`

Current shape:

- `TBProvider` is already feature-scoped, which is good.
- Some fields appear duplicated with screen-local state.

Planned change:

- Keep the provider.
- Remove store fields that are already screen-owned or duplicated:
  - `selectedService` is the clearest candidate, since `team-building/index.tsx` already owns it locally
  - re-check `searchQuery` and `searchLimit` for the same pattern
- Keep multi-screen builder session state in the provider:
  - `teamSoFar`
  - `selectedRole`
  - `sendNotification`
  - shared session search results/recommendations if multiple subtrees still need them

Public/API impact:

- Preserve `TBProvider`/`useTBContext`.
- Remove only duplicate screen-owned state from the provider.

## Test Plan

For each commit:

- Update or delete the matching store unit test.
- Add feature-level coverage where behavior moved out of stores.

Critical scenarios:

- Settings account:
  - adding an email still shows the verification banner
  - verifying/resending email still updates visible row state
  - adding/verifying a phone still shows the success banner
  - notification settings still shows the email section correctly
- People:
  - People reloads after `homeUIRefresh`
  - mark-viewed behavior still occurs on the intended path
- Recover password:
  - device select, paper key, password, and reset prompt flows still survive navigation
  - cancel paths still resolve the active RPC correctly
  - runtime handlers still clear on reset/logout
- Modal header:
  - any field moved out to params/local state still renders/clears correctly
  - unchanged shared header behaviors still work as before
- Tracker:
  - profile loads still populate details
  - tracker open/close still works
  - follow/ignore still update result state
- Team building:
  - selection survives builder navigation
  - search/recommendation behavior remains consistent
  - finish/cancel resets only the intended builder session state

## Assumptions And Defaults

- Prefer route params or local feature state over creating new one-field stores.
- Prefer the typed engine listener layer over store plumbing when an engine event only nudges mounted feature UI and can be safely missed while unmounted.
- Keep notification-backed shared caches unless they are clearly just convenience state for one screen.
- `modal-header` is not a restructuring target beyond extracting route-owned or screen-owned values.
- `settings-password` may remain unchanged if there is no clean merge target.
- `team-building` remains a feature-scoped provider; only duplicated screen-owned fields should move out.
- Delete dead store APIs in the same commit that removes their last caller.
- Prefer colocated `C.useRPC` calls over convenience wrapper hooks when the RPC belongs to one feature and the abstraction is only saving a few lines.

# Keybase Store Pruning Notes

Use these examples to decide what to migrate first and what usually stays global.

## Strong Early Candidates

### `shared/stores/settings-email.tsx`

Likely local or route-owned:

- `addingEmail`
- `newEmail`
- `error`
- most submit-time RPC orchestration in `addEmail` and `editEmail`

Potentially local unless another screen truly depends on it:

- `addedEmail`
- `emails`

Good target shape:

- Move submit and resend flows into the owning settings components with `C.useRPC`
- Keep only notification-backed email data if it is still shared outside the screen
- Pass one-shot success context through route params instead of storing it globally when feasible

### `shared/stores/settings-phone.tsx`

Likely local:

- `error`
- `pendingVerification`
- `verificationState`
- `defaultCountry`
- RPC orchestration in `addPhoneNumber`, `resendVerificationForPhone`, `verifyPhoneNumber`

Potentially local if only the account settings flow reads it:

- `phones`

Good target shape:

- Put add/resend/verify state next to the phone settings UI
- Use route params if a follow-up screen only needs the number or entry context
- Preserve notification-driven updates if phone rows can change while the screen is open

### `shared/stores/settings-password.tsx`

Likely local:

- `newPassword`
- `newPasswordConfirm`
- `newPasswordError`
- `newPasswordConfirmError`
- `error`
- `hasPGPKeyOnServer`
- `rememberPassword` if only the password screen uses it

Maybe keep if used elsewhere or notification-backed:

- `randomPW`

Good target shape:

- Run load and submit RPCs from the screen with `C.useRPC`
- Keep only truly shared password metadata if another part of the app consumes it

### `shared/stores/people.tsx`

Likely local:

- fetched People screen rows and follow suggestions
- transient resend / verification banners such as `resentEmail`
- screen-owned RPC orchestration for skip and dismiss actions

Maybe keep if another layer truly needs it:

- an engine-driven refresh trigger if the mounted People tab must react immediately to `homeUIRefresh`
- route-leave `markViewed` plumbing if it still needs a non-component home

Good target shape:

- Move rendered People data and action RPCs into the People feature layer
- Keep only the narrowest cross-cutting trigger in store, if any
- Do not keep notification-fed banner text in store just because a notification can set it

## Usually Keep Global

These stores are not automatic no-touch zones, but they need a stronger reason before pruning:

- `config`
- `current-user`
- `router`
- `waiting`
- `convostate`
- `fs`
- `teams`

They contain global caches, notification-driven state, navigation coordination, or app/session state that does not belong to a single screen.

## Route Param Patterns In This Repo

Common navigation shape:

```tsx
navigateAppend({name: 'devicePage', params: {deviceID}})
```

Common read shape:

```tsx
const {params} = useRoute<RootRouteProps<'peopleTeamBuilder'>>()
```

Use params for explicit handoff data such as IDs, usernames, booleans, prefilled values, and one-shot screen entry context.

## Stacked Commit Heuristics

Good stacked series:

1. One commit per store.
2. Keep each commit focused on a single screen flow.
3. Delete dead store code in the same commit that removes the last consumer.
4. Mention any intentionally retained global field in the summary so the next pass has context.

Bad stacked series:

- One commit that touches half the stores in `shared/stores`
- Moving state into components but leaving dead actions behind for later
- Replacing explicit route params with a new ad hoc store field
- Quietly dropping notification handlers because the current screen no longer needs them

# Store Checklist

Use this file as the running checklist for the stacked cleanup series.

Status:

- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[~]` intentionally skipped for now

## Smaller / Likely Early Passes

- [x] `archive` kept notification-backed chat/KBFS job caches plus engine/load plumbing; moved modal waiters, start RPCs, row action RPCs, and KBFS freshness lookup into settings components
- [x] `autoreset` kept badge-driven reset status plus reset pipeline entry/cancel logic; moved username/skip-password/has-wallet flow state into route params and removed dead confirm callback state
- [ ] `bots`
- [x] `crypto`
- [ ] `daemon`
- [x] `darkmode`
- [ ] `devices`
- [ ] `followers`
- [ ] `git`
- [ ] `inbox-rows`
- [x] `logout` kept handshake `version`/`waiters` in store; moved can-logout RPC and password redirect into settings hook
- [~] `modal-header`
- [ ] `notifications`
- [ ] `people`
- [ ] `pinentry`
- [ ] `profile`
- [ ] `provision`
- [x] `recover-password` kept only session callbacks plus `resetEmailSent`; moved recover-flow display state and navigation context into route params
- [ ] `settings`
- [ ] `settings-chat`
- [x] `settings-email` moved add-email submit/error state into components; kept notification-backed `emails`, `addedEmail`, and row actions in store
- [ ] `settings-notifications`
- [x] `settings-password` kept only `randomPW` in store; moved submit/load flows into settings screens
- [x] `settings-phone` kept notification-backed `phones` and `addedPhone`; moved add/verify/default-country flow into local hooks and route params
- [ ] `signup`
- [ ] `team-building`
- [ ] `tracker`
- [x] `unlock-folders` removed dead phase/device state; kept only engine callback forwarding into `config`
- [ ] `users`
- [ ] `wallets`

## Larger / More Global Stores

- [ ] `chat`
- [ ] `config`
- [ ] `convostate`
- [ ] `current-user`
- [ ] `fs`
- [ ] `router`
- [ ] `teams`
- [ ] `waiting`

## Platform-Specific Logical Stores

- [ ] `push`
  Files: `shared/stores/push.desktop.tsx`, `shared/stores/push.native.tsx`, `shared/stores/push.d.ts`
- [ ] `settings-contacts`
  Files: `shared/stores/settings-contacts.desktop.tsx`, `shared/stores/settings-contacts.native.tsx`, `shared/stores/settings-contacts.d.ts`

## Notes

- Track logical stores here, not `shared/stores/tests/*`.
- `store-registry.tsx` is infrastructure, not a target store.
- When a store is done, optionally append a short note with the commit hash or summary.

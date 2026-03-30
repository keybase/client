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
- [x] `bots` removed the store entirely; components now reload featured bot data directly from the local service as needed
- [x] `crypto`
- [x] `daemon` kept handshake/bootstrap coordination, waiter tracking, bootstrap status, and platform restart hooks in store
- [x] `darkmode`
- [x] `devices` removed the store; device history now loads in device screens, route params carry selected device data, and badge IDs moved into `modal-header`
- [x] `followers` kept current-user follow graph in store; notification-backed `followers`/`following` sets are shared across profile, tracker, chat, mentions, contacts, people suggestions, and desktop remote windows
- [x] `git` removed the store; git screens now own RPC/error state, config badgeState feeds per-repo badging, and route params carry repo context for chat/deletion flows
- [x] `inbox-rows` kept as a notification-driven derived cache for chat inbox row rendering; no screen-local state or RPC orchestration left to prune
- [x] `logout` kept handshake `version`/`waiters` in store; moved can-logout RPC and password redirect into settings hook
- [x] `modal-header`
- [x] `notifications` kept notification-driven badge aggregation, tray/widget badge state, and engine/init badge plumbing in store
- [x] `people` kept only `homeUIRefresh` / route-leave `markViewed` plumbing in store; moved fetched People rows, follow suggestions, skip/dismiss RPCs, and resend-email banner state into the People feature layer
- [x] `pinentry` kept daemon passphrase callback coordination, remote-window prompt state, and submit/cancel closures in store
- [x] `profile` kept proof/PGP listener callbacks plus shared navigation hooks in store; moved visible proof/PGP/revoke state and one-screen RPCs into route params or owning components
- [x] `recover-password` kept only session callbacks plus `resetEmailSent`; moved recover-flow display state and navigation context into route params
- [x] `settings` removed the store entirely; shared settings reload is now a feature helper and lockdown/developer/account actions live in their owning settings screens
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

- [ ] `provision`
- [ ] `chat`
- [x] `config` kept app/session/bootstrap state, engine plumbing, account/session coordination, startup routing, and window/app settings in store
- [ ] `convostate`
- [ ] `current-user`
- [ ] `fs`
- [ ] `router`
- [ ] `teams`
- [x] `waiting` kept shared waiting/error counters in store as cross-app infrastructure used by unrelated screens and stores

## Platform-Specific Logical Stores

- [ ] `push`
  Files: `shared/stores/push.desktop.tsx`, `shared/stores/push.native.tsx`, `shared/stores/push.d.ts`
- [ ] `settings-contacts`
  Files: `shared/stores/settings-contacts.desktop.tsx`, `shared/stores/settings-contacts.native.tsx`, `shared/stores/settings-contacts.d.ts`

## Notes

- Track logical stores here, not `shared/stores/tests/*`.
- `store-registry.tsx` is infrastructure, not a target store.
- This cleanup series moves linearly through the checklist by default. Take the first unchecked store unless a later note explicitly says otherwise.
- When a store is done, optionally append a short note with the commit hash or summary.

# Store Checklist

Use this file as the running checklist for the stacked cleanup series.

Status:

- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[~]` intentionally skipped for now

## Smaller / Likely Early Passes

- [ ] `archive`
- [ ] `autoreset`
- [ ] `bots`
- [ ] `crypto`
- [ ] `daemon`
- [ ] `darkmode`
- [ ] `devices`
- [ ] `followers`
- [ ] `git`
- [ ] `inbox-rows`
- [ ] `logout`
- [ ] `modal-header`
- [ ] `notifications`
- [ ] `people`
- [ ] `pinentry`
- [ ] `profile`
- [ ] `provision`
- [ ] `recover-password`
- [ ] `settings`
- [ ] `settings-chat`
- [ ] `settings-email`
- [ ] `settings-notifications`
- [x] `settings-password` kept only `randomPW` in store; moved submit/load flows into settings screens
- [ ] `settings-phone`
- [ ] `signup`
- [ ] `team-building`
- [ ] `tracker`
- [ ] `unlock-folders`
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

# RPC perf: what has been done, what is left

Snapshot of an ongoing effort to cut redundant client RPCs. Method and tooling
live in the `keybase-rpc-log-analysis` skill; this file is only the state.

Branch: `nojima/HOTPOT-fix-e2e-desktop`. All numbers below are the same e2e
suite (`yarn test:e2e:desktop`, 196 passed) against a locally built service, so
they are comparable to each other and to anything you capture next.

## Where it stands

| metric | start | now |
|---|---|---|
| service time | 738.9s | **289.5s** |
| total HTTP | 1420 | **521** |
| `GetAnnotatedTeam` | 320 | **88** |
| `team/get.json` | 164 | **34** |
| `Identify3` | 42 | **3** |
| third-party proof GETs | 73 | **4** |
| `refreshParticipantsRemote` | 5480 | **192** |

## Fixed

Go:
- `chat/participantsource.go` — 5 min freshness window; was a remote round trip
  per conversation on every localization.
- `chat/emojisource.go` — hoisted a per-emoji gregor read out of two loops,
  dropped a duplicate attachment URL lookup.
- `chat/search/storage.go` — indexer batches superseded-message fetches; was
  14,621 single-message reads in one run.
- `teams/annotated_cache.go` — memo + single-flight, 10s TTL, invalidated from
  `NotifyRouter.HandleTeamChangedByID`.
- `libkb/proof_cache.go` — single-flight for concurrent identical proof checks,
  gated so a caller only joins a check that started at or after it asked.
- `uidmap/uidmap.go` — one-line correctness fix, disk-hit path returned nil.

JS:
- `teams/team/index.tsx` — prime channel participants once per conversation.
- `teams/common/channel-hooks.tsx`, `general-conv.tsx`, settings-tab hooks —
  module-level shared caches instead of per-instance.
- `profile/user/teams/index.tsx` — `loadOnDemand`, the single biggest win: a
  profile annotated every team you are in for hover popups nobody opened.
- `tracker/identify-session.tsx` — one identify per username shared by every
  surface, engine listeners registered once, 30s recheck window.
- 11 `useSafeFocusEffect` callsites stabilised; `engine/action-listener.tsx`
  stale-unsubscribe fix.
- 16 module-level caches now clear on sign-out.

## Open, in the order I would take them

1. **`GetTLFConversationsLocal`** — 108 of the remaining 192 remote participant
   refreshes. The ~107-channel fan-out per call is inherent to the RPC, so the
   lever is calling it less often, not making it cheaper. Currently a 5s stale
   window per team.
2. **`GetMutualTeamsLocal`** — the other 84. Fires from the profile's "teams in
   common".
3. **UIDMap holds a process-global mutex across its network call**
   (`uidmap/uidmap.go:356` takes the lock, `:388` calls the server still holding
   it). Harmless on a warm cache — measured at 0.16s for 15,767 calls — but on a
   cold one a large team load would serialise N `user/names` POSTs while
   blocking every other UIDMap consumer. Latent, worth more than the 0.16s.
4. **`use-loaded-team.tsx:127`** — 5s stale window plus forced `reload()` on
   three notifications with no debounce, unlike `use-teams-list.tsx:110` which
   coalesces over 2s. Suspected source of the single-team load tail.
5. **`contacts-joined.tsx` FollowButton** — one forced identify per row, for a
   different user each. Does not fire on an account with no phone contacts, so
   unmeasured here. `untrack(username)` needs no identify, so unfollow could
   skip it entirely; follow genuinely needs a session outcome.

## Measured and deliberately not fixed

- **UIDMap lookups** — 15,767 calls, 0.16s total, zero network. Its own tracing
  costs more than the work.
- **`teams/storage.Generic#Get missed (hidden)`** — 7,284 misses, 0.24s. Those
  teams have no hidden chain; the miss is the correct answer.

## Watch out

- Third-party proof counts: match `GET https://host`, not the hostname. Lines
  that merely mention the host inflated an earlier count roughly 8x.
- A capture is only comparable if the run did the same work. Same suite, kbfs
  running, and the keychain prompt already accepted.

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
- `teams/common/use-loaded-team-channels.tsx` — one module-level cache instead of
  a per-consumer one. **`GetTLFConversationsLocal` 44 -> 16** in the same suite.
  All 44 were the same team, including 7 inside 1.5s, with no `teamChangedByID`
  in the window: `useCachedResource` has a real `staleMs` window *and* real
  single-flight, but both live on the cache object, and every consumer outside a
  `LoadedTeamChannelsProvider` got a private map. That matters out of proportion
  to the call count — this RPC rooted 4693 of 7421 `localizerPipeline` spans
  (63%, the most expensive line in the run at 134.5s) and 4607 `GetMessages`
  spans, and that work does not cache away: 430 spans at 21:08:23 light, 430
  again at 21:09:45 dark.

  **Sharing the cache exposed a latent staleness bug — read this before doing the
  same to another loader.** Creating or deleting a channel fires no
  `teamChangedByID`, so nothing dropped the channel list. Per-instance caches hid
  that: every remount refetched, which is exactly what
  `team-wizard-channel.test.ts` relied on ("the channels list doesn't always
  live-refresh — re-enter the tab"). With one shared cache the remount finds an
  entry ~3s old, inside the 5s window, and serves the pre-create list — the test
  went flaky and the service log showed *zero* `GetTLFConversationsLocal` for the
  33s between the create and the retry. Fixed with an explicit invalidation on
  create and delete, routed through the leaf module
  `teams/common/team-channels-invalidation.tsx`: the screen that actually creates
  channels is chat's (`chat/create-channel/hooks.tsx`, route `chatCreateChannel`),
  not the `teamCreateChannels` wizard, and chat cannot import
  `use-loaded-team-channels` directly without pulling in the
  `channel-hooks -> @/constants -> constants/router -> router-v2/routes ->
  chat/routes -> teams/common` cycle that has broken team rendering on iOS.

## Open, in the order I would take them

1. **`use-loaded-team-channels.tsx:66-87` has no debounce.**
   `useReloadOnTeamChannelChanges` calls a forced `reload()` on every
   `teamChangedByID`, where `use-teams-list.tsx:93-128` coalesces the same
   burst over 2s (`{leading: true, trailing: true}`) with a comment noting one
   logical change fires metadata, role map and changedByID. Transplanting that
   is correct on its own merits, but **it is not an RPC-count fix** — measured,
   no `teamChangedByID` fired during the 44-call burst at all. Do not expect it
   to move any number in the table above.

2. **UIDMap holds a process-global mutex across its network call**
   (`uidmap/uidmap.go:356` takes the lock, `:388` calls the server still holding
   it). Harmless on a warm cache — measured at 0.16s for 15,767 calls — but on a
   cold one a large team load would serialise N `user/names` POSTs while
   blocking every other UIDMap consumer. Latent, worth more than the 0.16s.
3. **`use-loaded-team.tsx:127`** — same undebounced forced `reload()` as item 1,
   in the team loader rather than the channel loader. Suspected source of the
   single-team load tail. Check it for the fragmented-cache bug fixed in
   `use-loaded-team-channels.tsx` too; it uses the same `useCachedResource`
   helper, so a per-instance map would defeat its dedupe the same way.
4. **`contacts-joined.tsx` FollowButton** — one forced identify per row, for a
   different user each. Does not fire on an account with no phone contacts, so
   unmeasured here. `untrack(username)` needs no identify, so unfollow could
   skip it entirely; follow genuinely needs a session outcome.

## Measured and deliberately not fixed

- **UIDMap lookups** — 15,767 calls, 0.16s total, zero network. Its own tracing
  costs more than the work.
- **`teams/storage.Generic#Get missed (hidden)`** — 7,284 misses, 0.24s. Those
  teams have no hidden chain; the miss is the correct answer.
- **The 192 remote participant refreshes are one cold fan-out each, not a
  frequency problem.** 108 root to `GetTLFConversationsLocal` and 84 to
  `GetMutualTeamsLocal`, but per-second they land as two bursts: ~106 from a
  single call at 21:08:01, and 84 from a single call at 21:07:16. The other 43
  `GetTLFConversationsLocal` calls cost *zero* remote refreshes — the whole dark
  run spent 2 — because the 5 min window from the `participantsource.go` fix was
  warm. `CachingParticipantSource` is at a 96.7% hit rate (5,816 calls, 192
  remote, 3.97ms mean). Calling the RPC less often will not move this number —
  confirmed after the fix below cut the call count to 16, `refreshParticipantsRemote`
  stayed at exactly 192. What calling it less often *does* recover is the
  localization cost.
- **`PresentParticipantsModeSkip` is not the lever.** `server.go:1813` passes
  `ModeInclude`, but `utils.go:1587-1591` shows that mode only formats
  `rawConv.Info.Participants` — it does not fetch. The fan-out is upstream in
  `GetChannelsFull`'s per-channel localization.
- **`getMessagesRemote`** — 1942 of 2220 remote calls, but 3602 of 3729 spans
  have no app RPC above them and the driver is `Storage: FetchMessages` at a
  sustained ~41/s. Service-side background indexer work, not client-driven.
- **`ChatArchiveRegistry`** — exactly one 30.0s span, at startup (21:04:08). The
  round number smells like a timeout, but it did not recur. Note, do not chase.
- **`merkle/path.json`** — 213 requests, the top HTTP line, but spread with
  peaks of only 16/s. No burst to attribute.

## Watch out

- Third-party proof counts: match `GET https://host`, not the hostname. Lines
  that merely mention the host inflated an earlier count roughly 8x.
- A capture is only comparable if the run did the same work. Same suite, kbfs
  running, and the keychain prompt already accepted.
- kbfs runs as **`kbfsfuse`**, so `pgrep -x kbfs` reports it as down when it is
  up. The service forks it with `-mount-type=none`, which is also why `keybase
  status` shows an empty `mount:`. Neither is a fault.
- `start-service.sh` must be invoked through the real `skill/` path, not the
  `.claude/skills` symlink — it derives the repo root with `../../..` from
  `BASH_SOURCE`, which resolves against the symlink and lands in `.claude/`.
- The suite itself is ~2.7 min. A capture spanning 20 min contains other work;
  totals are not comparable across the two. Between-run cache warmth swings the
  totals hard — the same code gave 5,470s of service time on a cold run and
  940s on a warm one. Compare per-RPC counts, not totals.

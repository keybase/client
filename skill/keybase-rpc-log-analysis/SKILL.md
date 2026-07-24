---
name: keybase-rpc-log-analysis
description: Use when hunting redundant, duplicated or looping RPCs in the Keybase client — after a rate-limit error, a service log that rotates every few minutes, a slow or hot app, or to prove a caching fix actually reduced calls. Covers capturing a clean service log against a locally built service and reading it.
---

# Keybase RPC log analysis

The Go service logs every RPC it serves and every call it makes. That log is the
only place the client's real network behaviour is visible — the JS side shows
intent, the log shows what actually went out. A quiet minute is ~45 lines; a
minute with a flood is 120,000.

## Capture a clean run

```bash
skill/keybase-rpc-log-analysis/scripts/clean-logs.sh --archive   # dry run without a flag
skill/keybase-rpc-log-analysis/scripts/start-service.sh          # own terminal, foreground
cd shared && yarn desktop:start:hot:e2e                          # another terminal
cd shared && yarn test:e2e:desktop                               # or drive the app by hand
```

`start-service.sh` builds from this checkout, stops the running service, and logs
with `-d --log-file` to `/tmp/kb-analysis/service.log`. Its own file matters: the
default log rotates at 128MB, and a real flood rotates the evidence away in under
two minutes.

Ask before stopping the service or launching the app — both are the user's.

## Read it

| Question | Command |
|---|---|
| What did this run do? | `rpc-report.py <log> [--start 2026-07-24T17:23] [--end ...]` |
| Why is X called so much? | `rpc-why.py <log> --match 'AttachmentHTTPSrv: GetURL'` |
| Did my fix work? | `rpc-diff.py before.log after.log` |

Analysing an already-rotated log is the same — pass
`~/Library/Logs/keybase.service.log-<start>-<end>` directly. The filename carries
its own window, so `--start/--end` are only for narrowing further.

Read `rpc-report.py`'s sections in order:

- **REMOTE** — service→server. Only these burn server rate limits. Start here.
- **APP** — app→service. One of these usually explains a REMOTE row.
- **BURSTS** — same call and subject, 3+ times in one second. Each row is a
  missing cache or a remounting component.
- **FLOODS** — most repeated lines, ids and numbers collapsed.

A BURSTS row with a bare name and no `(subject)` means the subject could not be
resolved: many RPCs log no arguments. Those rows are same-*name* only — treat
them as a lead, not as proof the same conversation was hit twice.

`rpc-why.py` answers attribution. **ROOT** (the app RPC that opened the trace) is
usually the answer; **DRIVERS** (nearest preceding call) points at the specific
line. **BATCHES** needs the span that logs the item count, which is normally the
local one, not the remote it wraps — match `HybridConversationSource: GetMessages`,
not `getMessagesRemote`. The script says so when it finds no counts.

## What a bug looks like

- **Same args, same second, N times** → no dedupe, or a keyed component remounting
  as its props arrive in stages.
- **Fires again the instant the previous lands** → a feedback loop, not user
  action. Look for a cache that never records success, or an effect whose deps
  change on every render.
- **Batch sizes almost all 1** → the caller loops where it could fetch once.
- **A per-item cost inside a loop** → e.g. a gregor state read per emoji.

## Mistakes

- **Attributing to the child call.** The line directly above a flood is often
  something the flood itself invoked. Trust ROOT over DRIVERS.
- **Blaming the biggest number.** Service-side background work — the search
  indexer especially — can dwarf the real bug. An empty ROOT means nothing asked
  for it. Check whether it recurs on a timer before spending time on it.
- **Reporting a burst as same-subject when it is not.** See the BURSTS caveat
  above. If it matters, prove the subject repeats before claiming it.
- **Using plain `grep`.** It is wrapped in this environment and truncates. Use
  python, as the scripts do.
- **Comparing unlike runs.** `rpc-diff.py` is only meaningful if both runs did
  the same thing.

## Shapes seen before

Each of these was a real bug, and each is what its section looks like:

- An app RPC in the thousands where the screen has tens of items — a per-item
  prime re-run on every list reload.
- A local call in the low single digits dragging thousands of lines behind it — a
  per-item cost inside a server-side loop.
- FLOODS dominated by one span whose BATCHES are almost all size 1.
- An APP row whose count is a multiple of the number of times a screen was
  opened — a component keyed on data that arrives in stages, remounting.

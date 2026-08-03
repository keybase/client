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
cd shared && yarn test:e2e:desktop:rpc                           # or drive the app by hand
```

`start-service.sh` builds from this checkout, stops the running service, and logs
with `-d --log-file` to `/tmp/kb-analysis/service.log`. Its own file matters: the
default log is shared with everything else and a flood rotates the evidence away
in under two minutes.

**Use `test:e2e:desktop:rpc`, not `test:e2e:desktop`.** The full suite is 6.6
minutes over two projects (light and dark), which doubles every count and makes
the log rotate. `test:e2e:desktop:rpc` is the six flows that actually drive team
and channel loading, on one project, in 39 seconds. `test:e2e:desktop:flows`
takes file arguments if you need a different set — always pass a single
`--project` (it does), or light and dark each contribute a copy of every call.

`--log-file` **still rotates at 128MB** — a full e2e run produces ~135MB and will
cross it. Nothing is lost, but the analysis must then include the siblings, so
pass them all:

```bash
python3 skill/keybase-rpc-log-analysis/scripts/rpc-report.py \
  /tmp/kb-analysis/service.log-* /tmp/kb-analysis/service.log
```

Rotation is easy to miss: a script that reads only `service.log` after a long run
silently analyses the tail. Check `ls -la /tmp/kb-analysis/` before believing a
count.

The service forks kbfs from its own bin directory, and a plain `go install` of
the service does not build it. Without kbfs the Files tab is empty and git
fails with `KBFS client not found`, which fails every `files-*` and `git-*` e2e
test for reasons unrelated to the change under test. `start-service.sh` warns.
Note the installed kbfs keeps the mount when the service is swapped for a local
build, so those tests can fail even with a `kbfs` binary in place — they are not
in the `test:e2e:desktop:rpc` set for that reason.

Ask before stopping the service or launching the app — both are the user's.

## Prove a fix

A before/after is only worth reporting if both runs did the same thing. What
works:

```bash
# after: with the fix in the tree
<reload the renderer>; : > /tmp/kb-analysis/service.log
cd shared && yarn test:e2e:desktop:rpc
cp /tmp/kb-analysis/service.log /tmp/kb-analysis/after.log

# before: revert ONLY the source changes, keeping any new test scripts
git stash push -- <the source files you changed>
<reload the renderer>; : > /tmp/kb-analysis/service.log
cd shared && yarn test:e2e:desktop:rpc
cp /tmp/kb-analysis/service.log /tmp/kb-analysis/before.log
git stash pop
```

- **Stash by path, not wholesale.** If the fix added the very npm script the
  capture runs, a bare `git stash` takes it with them.
- **Hard-reload the renderer between runs** (CDP `page.reload()` on
  `localhost:9222`). Module-level caches — the usual subject of these fixes —
  survive HMR, so without a reload the second run starts warm and reads better
  than it is.
- **The service does not need rebuilding** between runs for a JS-only fix. Leave
  it up; only truncate its log.
- Counting straight out of the log beats `rpc-diff.py` when you already know
  which calls you are watching: parse `+ Server: <Name>` / `+ RemoteClient:
  chat.1.remote.<name>`, and count how many landed within the hook's own
  `staleMs` of the previous call for the same subject. That last number is the
  one that says "this was a cache miss" rather than "this was work".

## Read it

| Question | Command |
|---|---|
| What did this run do? | `rpc-report.py <log> [--start 2026-07-24T17:23] [--end ...]` |
| What was actually slow? | `rpc-cost.py <log> [--min-mean-ms 50]` |
| Why is X called so much? | `rpc-why.py <log> --match 'AttachmentHTTPSrv: GetURL'` |
| Did my fix work? | `rpc-diff.py before.log after.log` |

**Run `rpc-cost.py` early.** Count and cost answer different questions, and the
loudest line in the log is usually not the expensive one. In one capture the top
line by count was an in-memory map lookup — 15,767 calls for 0.16s total, not
worth touching — while the real cost was 469 team loads at 292ms each, 186
seconds, sitting 30th by count.

To *prove* a loud flood is free rather than just absent from the table, pass
`--min-mean-ms 0 --top 400`: the default threshold hides cheap chatty ops, which
is exactly the row you need. `AttachmentHTTPSrv: GetURL` at 4,848 calls does not
appear at all by default, and shows as 0.04s total once it does.

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

- **Guessing the trigger from neighbouring lines.** A burst surrounded by
  startup-looking work is not necessarily startup. Correlate against something
  independent: the mtimes of `shared/tests/results/test-results/*/test-finished-1.png`
  give you a timestamped list of which test ran when, and `app.log` records
  renderer reloads. One burst-per-profile-open and one burst-per-bootstrap look
  identical in the service log until you check.
- **Attributing to the child call.** The line directly above a flood is often
  something the flood itself invoked. Trust ROOT over DRIVERS.
- **Reading a count that went to zero as a win.** A call that disappears may have
  been *dropped*, not deduped. Before claiming it, check what the baseline calls
  actually did: pull their `chat-trace` out of the before-log and count the work
  hanging off it. Two `getMutualTeamsLocal` calls here went to 0 after a guard on
  "empty argument list" — and their traces showed 82 remote refreshes and 750ms
  each, so the service treats the empty case as a real query and the guard was
  removing a feature, not a redundancy. A real dedupe takes N to 1, not to 0.
- **Forgetting that one call's result is another call's input.** Suppressing a
  call suppresses everything downstream of it, so an unrelated-looking count
  improves for the wrong reason. `getAnnotatedTeam` read 3 in the run where
  mutual teams was wrongly suppressed and 11 in both runs where it was not —
  because the shared teams it returns are what then get loaded. If a metric you
  did not touch moves, find out which call upstream stopped happening.
- **Reading a fix as failed because the totals did not move.** If the app's
  request volume changed between runs, a working cache can show flat server
  counts. Count what the cache actually did — a hit rate, a log line — before
  concluding anything. One cache here looked useless in one capture and turned
  out to be a 79% reduction once the volume feeding it was fixed.
- **Fixing what you have not measured.** Two of the loudest floods in this
  log — 15,767 username lookups and 7,284 chain-storage misses — were worth
  0.16s and 0.24s. Both were correctly left alone. `rpc-cost.py` first.
- **Blaming the biggest number.** Service-side background work — the search
  indexer especially — can dwarf the real bug. An empty ROOT means nothing asked
  for it. Check whether it recurs on a timer before spending time on it.
- **Reporting a burst as same-subject when it is not.** See the BURSTS caveat
  above. If it matters, prove the subject repeats before claiming it.
- **Using plain `grep`.** It is wrapped in this environment and truncates. Use
  python, as the scripts do.
- **Comparing unlike runs.** `rpc-diff.py` is only meaningful if both runs did
  the same thing — same tests, same order, same project, renderer reloaded
  between them. See "Prove a fix".

## Shapes seen before

Each of these was a real bug, and each is what its section looks like:

- An app RPC in the thousands where the screen has tens of items — a per-item
  prime re-run on every list reload.
- A local call in the low single digits dragging thousands of lines behind it — a
  per-item cost inside a server-side loop.
- FLOODS dominated by one span whose BATCHES are almost all size 1.
- An APP row whose count is a multiple of the number of times a screen was
  opened — a component keyed on data that arrives in stages, remounting.
- **A list row eagerly loading what only its hover popup needs.** The single
  biggest win here was one `loadOnDemand` flag: a profile rendered a row per
  team and each row annotated its team up front, for a popup nobody opened.
- **A hook that subscribes to a broadcast per component instance.** One
  notification then does N times the work, and if the work itself emits that
  notification it compounds. Subscribe once at module scope and fan out.
- **The same expensive load repeated because each surface holds its own copy.**
  Two or three components asking for the same user or team at the same instant
  is the common case, not the rare one.
- **Two identical calls the same microsecond apart.** Not a race — two *caches*.
  Either the hook falls back to a per-instance map (so every provider and every
  provider-less consumer holds its own), or two different hooks issue the same
  RPC with the same arguments from separate module caches and cannot see each
  other's in-flight request. Both were live in this client at once. Grep the
  codebase for the RPC name: more than one call site that is not a shared hook is
  the tell.
- **Calls landing inside their own stale window.** If a hook declares
  `staleMs: 5_000` and most of its calls arrive under 5s after the previous one
  for the same subject, the cache is not being shared — the window is doing
  nothing because each caller has a fresh copy of it. This ratio is the single
  most useful derived number here; 81% for `getAnnotatedTeam` is what found that
  bug.

Where the money actually is in this client: identify/proof checks and team
loads. Both are hundreds of milliseconds each and both fan out to several HTTP
calls. Chat localization is cheap per call but runs over every channel.

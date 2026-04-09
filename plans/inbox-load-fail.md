# requestInboxUnbox Outstanding Session Investigation

## Context

Issue observed in Electron:

- `outstandingSessionDebugger` repeatedly logged `chat.1.local.requestInboxUnbox`
- the logs appeared in the renderer
- the problem showed up after startup / after entering Chat

The issue stopped reproducing after restarting the Go daemon.

## Repro Flow Used

1. Start the app clean.
2. Let startup settle.
3. Clear renderer and node logs.
4. Click into Chat.
5. Wait for `outstandingSessionDebugger`.
6. Pick the reported renderer `sessionID`.
7. Correlate that session to the transport `seqid` from renderer logs.

Example stuck pairs we tracked:

- `sessionID: 180` -> `seqid: 57`
- `sessionID: 181` -> `seqid: 58`
- `sessionID: 183` -> `seqid: 60`

## What We Confirmed

### 1. The outstanding sessions were real renderer engine sessions

For a stuck case we saw:

- renderer `session start {sessionID: ...}`
- renderer `invokeNow {seqid: ..., sessionID: ...}`
- no matching renderer `session end {sessionID: ...}`

So this was not just noisy transport logging. The renderer engine session really remained open.

### 2. The inner UI callback path was working

For `chat.1.chatUi.chatInboxConversation` we saw:

- incoming invoke in renderer
- renderer sending `response.result()`
- node receiving that response

So the nested UI callback ack path was functioning during investigation.

### 3. The generic JS request path was functioning

For successful `requestInboxUnbox` calls we saw the full path:

- renderer started engine session
- renderer invoked outer RPC with a `seqid`
- main received invoke
- node wrote invoke to daemon
- node received outer response from daemon
- renderer matched the response
- renderer ended the engine session

So the JS RPC path was capable of closing these sessions normally.

### 4. Some specific outer requests never produced a closing response during the bad runs

For stuck cases like `181/58` and `183/60`, the important pattern was:

- renderer started session
- renderer sent invoke
- main received invoke
- node wrote invoke to daemon
- no corresponding renderer session end

During some bad runs, the decisive missing line for the stuck `seqid` was:

- no `node received response from daemon ... seqid: <stuck seqid>`

That means the stuck session was not explained by renderer bookkeeping before send.

### 5. The issue disappeared after restarting the Go daemon

After restarting the daemon, the problem stopped reproducing.

That materially weakens the hypothesis that the root cause is a deterministic bug in the new JS RPC implementation alone.

## What We Tried On The JS Side

These were investigated and then removed:

- temp renderer/session logs in the engine layer
- temp transport logs in renderer and node
- temp bridge logs across Electron IPC
- temporary response normalization changes (`undefined` -> `null`)
- temporary bridge framing / chunk normalization experiments
- temporary `requestInboxUnbox` special-casing

None of those produced a confirmed fix.

The temporary instrumentation has been cleaned up.

## Strongest Current Interpretation

The best-supported explanation from the investigation is:

- the renderer session stayed outstanding because the outer `requestInboxUnbox` RPC did not complete for some requests
- in bad runs, the request had already crossed renderer -> main -> daemon write
- the missing completion signal was at or after daemon handling, not before renderer send
- restarting the daemon made the issue disappear

That makes a daemon-side or daemon-state issue the strongest next lead.

## Service Log Follow-Up

We checked:

- `/Users/ChrisNojima/Library/Logs/keybase.service.log`

Important caveat:

- this log was later identified as coming from the wrong machine / wrong daemon instance for the bad repro
- so it should not be treated as evidence that the bad run itself completed normally
- it is still useful for understanding the structure of the Go path and the kinds of daemon-side interactions that can delay `RequestInboxUnbox`

### What The Service Log Added

The service log did **not** show a direct reproduction of:

- `+ Server: RequestInboxUnbox`
- no matching `- Server: RequestInboxUnbox -> ok`

In the ranges inspected, every `RequestInboxUnbox` entry returned.

However, the service log did show a strong interaction between:

- `Server: GetThreadNonblock(...)`
- inbox localizer suspension
- concurrent `RequestInboxUnbox`

### Repeated Pattern In Service Logs

In several runs, the sequence was:

1. `GetThreadNonblock(...)` starts.
2. `SuspendComponent: canceled background task` appears.
3. `localizerPipeline: suspend` runs.
4. concurrent `RequestInboxUnbox` starts.
5. its job reaches:
   - `localizerPipeline: localizeJobPulled: waiting for resume`
6. only after `GetThreadNonblock(...) -> ok` does the unbox localizer resume and the outer `RequestInboxUnbox` return.

Representative examples:

- around `2026-04-08 10:39:02 -04:00`
- around `2026-04-08 10:46:56 -04:00`
- around `2026-04-08 17:14:03 -04:00`

### Concrete Example: Slow But Completing Unbox

At `2026-04-08 10:39:02 -04:00`:

- `GetThreadNonblock(000030...)` starts
- it suspends the localizer
- `RequestInboxUnbox` for the same conv starts
- the unbox job logs `waiting for resume`
- `GetThreadNonblock` returns after about `609ms`
- then `RequestInboxUnbox` returns after about `611ms`

This is a daemon-side confirmation that `RequestInboxUnbox` can be blocked behind thread-load suspension.

### Concrete Example: Cancellation / Re-enqueue Storm

At `2026-04-08 10:46:56 -04:00`:

- `GetThreadNonblock(000030...)` suspends the localizer
- multiple lines appear:
  - `localizerPipeline: localizeJobPulled: canceled a live job`
  - `localizerPipeline: localizeConversations: context is done, bailing`
  - `localizerPipeline: localizeJobPulled: re-enqueuing canceled job`
  - `localizerPipeline: localizeJobPulled: waiting for resume`
- a concurrent `RequestInboxUnbox` for the same conv also enters `waiting for resume`
- it eventually returns, but only after resume

This did not wedge in the captured log, but it is the clearest daemon-side evidence of a fragile path.

### Updated Go-Side Interpretation

The best current Go-side explanation is now narrower:

- `RequestInboxUnbox` is not independently blocked on UI callback ack in the daemon
- it is blocked on inbox localizer progress
- `GetThreadNonblock` can suspend and cancel localizer work
- concurrent thread loading and inbox unboxing share the same localizer machinery
- a daemon-side wedge in suspend/resume or cancel/re-enqueue handling remains a strong candidate for the runs where the outer response never came back

### Specific Go Areas Now Most Suspicious

1. `GetThreadNonblock` suspending the inbox source/localizer during thread load
2. `localizerPipeline.suspend/resume`
3. `localizerPipeline.localizeJobPulled`
4. cancel/re-enqueue behavior after `context canceled`
5. whether a resumed or retried job can be left waiting forever if resume signaling or pending/completed bookkeeping goes wrong

## Correct-Machine Service Logs

We later checked the actual machine logs:

- `/Users/ChrisNojima/Downloads/logs/keybase.service.log`
- `/Users/ChrisNojima/Downloads/logs/keybase.service.log-20260408T180719-0400-20260408T181728-0400`

These logs materially strengthen the same Go-side suspicion.

### What These Logs Confirm

They show that on the real machine:

- `GetThreadNonblock(...)` does suspend the inbox source/localizer
- concurrent inbox-unbox jobs do enter `localizerPipeline: localizeJobPulled: waiting for resume`
- live localizer jobs can be canceled during that suspension
- canceled jobs can be re-enqueued and later resumed

So the previously suspected thread-load/localizer interaction is not just theoretical.

### Concrete Example: Thread Load Cancels Live Localizer Work

Around `2026-04-08 17:34:59 -04:00` in the rotated log:

1. `Server: GetThreadNonblock(...)` starts.
2. `SuspendComponent: canceled background task` appears.
3. `localizerPipeline: suspend` runs.
4. live localizer workers log:
   - `localizerPipeline: localizeJobPulled: canceled a live job`
   - `RemoteClient: chat.1.remote.getMessagesRemote -> ERROR: context canceled`
   - `localizerPipeline: failed to transform message ... context canceled`
5. a concurrent inbox-unbox trace enters:
   - `localizerPipeline: localizeJobPulled: waiting for resume`
6. only after `GetThreadNonblock(...) -> ok [time=205.738625ms]` do we see:
   - `localizerPipeline: resume`
   - `localizerPipeline: localizeJobPulled: resume, proceeding`

That is direct daemon evidence that inbox unbox work can be paused behind thread loading and only released on resume.

### Concrete Example: Slow RequestInboxUnbox Without Obvious Error

Around `2026-04-08 18:21:46 -04:00` in the current log:

- two `RequestInboxUnbox` traces (`tu-3DgB67sGd` and `WTZ2nhFPsZAr`) both enter:
  - `localizerPipeline: localizeJobPulled: waiting for resume`
- both then resume and spend roughly `736ms` in `localizeConversations`
- both outer RPCs finally return in about `737ms`

This shows two important things:

- the outer RPC really is waiting on localizer progress
- the visible stall can be a combination of suspend/resume delay plus expensive per-conversation localization work

### What We Have Not Yet Seen

In the sampled correct-machine log windows, we have not yet isolated:

- a `RequestInboxUnbox` that entered and never produced `-> ok`
- a `resume: spurious resume call without suspend`

So the logs do not yet prove the exact permanent wedge. They do prove the fragile path that could plausibly cause it.

## Narrowed Go Hypothesis

Given the code and the correct-machine logs, the strongest daemon-side wedge theory is now:

1. `RequestInboxUnbox` calls `UIInboxLoader.UpdateConvs`
2. `UpdateConvs` calls `LoadNonblock`
3. `LoadNonblock` does not return until the localizer callback channel closes
4. localizer jobs marked cancelable can block in `localizeJobPulled: waiting for resume`
5. `resume()` only releases those waiters when `suspendCount` drops all the way back to zero

That means an unmatched or leaked suspend would strand every future waiting localizer job indefinitely.

If that happens:

- the localizer callback channel never finishes
- `LoadNonblock` never returns
- `RequestInboxUnbox` never returns an outer response
- because `RequestInboxUnbox` swallows normal `UpdateConvs` errors, the renderer would just observe an outstanding request rather than a useful failure

### Most Specific Code-Level Candidate Now

The cleanest permanent-hang mechanism is:

- `GetThreadNonblock` enters `defer h.suspendInboxSource(ctx)()`
- the inbox localizer `suspendCount` is incremented
- cancelable localizer jobs queue up in `waiting for resume`
- for some path or nesting combination, the matching `resume()` does not drive `suspendCount` back to zero
- the waiters are never closed
- the outstanding `RequestInboxUnbox` stays open until daemon restart resets that state

This is now the main Go-side hypothesis to verify against the next bad-run log.

## Code Audit Follow-Up

After digging further into the Go code, the strongest explanation shifted slightly:

- the most likely wedge is no longer just a leaked `suspendCount`
- a stuck `GetThreadNonblock` path can itself keep the inbox localizer suspended forever

### Why GetThreadNonblock Is So Dangerous Here

`GetThreadNonblock` does:

- `defer h.suspendInboxSource(ctx)()`

That means inbox-source resume does **not** happen when thread payloads are first sent to the UI.
It only happens when `UIThreadLoader.LoadNonblock(...)` fully returns.

So if `LoadNonblock(...)` wedges anywhere, the inbox localizer remains suspended the whole time.

### Important Detail: Thread Load Continues After UI Delivery

`UIThreadLoader.LoadNonblock(...)` does more work after sending the full thread to the UI:

1. waits for the local/full goroutines with `wg.Wait()`
2. logs `thread payloads transferred, checking for resolve`
3. resolves skipped unboxeds / validation work
4. performs final status clearing
5. only then returns

This matters because:

- the UI may already look "done"
- but the inbox source is still suspended
- so concurrent `RequestInboxUnbox` jobs can still sit in `waiting for resume`

### Conversation Lock Coupling

The thread loader also grabs a conversation lock for the full lifetime of `LoadNonblock(...)`:

- `ConvSource.AcquireConversationLock(...)`
- defer release only when `LoadNonblock(...)` returns

The same underlying lock is used by conversation-source operations that the inbox localizer calls, including:

- `ConvSource.GetMessages(...)`
- `ConvSource.GetMessagesWithRemotes(...)`
- other pull/push/expunge paths

So thread loading and inbox localization are contending on the same per-conversation lock.

### Lock Behavior That Makes This Risky

`ConversationLockTab.Acquire(...)` ultimately blocks on a plain `sync.Mutex`:

- it does not select on `ctx.Done()`
- there is no timeout once it is waiting on the mutex itself

So if one trace grabs the conversation lock and wedges before release:

- later thread work for that conv can block forever
- later inbox-localizer work for that conv can block forever
- and if the wedged holder is `GetThreadNonblock`, inbox-source resume never fires

That is a very strong match for:

- issue appears after entering Chat
- some `requestInboxUnbox` requests never complete
- daemon restart clears the problem

## Revised Leading Hypotheses

From code inspection, the leading Go-side possibilities are now:

1. `GetThreadNonblock` hangs before its deferred inbox-source resume runs
2. a conversation lock is held indefinitely by thread-loading or message-fetch code
3. a localizer worker hangs inside `localizeConversation(...)` after the initial inbox callback
4. a true suspend-count / waiter-state leak in the localizer pipeline

### Strongest Current Candidate

The strongest candidate is now:

- `GetThreadNonblock` suspends the inbox source
- `UIThreadLoader.LoadNonblock(...)` acquires the conversation lock
- thread loading wedges somewhere under that lock or in its post-send validation phase
- deferred inbox-source resume never runs
- `RequestInboxUnbox` jobs remain stuck in `waiting for resume`

This is a simpler explanation than a pure `suspendCount` imbalance and fits both the logs and the code structure better.

## New Strong Code-Only Candidate: Blocking Thread-Status UI RPC

There is an even more specific way `GetThreadNonblock` can wedge:

- `UIThreadLoader.LoadNonblock(...)` uses `setUIStatus(...)`
- `setUIStatus(...)` eventually calls `chatUI.ChatThreadStatus(context.Background(), status)`
- `cancelStatusFn()` then waits for that goroutine to report whether the status was displayed

This is important because:

- `ChatThreadStatus(...)` is not fire-and-forget; it is a blocking RPC call through `ChatUiClient`
- it is invoked with `context.Background()`, not the request context
- if that UI RPC blocks, the goroutine never reports back on `resCh`
- `cancelStatusFn()` blocks forever waiting on `resCh`
- `UIThreadLoader.LoadNonblock(...)` then never returns
- `GetThreadNonblock` never reaches its deferred inbox-source resume
- `RequestInboxUnbox` jobs can remain stuck in `waiting for resume`

### Why This Fits The User-Visible Symptom

This is especially plausible because `LoadNonblock(...)` can already have sent the thread to the UI before the wedge happens.

So the UI can look mostly usable while the daemon is still:

- inside `GetThreadNonblock`
- holding the inbox source suspended
- blocking later inbox-unbox RPCs

### Related Risk In Final Status Clearing

At the end of `LoadNonblock(...)`, final status clearing also calls:

- `chatUI.ChatThreadStatus(context.Background(), validated)`
- or `chatUI.ChatThreadStatus(context.Background(), none)`

Those are also blocking UI RPCs with an uncancelable background context.

So even after successful thread delivery and validation work, a wedged status callback could still keep `GetThreadNonblock` open indefinitely.

### Relative Strength Of This Hypothesis

This now looks at least as strong as the pure lock/suspend-count theories because:

- it directly explains why entering Chat could trigger the stuck state
- it directly explains how the daemon can stay stuck even after visible UI progress
- it uses an explicit uncancelable blocking RPC call in the exact thread-load path that suspends inbox unboxing

## Further Code Audit Narrowing

After tracing the desktop/UI callback plumbing more carefully, the thread-status theory became narrower.

### Important Weakening: JS Auto-Acks Thread Callbacks

On the JS side, listener-backed incoming calls are acknowledged immediately:

- the listener sends `response.result()` before it schedules the actual handler body
- `chatThreadStatus` in the desktop store is only a synchronous state update
- `chatThreadFull` / `chatThreadCached` are also listener callbacks on the same path

So a slow or expensive JS status handler is **not** enough by itself to wedge the Go call.

For the status-RPC theory to be the root cause, the failure has to be lower level:

- the service-side RPC transport never gets the callback delivered to the frontend session
- or the frontend session is not actually able to dispatch the callback at all

That keeps this as a real possibility, but weaker than it first looked from Go alone.

### Another Candidate We Can Mostly De-Prioritize: waitForOnline

`UIThreadLoader.waitForOnline(...)` only waits about one second total:

- it loops 40 times
- each loop waits `25ms`
- then it proceeds anyway

So `GetThreadNonblock` is not likely to wedge forever just because the loader was waiting to come online.

### Stronger Code-Only Candidate: Post-Send Validation Before Resume

There is a more convincing path inside `UIThreadLoader.LoadNonblock(...)`:

1. the full thread is sent to the UI
2. `wg.Wait()` completes
3. the loader enters `thread payloads transferred, checking for resolve`
4. it resolves skipped unboxeds / validation work
5. only after that does `LoadNonblock(...)` return
6. only then does `GetThreadNonblock` run its deferred inbox-source resume

This is important because it matches a user-visible state where:

- the thread already appears loaded
- but the inbox localizer is still suspended
- and concurrent `RequestInboxUnbox` calls are still stuck in `waiting for resume`

### Why The Post-Send Work Is Risky

That post-send path does:

- `NewBoxer(...).ResolveSkippedUnboxeds(...)`
- `ConvSource.TransformSupersedes(...)`
- notifier/update work on the resulting messages

`ResolveSkippedUnboxeds(...)` re-validates sender keys for quick-unboxed messages through:

- `ResolveSkippedUnboxed(...)`
- `ValidSenderKey(...)`
- `CtxUPAKFinder(ctx, ...).CheckKIDForUID(...)`

So even after the thread is already visible in the UI, the loader can still be blocked doing sender-key validation and related follow-up work before resume happens.

### Conversation Lock Scope Still Matters

This is all still happening while `UIThreadLoader.LoadNonblock(...)` holds the per-conversation lock for its full lifetime.

So the critical section is not just:

- pull local thread
- pull remote thread

It also includes:

- JSON presentation/send
- post-send skip-resolution
- final status-clearing path

That makes the thread-loader critical section broader than it first appears.

### Additional Thread-Loader Bug

There is also a separate bug in `UIThreadLoader.singleFlightConv(...)`:

- `activeConvLoads[convID] = cancel` is written
- but entries are never removed

This is probably not the root cause of the outstanding `requestInboxUnbox` sessions, but it is real thread-loader state leakage and could make cancellation behavior harder to reason about over time.

## Revised Ranking After More Code Reading

From code alone, the current ranking is:

1. `GetThreadNonblock` wedges in post-send work before deferred inbox-source resume
2. `GetThreadNonblock` wedges somewhere else while holding the conversation lock
3. UI callback transport wedges on `ChatThreadStatus` / `ChatThreadFull` / `ChatThreadCached`
4. localizer worker hangs after resume inside `localizeConversation(...)`
5. pure localizer suspend-count imbalance / waiter leak

## Additional Code Smells Worth Remembering

These are not yet proven root cause, but they increase risk:

- `UIInboxLoader.LoadNonblock(...)` has a 1-minute timeout only for the first unverified inbox result; after that, draining `localizeCb` has no timeout.
- several localizer username lookups use `UIDMap.MapUIDsToUsernamePackages(..., networkTimeBudget=0, ...)`, which means no explicit timeout is applied at that layer.
- `UIDMap.MapUIDsToUsernamePackages(...)` holds the UID-map mutex across the server lookup path, so one slow miss can serialize later username lookups behind it.
- `UIThreadLoader.LoadNonblock(...)` appears to check `err != nil` instead of `fullErr != nil` after `ChatThreadFull(...)`, which is likely a bug, though not the main outstanding-session explanation.

## Things That Were Noise / Not Root Cause

- "Inbox asked for too much work" was not the root issue for the stuck sessions.
- The fact that unboxes happen on startup is expected and not itself the bug.
- `chatInboxConversation` lacking a useful `sessionID` in logs did not explain the stuck outer requests by itself.
- The generic Electron bridge was not universally broken; many requests completed normally through it.

## Useful Facts For The Next Debug Session

If the issue reproduces again, capture:

1. renderer `sessionID`
2. matching renderer outer `seqid`
3. whether node logged:
   - `main received invoke ... seqid`
   - `node wrote invoke to daemon ... seqid`
   - `node received response from daemon ... seqid`
4. whether renderer later logs:
   - `response matched invocation ... seqid`
   - `session end ... sessionID`

The most valuable bad-run pattern is:

- renderer session start
- renderer invoke
- node wrote invoke to daemon
- no daemon response for that same outer `seqid`
- no renderer session end

## Next Go-Side Questions

1. Why would `chat.1.local.requestInboxUnbox` sometimes not produce an outer response for a subset of requests?
2. Is there any daemon-side state that can wedge this path until daemon restart?
3. Is `RequestInboxUnbox` blocked on loader/UI state in a way that can fail to return?
4. Is there any batching / callback / channel drain behavior in the inbox loader that can prevent the outer RPC from finishing?
5. Are there daemon logs around the stuck outer request showing the handler entered but never returned?

## Current Status

- no confirmed root-cause fix
- JS-side debug instrumentation removed
- daemon restart stopped reproduction
- next investigation should focus on Go/daemon behavior for stuck outer `requestInboxUnbox` calls

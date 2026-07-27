# Mobile RPC Bridge — Review Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 20 defects five independent reviewers found in the `nojima/HOTPOT-rpc-fixes` mobile JSI RPC bridge hardening, without changing the (validated) core design.

**Architecture:** The branch's core design is correct and stays: **one permanent process-wide reader thread** per platform, forwarding into whichever `KBBridge` is currently installed via a mutex-guarded global. This is forced by `go/bind/keybase.go` — `ReadArr` returns a view of one shared 300KB global buffer, is documented "called serially by the mobile run loops", and a thread parked in it cannot be cancelled (`LoopbackConn.SetReadDeadline` is a no-op stub). The reader also serializes the non-thread-safe `msgpack::unpacker`. All defects are in two clusters: **teardown seams** (module invalidate races the next module's install) and a **half-wired reset story** (the desync leg notifies JS; the far more common read-error leg does not).

**Tech Stack:** C++20 + JSI (Hermes), Objective-C++ (iOS TurboModule), Kotlin + fbjni (Android TurboModule), Go (gomobile bindings), TypeScript (engine transport), Jest.

## Global Constraints

- Branch is `nojima/HOTPOT-rpc-fixes`. Base is `master` (confirmed via `gh pr view --json baseRefName`, PR #29464). Do **not** amend or rebase existing commits — fix forward with new commits only.
- No `Co-Authored-By` trailers in commits. Ever.
- Repo root is `client/`. TS source lives in `shared/`. Use absolute paths for file ops; for Bash, `cd shared/` first for any yarn command.
- Use `--no-ext-diff` on every `git diff` / `git show` / `git log -p`.
- **Native build gotcha:** `shared/node_modules/react-native-kb` is a real directory **copy**, not a symlink, and expo autolinking resolves gradle/pod paths to it — not to `rnmodules/`. It is currently stale. After editing anything under `rnmodules/react-native-kb/`, run the sync in Task 0 before attempting any native build, and never edit the `node_modules` copy directly (it is not tracked by git).
- Never use `npm`. Always `yarn`.
- Remove unused code when editing: styles, imports, vars, params, dead helpers.
- Comments: no refactoring/change-history notes. Only add a comment when the constraint is non-obvious from the code. Several tasks here **fix wrong comments** — that is deliberate, because this design lives in its comments.
- TS validation after any `shared/` change, from `shared/`: `yarn lint:all` (= `yarn lint && yarn lint:bailouts && yarn tsc`). Baseline is 0 react-compiler bailouts; keep it there. Never delete the ESLint cache.
- Do not "fix" the `n != len(bytes)` short-write branch by assuming it is live — it is provably dead for `LoopbackConn` today (`go/libkb/loopback.go:166-174` is all-or-nothing). Task 15 hardens it as defense-in-depth only.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `rnmodules/react-native-kb/ios/Kb.mm` | iOS TurboModule: bridge install/invalidate, permanent reader loop, event emit | 1, 3, 8, 16, 17 |
| `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` | Android TurboModule: `instance` gate, reader thread, lifecycle | 2, 4, 8, 16, 17 |
| `rnmodules/react-native-kb/android/cpp-adapter.cpp` | Android JNI ↔ `KBBridge` glue, `g_adapter`/`g_bridge` globals | 4, 5, 14, 17 |
| `rnmodules/react-native-kb/cpp/react-native-kb.cpp` | Platform-independent bridge: framing, msgpack↔JSI, batch dispatch | 6, 7, 9, 10, 18 |
| `rnmodules/react-native-kb/cpp/react-native-kb.h` | `KBBridge` interface + threading contract comments | 5, 6, 16 |
| `go/bind/keybase.go` | gomobile `ReadArr`/`WriteArr`/`Reset` | 15, 19 |
| `shared/engine/rpc-transport.tsx` | Shared transport: packetizer, invocations, responses | 11, 12, 13 |
| `shared/engine/index.platform.tsx` | Mobile/renderer transports, `rpcOnJs`, meta events | 12, 13, 20 |
| `shared/engine/rpc-transport.test.ts` | Jest coverage for transport | 11, 12, 13 |

---

## Task Ordering Rationale

Tasks 1–5 are the **critical/high teardown cluster** — each is an unrecoverable, silent hang in production. Tasks 6–10 close the **reset story**. Tasks 11–13 are TS-side, are the only ones with a real test harness, and are strictly TDD. Tasks 14–20 are hardening, observability, and comment corrections. Tasks 1 and 2 are independent of everything else and should land first.

---

### Task 0: Native build harness

Establishes the sync + compile loop every native task depends on. No product change.

**Files:**
- Create: `plans/scripts/sync-native-kb.sh`

**Interfaces:**
- Produces: `plans/scripts/sync-native-kb.sh` — copies `rnmodules/react-native-kb/{cpp,ios,android}` over `shared/node_modules/react-native-kb/`, used by every later native task before building.

- [ ] **Step 1: Write the sync script**

```bash
#!/usr/bin/env bash
# shared/node_modules/react-native-kb is a `file:` COPY, not a symlink, and
# expo autolinking points gradle/pods at it. Native edits under rnmodules/
# are invisible to a build until they are copied across.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/rnmodules/react-native-kb"
DST="$ROOT/shared/node_modules/react-native-kb"
test -d "$DST" || { echo "missing $DST — run yarn in shared/ first" >&2; exit 1; }
for d in cpp ios android; do
  rsync -a --delete "$SRC/$d/" "$DST/$d/"
done
echo "synced rnmodules/react-native-kb -> shared/node_modules/react-native-kb"
```

- [ ] **Step 2: Make it executable and run it**

Run:
```bash
chmod +x plans/scripts/sync-native-kb.sh && ./plans/scripts/sync-native-kb.sh
```
Expected: `synced rnmodules/react-native-kb -> shared/node_modules/react-native-kb`

- [ ] **Step 3: Verify the C++-only syntax check works**

This is the fast inner loop — it needs no gradle or xcodebuild. Run from `rnmodules/react-native-kb/cpp`:
```bash
cd rnmodules/react-native-kb/cpp
NM=../../../shared/node_modules
clang++ -std=c++20 -fsyntax-only -DMSGPACK_NO_BOOST \
  -I$NM/react-native/ReactCommon/jsi \
  -I$NM/react-native/ReactCommon/callinvoker \
  -I$NM/react-native/ReactCommon \
  -I$NM/msgpack-cxx-7.0.0/include \
  -I. react-native-kb.cpp
```
Expected: exit 0, no output. If headers are missing, run `yarn` from `shared/` first and re-run Task 0 Step 2.

- [ ] **Step 4: Commit**

```bash
git add plans/scripts/sync-native-kb.sh plans/2026-07-26-rpc-bridge-review-fixes.md
git commit -m "chore(rpc): add native sync script and review fix plan"
```

---

### Task 1: iOS — compare-and-clear the bridge on invalidate (CRITICAL)

**The bug.** `Kb.mm:251` calls `kbSetBridge(nullptr)`, and `kbSetBridge` (`Kb.mm:56-68`) has **no identity check** — it tears down whatever bridge is currently installed, not the one this module installed. The two events are genuinely unordered on a reload:

- `RCTHost.mm:620-628` does `[_instance invalidate]; _instance = nil; … _instance = [[RCTInstance alloc] init…]`
- `RCTInstance.mm:218-247` wraps `invalidate` in `dispatchToJSThread:`, and `RCTJSThreadManager.mm:84` `runOnQueue` is **async** when called off the old JS thread (reload commands arrive on main), so `invalidate` returns immediately
- the queued block reaches `RCTTurboModuleManager.mm:1093` `dispatch_async(methodQueue, …)`, guarded only by a 10s `dispatch_group_wait` (`:1098`) that **times out and proceeds**

So if the old JS thread is busy (long JS task, debugger pause) or `_sharedModuleQueue` is backed up, the new bridge B installs first and the stale `invalidate` then runs `B->markTornDown()`. Result: `rpcOnGo` returns false forever, the reader drops every frame, the app hangs on the loading screen — with **no desync detected and no engine-reset emitted**, because nothing looks broken from C++'s side. `Kb.mm:253`'s unconditional `KeybaseReset` compounds it by killing B's freshly dialed connection.

**Files:**
- Modify: `rnmodules/react-native-kb/ios/Kb.mm:56-68` (add compare-and-clear helper)
- Modify: `rnmodules/react-native-kb/ios/Kb.mm:244-254` (`invalidate`)
- Modify: `rnmodules/react-native-kb/ios/Kb.mm:266-308` (`installJSIBindingsWithRuntime` — record the installed bridge)

**Interfaces:**
- Produces: `static bool kbClearBridgeIfCurrent(const std::shared_ptr<kb::KBBridge> &mine)` — returns `true` only if `mine` was the installed bridge and was cleared. Task 3 and Task 8 both call `invalidate` paths that depend on this returning `false` for a stale module.
- Produces: `Kb` instance ivar `myBridge_` of type `std::shared_ptr<kb::KBBridge>`.

- [ ] **Step 1: Add the compare-and-clear helper**

Insert immediately after `kbSetBridge` (after `Kb.mm:68`):

```objc
// Clears the installed bridge only if it is still `mine`. A module's
// invalidate can run *after* the next module already installed its bridge
// (RCTInstance::invalidate hops to the old JS thread asynchronously, and
// RCTTurboModuleManager only waits 10s before proceeding), so an
// unconditional clear would tear down the live bridge and wedge the app
// with no desync and no reset to recover from.
static bool kbClearBridgeIfCurrent(const std::shared_ptr<kb::KBBridge> &mine) {
  std::shared_ptr<kb::KBBridge> old;
  {
    std::lock_guard<std::mutex> lock(kbBridgeMutex);
    if (!mine || kbCurrentBridge != mine) {
      return false;
    }
    old = std::move(kbCurrentBridge);
    kbCurrentBridge = nullptr;
  }
  old->markTornDown();
  return true;
}
```

- [ ] **Step 2: Record the installed bridge on the instance**

Find the `@implementation Kb` ivar block. If there is no ivar block, add one directly after `@implementation Kb`:

```objc
@implementation Kb {
  std::shared_ptr<kb::KBBridge> myBridge_;
}
```

If an ivar block already exists, add only the `myBridge_` line to it.

Then in `installJSIBindingsWithRuntime`, replace `Kb.mm:306`:

```objc
    kbSetBridge(bridge);
```

with:

```objc
    myBridge_ = bridge;
    kbSetBridge(bridge);
```

- [ ] **Step 3: Gate invalidate on the identity check**

Replace the whole of `invalidate` (`Kb.mm:244-254`):

```objc
- (void)invalidate {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  kbPasteImageEnabled = NO;
  // Runs on the TurboModule shared method queue (no methodQueue getter, so
  // RCTTurboModuleManager assigns _sharedModuleQueue) — any thread, never the
  // JS thread. Only the atomic flag may be touched here; releasing jsi
  // handles off the runtime's thread is undefined behavior.
  //
  // Both the teardown and the Go reset are gated on still being the current
  // bridge: a reload can install the next module's bridge before this runs,
  // and clearing that one would leave the app wedged with no way to notice.
  if (kbClearBridgeIfCurrent(myBridge_)) {
    NSError *error = nil;
    KeybaseReset(&error);
  }
  myBridge_ = nullptr;
}
```

Note this also corrects the false "runs on the main thread" comment (finding iOS F2) — `Kb` declares no `methodQueue` getter, so `RCTTurboModuleManager.mm:727-728` assigns `_sharedModuleQueue`.

- [ ] **Step 4: Sync and compile**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/ios && xcodebuild -workspace Keybase.xcworkspace -scheme react-native-kb \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
```
Expected: `** BUILD SUCCEEDED **`. If the workspace needs pods, run `yarn ios:pod:install` from `shared/` first.

- [ ] **Step 5: Commit**

```bash
git add rnmodules/react-native-kb/ios/Kb.mm
git commit -m "fix(rpc): only clear the iOS bridge if it is still the installed one

A module's invalidate can run after the next module installed its bridge,
because RCTInstance::invalidate hops to the old JS thread asynchronously and
RCTTurboModuleManager waits at most 10s before proceeding. The unconditional
kbSetBridge(nullptr) then tore down the live bridge: rpcOnGo returned false
forever and the reader dropped every frame, with no desync detected and no
engine-reset emitted, so the app hung with no path to recovery.

Also gate the Go reset on the same check, and correct the thread comment --
invalidate runs on the TurboModule shared queue, not the main thread."
```

---

### Task 2: Android — stop nulling `instance` into a permanent wedge (CRITICAL)

**The bug.** `KbModule.kt:555` clears `instance` on destroy and **nothing restores it**. `onHostResume` (`KbModule.kt:483`) is now an empty body, and `MainApplication.kt:44` holds the `ReactHost` in an application-scoped `by lazy`, so on Android `onHostDestroy` fires when the last Activity is destroyed **while the ReactInstance, ReactContext, and its TurboModule instances survive**. `KbModule` is therefore never reconstructed and `init{}` (`KbModule.kt:298-300`) never re-runs.

Concrete: back button to home → `onHostDestroy` → `destroy()` → `instance = null` → tap the icon again → Activity recreated, `onHostResume` does nothing → `instance` stays `null` forever → `instance?.nativeOnDataFromGo(data)` (`KbModule.kt:531`) silently discards **every** inbound message for the rest of the process. Outbound still works, so the app looks alive and never receives a reply. This is the exact case the deleted comment called out ("hit the back button to go to home screen and then tap Keybase app icon again"); the old code restarted the read loop in `onHostResume` and that line was removed with nothing replacing it.

Second symptom: `isReactNativeRunning()` (`KbModule.kt:638`) returns `instance != null`, and `KeybasePushNotificationListenerService.kt:152-158` uses it to decide whether to show fallback notifications — so after the first Activity destroy the user gets duplicate notifications while the app is warm.

**The fix.** `instance` is a pure gate: the JNI callee (`cpp-adapter.cpp:111` `nativeOnDataFromGo`) ignores `thiz` entirely and routes through `g_bridge`. Nulling it buys nothing and costs the wedge. Remove the clear. Bridge teardown is handled properly by Task 4 instead.

**Files:**
- Modify: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` (`destroy()`, ~line 550-566)
- Modify: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt:298-300` (`init` ordering)

- [ ] **Step 1: Remove the instance clear in `destroy()`**

Replace this block in `destroy()`:

```kotlin
        // The read loop outlives us and forwards to whatever `instance` holds,
        // so drop ourselves from it: otherwise a torn-down module (and the
        // ReactContext/Activity it pins) keeps receiving deliveries. Only clear
        // if we're still the current one — a reload may have installed a newer
        // module before our onHostDestroy runs.
        if (instance === this) {
            instance = null
        }
```

with:

```kotlin
        // `instance` is deliberately NOT cleared here. onHostDestroy fires when
        // the last Activity goes away, but the ReactInstance and this module
        // survive, so init{} never re-runs and nothing would ever restore it —
        // every later inbound message would be dropped for the life of the
        // process (back button to home, then reopen). It is only a gate: the
        // JNI callee ignores the receiver and routes through g_bridge, so a
        // stale instance delivers to the correct current bridge regardless.
        // Bridge teardown is handled by nativeInvalidate below.
```

- [ ] **Step 2: Publish `instance` last in `init`**

`instance = this` currently escapes before `misTestDevice` is assigned, so another thread can observe a partially constructed module. Replace `init`:

```kotlin
    init {
        this.reactContext = reactContext!!
        misTestDevice = isTestDevice(reactContext)
        Thread { cachedConstants }.start()
        // Published last: the reader thread reads `instance` and must never
        // see a partially constructed module.
        instance = this
    }
```

- [ ] **Step 3: Compile**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:compileDebugKotlin --offline
```
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Manual verification (user drives — do NOT drive the device yourself)**

Ask the user to: launch the app on Android, confirm chat loads, press the **back button** to exit to the home screen, then tap the Keybase icon again and confirm the inbox still loads and a sent message round-trips. Before this fix that sequence leaves the app permanently unable to receive.

- [ ] **Step 5: Commit**

```bash
git add rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt
git commit -m "fix(rpc): stop clearing the Android module instance on host destroy

onHostDestroy fires when the last Activity dies while the ReactInstance and
its TurboModules survive, so init{} never re-runs and nothing restored
instance. After a back-button exit and relaunch, nativeOnDataFromGo dropped
every inbound message for the life of the process while outbound kept
working -- the app looked alive and never got a reply. It also made
isReactNativeRunning() report false while RN was warm, producing duplicate
fallback notifications.

instance is only a gate; the JNI callee ignores the receiver and routes
through g_bridge. Bridge teardown moves to nativeInvalidate.

Also publish instance at the end of init so the reader thread cannot observe
a partially constructed module."
```

---

### Task 3: iOS — clear `kbSharedInstance` so a dead module stops emitting

**The bug.** `kbSharedInstance` (`Kb.mm:40`) is `__weak` and never cleared on invalidate, and `canEmit` (`Kb.mm:166-168`) is just `_eventEmitterCallback != nullptr`. `_eventEmitterCallback` lives on the codegen'd base (`RCTTurboModule.h:170`, set via `ObjCTurboModule::setEventEmitterCallback`) and RN **never nulls it** on invalidate. The `__weak` ref only nils at `dealloc`, which lags `invalidate` (the module is released at `RCTTurboModuleManager.mm:1102-1104`, and autorelease/other retains defer it further).

So during a reload window a push notification (`Kb.mm:548-556`), a device token registration (`Kb.mm:534-542`), or — new in this PR — the reader's fatal `emitOnMetaEvent` (`Kb.mm:298-303`) fires into the dying runtime's invoker. The fatal path is the one that runs *precisely* when a reload or reset is already in flight. Android got this fix in commit `3f71bd9388`; iOS did not.

**Files:**
- Modify: `rnmodules/react-native-kb/ios/Kb.mm:244-254` (`invalidate`, as rewritten by Task 1)

**Interfaces:**
- Consumes: `kbClearBridgeIfCurrent` and the `myBridge_` ivar from Task 1.

- [ ] **Step 1: Clear the shared instance in `invalidate`**

In the `invalidate` body written in Task 1, add the identity-guarded clear as the first statement after the observer removal:

```objc
- (void)invalidate {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  kbPasteImageEnabled = NO;
  // RN never nulls _eventEmitterCallback on invalidate and the __weak ref
  // above only nils at dealloc, which lags this call — so without an explicit
  // clear, canEmit stays YES and a push notification, token registration or
  // (worst) the reader's desync meta event emits into the dying runtime's
  // invoker. Guarded because a reload may already have installed a newer
  // module as the shared instance.
  if (kbSharedInstance == self) {
    kbSharedInstance = nil;
  }
  if (kbClearBridgeIfCurrent(myBridge_)) {
    NSError *error = nil;
    KeybaseReset(&error);
  }
  myBridge_ = nullptr;
}
```

- [ ] **Step 2: Compile**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/ios && xcodebuild -workspace Keybase.xcworkspace -scheme react-native-kb \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add rnmodules/react-native-kb/ios/Kb.mm
git commit -m "fix(rpc): clear kbSharedInstance on iOS invalidate

RN never nulls _eventEmitterCallback on invalidate, and the __weak shared
instance only nils at dealloc, which lags it. canEmit therefore stayed YES
for an invalidated module and push notifications, token registrations, and
the reader's desync meta event emitted into the dying runtime's invoker --
the desync path being the one that fires exactly when a reload is already in
flight. Mirrors the Android fix in 3f71bd9388."
```

---

### Task 4: Android — add `nativeInvalidate` to tear down the bridge and drop the globals

**The bug (two findings).** Android has **no `markTornDown()` call site at all** — `react-native-kb.h:44-46` documents it as the module-invalidate entry point, iOS honors it, and `KbModule.destroy()` only clears `instance` and calls `Keybase.reset()`. `g_bridge` (`cpp-adapter.cpp:53`) is replaced *only* inside the bindings installer. So on a dev reload the old bridge stays in `g_bridge` with `isTornDown_ == false`; if the new runtime's installer has not run yet (module construction and JSI binding installation are separate phases), the reader routes to the **old** bridge, passes the `isTornDown_` check, and calls `callInvoker_->invokeAsync` on the **old runtime's CallInvoker while that runtime is being destroyed** — use-after-free in RuntimeScheduler.

Separately, `g_adapter` is a static `shared_ptr` holding `jni::global_ref<JKbModule>` and is never cleared, so it pins the old `KbModule` and through `reactContext` the Activity — exactly what the `KbModule.kt:518-519` comment says the non-inner-class reader was designed to avoid. `g_bridge` likewise pins a dead runtime's `CallInvoker`.

**Files:**
- Modify: `rnmodules/react-native-kb/android/cpp-adapter.cpp` (add `nativeInvalidate`, register it)
- Modify: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` (declare + call it in `destroy()`)

**Interfaces:**
- Produces: `external fun nativeInvalidate()` on `KbModule` (Kotlin), backed by `static void nativeInvalidate(jni::alias_ref<JKbModule::javaobject>)` in `cpp-adapter.cpp`. Idempotent; safe from any thread; touches only atomics and `shared_ptr` slots, never jsi handles.

- [ ] **Step 1: Add the native invalidate to `cpp-adapter.cpp`**

Add after the `getBridge()` helper:

```cpp
// Any thread. Drops this module's C++-side state: flips the bridge's atomic
// teardown flag so the permanent reader stops delivering into a runtime that
// is going away, and releases the globals that would otherwise pin a dead
// KbModule (and its ReactContext/Activity) and a destroyed runtime's
// CallInvoker for the life of the process.
//
// Only atomics and shared_ptr slots are touched — the old bridge's jsi
// handles belong to its own runtime and are released by its kbTeardown host
// object on the JS thread.
static void nativeInvalidate(jni::alias_ref<JKbModule::javaobject>) {
  std::shared_ptr<kb::KBBridge> oldBridge;
  std::shared_ptr<KbNativeAdapter> oldAdapter;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    oldBridge = std::move(g_bridge);
    oldAdapter = std::move(g_adapter);
    g_bridge = nullptr;
    g_adapter = nullptr;
  }
  if (oldBridge) {
    oldBridge->markTornDown();
  }
}
```

- [ ] **Step 2: Register it in the JNI registration block**

Find the `registerNatives` call in `cpp-adapter.cpp` (the block containing `makeNativeMethod("nativeOnDataFromGo", nativeOnDataFromGo)`) and add alongside it:

```cpp
          makeNativeMethod("nativeInvalidate", nativeInvalidate),
```

- [ ] **Step 3: Declare and call it from Kotlin**

Next to the existing `nativeOnDataFromGo` external declaration in `KbModule.kt`, add:

```kotlin
    private external fun nativeInvalidate()
```

Then in `destroy()`, immediately after the comment block Task 2 left in place of the `instance` clear, add:

```kotlin
        nativeInvalidate()
```

so the body reads: the explanatory comment, then `nativeInvalidate()`, then the existing `try { Keybase.reset(); relayReset() }`.

- [ ] **Step 4: Compile both halves**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:externalNativeBuildDebug :react-native-kb:compileDebugKotlin --offline
```
Expected: `BUILD SUCCESSFUL`. A missing `makeNativeMethod` registration surfaces at runtime, not compile time — re-read Step 2 and confirm the method name string matches the Kotlin declaration exactly.

- [ ] **Step 5: Commit**

```bash
git add rnmodules/react-native-kb/android/cpp-adapter.cpp \
        rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt
git commit -m "fix(rpc): tear down the Android bridge and globals on module destroy

Android had no markTornDown call site at all, so on a dev reload the old
bridge stayed in g_bridge with isTornDown_ false. If the new runtime's
installer had not run yet the reader routed to the old bridge, passed the
teardown check, and called invokeAsync on the old runtime's CallInvoker while
that runtime was being destroyed.

g_adapter and g_bridge were also never cleared, pinning the old KbModule (and
via reactContext its Activity) and a dead runtime's CallInvoker for the life
of the process -- the exact leak the non-inner-class reader was written to
avoid."
```

---

### Task 5: Android — hold the adapter strongly in the installer

**The bug.** The installer lambda captures only `std::weak_ptr<KbNativeAdapter>` (`cpp-adapter.cpp:69`), and the sole strong reference is the `g_adapter` slot. When a second `getBindingsInstaller` runs it overwrites `g_adapter`, destroying the old adapter **immediately** — while `g_bridge` is still the old, still-installed bridge, because the swap only happens later (`cpp-adapter.cpp:100-101`) when the new installer actually executes on the JS thread. In that window the live runtime's `rpcOnGo` hits a failed `weakAdapter.lock()` and returns `false` for **every** send: the whole app fails its RPCs. Guaranteed with two `ReactHost`s, and reachable on any path where module construction precedes runtime destruction.

There is no cycle to fear — `KbNativeAdapter` holds a `global_ref<JKbModule>` and never references the bridge — so a strong capture is safe, and it makes the adapter's lifetime match the bridge that actually uses it. With Task 4 clearing `g_adapter` explicitly, the slot is no longer needed as an ownership anchor.

**Files:**
- Modify: `rnmodules/react-native-kb/android/cpp-adapter.cpp:65-95` (`getBindingsInstaller`)

**Interfaces:**
- Consumes: `nativeInvalidate` from Task 4 (which clears `g_adapter`).

- [ ] **Step 1: Capture the adapter by `shared_ptr`**

In `getBindingsInstaller`, change the lambda capture from weak to strong and drop the three `weakAdapter.lock()` dances. Replace:

```cpp
  return BindingsInstallerHolder::newObjectCxxArgs(
      [weakAdapter = std::weak_ptr<KbNativeAdapter>(adapter)](
```

with:

```cpp
  // Captured strongly: the adapter must outlive the bridge that calls it, and
  // the g_adapter slot is not an ownership anchor -- installing a second
  // module overwrites it while the first bridge is still live and installed,
  // which with a weak capture failed every rpcOnGo in that window. No cycle:
  // the adapter holds a global_ref to the Java module and never the bridge.
  return BindingsInstallerHolder::newObjectCxxArgs(
      [adapter](
```

- [ ] **Step 2: Simplify the two callbacks that used `weakAdapter`**

Replace the `writeToGo` callback:

```cpp
            [adapter](void *ptr, size_t size) -> bool {
              return adapter->writeToGo(ptr, size);
            },
```

and the fatal callback's body:

```cpp
            [adapter]() {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "rpc stream desync, resetting connection");
              adapter->onFatal();
            });
```

- [ ] **Step 3: Compile**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:externalNativeBuildDebug --offline
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add rnmodules/react-native-kb/android/cpp-adapter.cpp
git commit -m "fix(rpc): hold the Android adapter strongly in the bindings installer

The only strong ref was the g_adapter slot, so constructing a second module
destroyed the adapter immediately while the first bridge was still installed
-- g_bridge is only swapped later, when the new installer runs on the JS
thread. Every rpcOnGo in that window failed its weak lock and returned false,
failing all RPCs. The adapter never references the bridge, so there is no
cycle to avoid."
```

---

### Task 6: Both platforms — tell JS when the read path resets the connection

**The bug.** `go/bind/keybase.go:642-647`: when `conn.Read` errors, `ReadArr` calls `Reset()` itself and returns the error. The native readers just log and sleep (`Kb.mm:359-362`; `KbModule.kt:536-544`, which even special-cases `"Read error: EOF"` as expected). **Nothing emits `kb-engine-reset`.** So JS is never told, `failAllOutstanding` never runs, every in-flight RPC hangs forever, and the UI keeps its spinners.

This is the **common** reset leg — the branch closed the desync leg and left the frequent one open. It also leaves `recv_` holding mid-frame state across a connection boundary, which then trips the desync detector on the next connection.

**Files:**
- Modify: `rnmodules/react-native-kb/ios/Kb.mm:353-375` (reader loop error branch)
- Modify: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` (`ReadFromKBLib.run` catch branch)
- Modify: `rnmodules/react-native-kb/cpp/react-native-kb.h` (declare `resetRecv`)
- Modify: `rnmodules/react-native-kb/cpp/react-native-kb.cpp` (define `resetRecv`)

**Interfaces:**
- Produces: `void KBBridge::resetRecv()` — public, any thread, takes `recvMutex_` and calls the existing private `resetRecvLocked()`. Used here and by Task 9.

- [ ] **Step 1: Expose a public `resetRecv` on the bridge**

In `react-native-kb.h`, in the public section directly after the `onDataFromGo` declaration:

```cpp
  // Any thread. Drops any partially parsed frame. Must be called whenever the
  // Go connection is replaced, or the unpacker resumes mid-frame on a fresh
  // stream and the next header check fails on valid data.
  void resetRecv();
```

In `react-native-kb.cpp`, add next to the other small methods (after `tearup()`):

```cpp
void KBBridge::resetRecv() {
  std::lock_guard<std::mutex> lock(recvMutex_);
  if (recv_) {
    resetRecvLocked();
  }
}
```

- [ ] **Step 2: iOS — reset framing and notify JS on a read error**

Replace the error branch in the reader loop (`Kb.mm:359-363`):

```objc
          if (error) {
            // ReadArr already called Reset() on the Go side, so the connection
            // JS thinks it has is gone and every in-flight RPC is dead. Tell
            // JS so it fails them instead of spinning forever, and drop any
            // half-parsed frame so the next connection starts clean.
            kbLogToService([NSString
                stringWithFormat:@"rpc read error, connection reset: %@",
                                 error.localizedDescription]);
            if (auto bridge = kbGetBridge()) {
              bridge->resetRecv();
            }
            dispatch_async(dispatch_get_main_queue(), ^{
              Kb *instance = kbSharedInstance;
              if (instance && [instance canEmit]) {
                [instance emitOnMetaEvent:metaEventEngineReset];
              }
            });
            [NSThread sleepForTimeInterval:0.1];
            continue;
          }
```

- [ ] **Step 3: Android — same, in the reader's catch**

In `ReadFromKBLib.run`, replace the `catch (e: Exception)` body:

```kotlin
                } catch (e: Exception) {
                    // readArr already called Reset() on the Go side, so the
                    // connection JS thinks it has is gone and every in-flight
                    // RPC is dead. EOF is the ordinary shape of this, not a
                    // surprise -- but JS still has to be told, or its callers
                    // hang forever.
                    if (e.message != null && e.message.equals("Read error: EOF")) {
                        NativeLogger.info("Got EOF from read, connection reset.")
                    } else {
                        NativeLogger.error("Exception in ReadFromKBLib.run", e)
                    }
                    instance?.onRpcConnectionReset()
                    Thread.sleep(100)
                }
```

Keep the existing `catch (e: InterruptedException)` branch ahead of it unchanged.

- [ ] **Step 4: Android — add the Kotlin handler**

Next to `onRpcStreamFatal` in `KbModule.kt`, add:

```kotlin
    // Called from the reader thread when readArr failed and Go reset the
    // connection underneath us. Unlike onRpcStreamFatal we must NOT call
    // Keybase.reset() -- ReadArr already did, and a second reset would close a
    // connection a concurrent writeArr may have just dialed.
    fun onRpcConnectionReset() {
        nativeResetRecv()
        reactContext.runOnUiQueueThread { relayReset() }
    }

    private external fun nativeResetRecv()
```

- [ ] **Step 5: Android — back `nativeResetRecv` with JNI**

In `cpp-adapter.cpp`, add next to `nativeInvalidate`:

```cpp
static void nativeResetRecv(jni::alias_ref<JKbModule::javaobject>) {
  if (auto bridge = getBridge()) {
    bridge->resetRecv();
  }
}
```

and register it alongside the others:

```cpp
          makeNativeMethod("nativeResetRecv", nativeResetRecv),
```

- [ ] **Step 6: Compile both platforms**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:externalNativeBuildDebug :react-native-kb:compileDebugKotlin --offline
cd ../ios && xcodebuild -workspace Keybase.xcworkspace -scheme react-native-kb \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
```
Expected: `BUILD SUCCESSFUL` and `** BUILD SUCCEEDED **`

- [ ] **Step 7: Commit**

```bash
git add rnmodules/react-native-kb/
git commit -m "fix(rpc): emit engine-reset when the read path drops the connection

ReadArr calls Reset() itself on a read error and returns; both readers only
logged it. JS was never told, so failAllOutstanding never ran and every
in-flight RPC hung forever with the UI still spinning. This is the common
reset leg -- the branch had closed only the desync leg.

Also drop any half-parsed frame, so the unpacker does not resume mid-frame on
the next connection and fail its header check on valid data. Deliberately no
second Keybase.reset() here: ReadArr already reset, and resetting again would
close a connection a concurrent writeArr may have just dialed."
```

---

### Task 7: C++ — validate the frame length instead of discarding it

**The bug.** `react-native-kb.cpp:630-643` checks that the framing prefix is a `POSITIVE_INTEGER` no larger than `kMaxFrameSize`, then **throws the value away** and lets the unpacker decode "the next object" as content. The declared length is never compared against what the content actually consumed. Two reviewers converged on this independently.

So a truncated or over-long content frame is undetected: the unpacker reads into the following frame, and the parity check only trips later, or never — if the shifted bytes happen to begin with a positive int. After a mid-stream resync the parser can land on a `0x05` fixint *inside a string payload*, accept it as a header, and hand whatever parses next to JS as an RPC message. JS then gets a bogus `[type, seqid, …]` and may resolve the wrong seqid. The detector reports "no desync" while delivering corrupt data.

**Do NOT use `parsed_size()` for this.** It is not a cumulative stream position: `unpacker::next()` calls `reset()` on every success (`msgpack/v2/unpack.hpp:92-101`), and `parser::reset()` sets `m_parsed = 0` (`msgpack/v2/parse.hpp:969`). So `parsed_size()` reads 0 immediately after any successful `next()`, and a delta between two such reads is always `0 - 0`. An earlier revision of this task specified exactly that and would have rejected every non-empty frame — a self-inflicted DoS on the mainline decode path, invisible to `-fsyntax-only`.

Track the consumed count manually instead. `nonparsed_size()` (`m_used - m_off`) IS accurate at any moment, so if `RecvState` accumulates every byte handed to `reserve_buffer`/`buffer_consumed`, then `totalFed - up.nonparsed_size()` is a genuine monotonic count of bytes consumed so far, unaffected by the per-object reset.

**Files:**
- Modify: `rnmodules/react-native-kb/cpp/react-native-kb.cpp:625-655` (the `while (true)` parse loop in `onDataFromGo`)

- [ ] **Step 1: Persist the framing counters in `RecvState`**

The counters must live in `RecvState`, not in loop locals: a frame's header and its content routinely arrive in **separate** `onDataFromGo` calls, and `recv_->state` already persists across them while a local would reset to 0 and compare against garbage.

Extend the struct (near line 28 of `react-native-kb.cpp`):

```cpp
struct KBBridge::RecvState {
  msgpack::unpacker unpacker;
  ReadState state = ReadState::needSize;
  // Persist across calls: a frame's header and its content routinely arrive
  // in separate reads.
  size_t declaredSize = 0;
  size_t consumedAtHeader = 0;
  // Every byte ever handed to the unpacker. parsed_size() cannot serve this
  // role -- next() zeroes it on each success -- but totalFed minus
  // nonparsed_size() is an accurate running count of what has been consumed.
  size_t totalFed = 0;
};
```

Read `resetRecvLocked()` and confirm it constructs a fresh `RecvState` (which zeroes these for free). If it instead mutates fields in place, add the three resets there — do not assume.

- [ ] **Step 2: Verify content consumed exactly the declared length**

Replace the parse loop body:

```cpp
      while (true) {
        msgpack::object_handle result;
        if (!up.next(result)) {
          break;
        }
        if (recv_->state == ReadState::needSize) {
          // The framing prefix must be a msgpack uint. Anything else means
          // the stream desynced; without this check the parity flips and
          // every later frame is silently swallowed as a "size".
          const auto &o = result.get();
          if (o.type != msgpack::type::POSITIVE_INTEGER ||
              o.as<uint64_t>() > kMaxFrameSize) {
            throw std::runtime_error("bad rpc frame header");
          }
          recv_->declaredSize = static_cast<size_t>(o.as<uint64_t>());
          recv_->consumedAtHeader = recv_->totalFed - up.nonparsed_size();
          recv_->state = ReadState::needContent;
        } else {
          // The header is only a plausibility check on its own: a fixint
          // sitting inside a string payload parses as a valid header after a
          // resync. Requiring the content object to consume exactly the
          // declared byte count makes the framing self-checking, so a
          // truncated or overlong frame is caught here instead of being
          // handed to JS as a bogus [type, seqid, ...].
          const size_t consumed =
              (recv_->totalFed - up.nonparsed_size()) - recv_->consumedAtHeader;
          if (consumed != recv_->declaredSize) {
            throw std::runtime_error("rpc frame length mismatch");
          }
          values->push_back(std::move(result));
          recv_->state = ReadState::needSize;
        }
      }
```

- [ ] **Step 3: Feed `totalFed` where bytes enter the unpacker**

In `onDataFromGo`, immediately after the existing `up.buffer_consumed(...)` call, add:

```cpp
      recv_->totalFed += static_cast<size_t>(size);
```

Without this the counter never advances and the check is meaningless. Confirm there is exactly one place bytes enter the unpacker; if there is more than one, every such site must update `totalFed`.

- [ ] **Step 4: Prove the arithmetic on a real frame, not just a syntax check**

`-fsyntax-only` cannot catch wrong arithmetic here, and the previous revision of this task shipped a version that rejected every frame. Write a throwaway harness in `/tmp/` that links the real msgpack headers, packs two well-formed frames (`<uint len><object>` twice, with different content sizes), feeds them to a `msgpack::unpacker` **split across three chunk boundaries** — including one that splits a header from its content — and asserts the computed `consumed` equals `declaredSize` for both frames. Then feed a deliberately truncated frame and assert it does NOT match.

Run it and paste the actual output into your report. If `consumed` is 0 or mismatched for a valid frame, stop and report BLOCKED — do not commit.

- [ ] **Step 5: Syntax check the real file**

Run the fast C++-only check from Task 0 Step 3.
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add rnmodules/react-native-kb/cpp/
git commit -m "fix(rpc): require frame content to consume exactly the declared length

The header check validated the prefix's type and range and then discarded the
value, so a truncated or overlong frame was undetected -- the unpacker read
into the following frame and the parity check tripped only later, or never.
After a resync the parser could accept a fixint sitting inside a string
payload as a header and hand whatever parsed next to JS as an RPC message,
reporting no desync while delivering garbage.

Comparing parsed_size() deltas against the declared size makes the framing
self-checking. The counters live in RecvState because a header and its
content routinely arrive in separate reads."
```

---

### Task 8: C++ — a conversion failure must fail loudly, not eat the batch

**The bug.** `react-native-kb.cpp:721-725` catches everything thrown by the delivery lambda and only calls `reportError`. `onFatal_` is **not** called. Throwing paths are real: `mpToString` "Invalid map key" for a BIN/ARRAY/MAP/EXT map key, "msgpack nesting too deep" (>1024), OOM in `binaryFromBytes`, and the `"rpcOnJs is not installed"` early return.

So one message containing a map with a non-scalar key throws while building item 3 of a 10-message batch → **all 10 messages are dropped**, including the reply to seqid N. JS's `_invocations` entry for N is never resolved and that caller hangs forever. This is exactly the bug class the branch set out to fix, and the desync path 60 lines above handles it correctly.

Two changes: convert per-message so one bad message cannot kill nine good ones, and escalate to `onFatal_` so JS fails its outstanding RPCs.

**Files:**
- Modify: `rnmodules/react-native-kb/cpp/react-native-kb.cpp:700-728` (the `invokeAsync` lambda body)

- [ ] **Step 1: Convert each message inside its own try**

Replace the batch branch (the `else` arm handling `values->size() > 1`):

```cpp
      } else {
        // Convert per message: a single bad message (non-scalar map key,
        // nesting over the limit) must not take the whole batch with it and
        // strand every other reply's caller.
        jsi::Array arr(runtime, values->size());
        size_t converted = 0;
        for (size_t i = 0; i < values->size(); ++i) {
          try {
            msgpack::object obj((*values)[i].get());
            arr.setValueAtIndex(runtime, converted,
                                self->convertMPToJSI(runtime, &obj));
            ++converted;
          } catch (const std::exception &e) {
            self->reportError(std::string("dropping undecodable message: ") +
                              e.what());
          }
        }
        if (converted == 0) {
          return;
        }
        if (self->isTornDown_.load()) {
          return;
        }
        onJs.call(runtime, std::move(arr),
                  jsi::Value(static_cast<int>(converted)));
      }
```

Note `converted` is used as both the write index and the reported count, so a dropped message leaves no hole in the array. The JS side reads `count`, not `arr.length`.

- [ ] **Step 2: Escalate the outer catch to fatal**

Replace the lambda's trailing catch pair:

```cpp
    } catch (const std::exception &e) {
      // Nothing decoded reached JS, so every reply in this batch is lost and
      // its caller would wait forever. Treat it like a desync: reset the
      // connection so JS fails its outstanding RPCs.
      self->reportError(e.what());
      if (self->onFatal_) {
        self->onFatal_();
      }
    } catch (...) {
      self->reportError("unknown error in onDataFromGo JS callback");
      if (self->onFatal_) {
        self->onFatal_();
      }
    }
```

- [ ] **Step 3: Escalate the missing-`rpcOnJs` early return too**

Replace the `"rpcOnJs is not installed"` branch:

```cpp
      if (!onJsValue.isObject() ||
          !onJsValue.getObject(runtime).isFunction(runtime)) {
        // These messages are already consumed from the unpacker and cannot be
        // replayed, so dropping them silently would strand their callers.
        self->reportError("rpcOnJs is not installed");
        if (self->onFatal_) {
          self->onFatal_();
        }
        return;
      }
```

- [ ] **Step 4: Syntax check**

Run the Task 0 Step 3 command. Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add rnmodules/react-native-kb/cpp/react-native-kb.cpp
git commit -m "fix(rpc): don't let one undecodable message strand a whole batch

convertMPToJSI throws on a non-scalar map key, nesting over the limit, or
OOM. That threw out of the batch loop and dropped all ten messages including
the reply to some seqid, whose caller then waited forever -- the exact bug
class this branch set out to fix, while the desync path right above it
handled the same situation correctly.

Convert per message so a bad one is dropped alone, and escalate the remaining
failure paths (including a missing rpcOnJs, whose messages are already
consumed and unreplayable) to onFatal so JS fails its outstanding RPCs."
```

---

### Task 9: WITHDRAWN — the latch is unnecessary and actively harmful

**Do not implement this task.** It was attempted (commit `0ed435d`) and reverted. Recorded here so the reasoning is not lost and nobody re-derives it.

Two findings killed it:

1. **The premise is already dead.** The task assumed stale in-flight bytes keep arriving after a desync and each triggers another reset. But `onFatal_` runs *synchronously* on the single serial reader thread, so `KeybaseReset` completes **before** the loop's next `ReadArr`, and the stale bytes are discarded wholesale along with the closed connection. They are never re-read. One desync already produces exactly one reset. Task 6's synchronous fatal handling closed this scenario.

2. **Every way of clearing the latch is broken.** Clearing it inside the fatal handler (this task's original Step 4) is a zero-width no-op — the latch is false again before the next chunk arrives, on the same synchronous call chain. Clearing it only from the platform read-error branches instead produces a **permanent wedge**: after `KeybaseReset` nils the connection, the next `ReadArr` dials a fresh one via `ensureConnection`, and `LoopbackConn.Read` (`go/libkb/loopback.go:120-138`) blocks until real data — it never returns `(0, nil)`. So the reconnect succeeds with `err == nil`, the error branch never fires, `resetRecv()` is never called, and `onDataFromGo`'s entry guard drops every byte for the rest of the process. `engineReset` also bypasses `resetRecv()`, so there is no user-triggered escape short of an app restart.

If a genuine reset storm is ever observed in the field, the fix is a signal that distinguishes "a new connection is up and serving data" from "nothing has arrived yet" — which does not exist today — not a latch cleared by either of the paths above.

<details>
<summary>Original (withdrawn) task text, kept for reference</summary>

### Task 9: C++ — latch after a fatal so one desync isn't a reset storm

**The bug.** Every desynced chunk calls `onFatal_()` → `KeybaseReset()` + engine-reset meta event → JS fails all outstanding RPCs. But bytes already in flight from the pre-reset stream keep arriving on the reader thread and keep failing the header check, so a single desync produces N resets in a row, each nuking whatever JS re-issued in between. Go's read buffer is 300KB (`keybase.go:348`), so a 1MB backlog is ~4 iterations.

**Files:**
- Modify: `rnmodules/react-native-kb/cpp/react-native-kb.h` (add the latch member)
- Modify: `rnmodules/react-native-kb/cpp/react-native-kb.cpp` (set it on fatal, clear it on reset)

**Interfaces:**
- Consumes: `KBBridge::resetRecv()` from Task 6 — clearing the latch is what lets delivery resume.

- [ ] **Step 1: Add the latch member**

In `react-native-kb.h`, next to `isTornDown_`:

```cpp
  // Set when the incoming stream desynced and the connection is being reset.
  // Bytes already in flight from the dead stream keep arriving and would each
  // trigger another reset, so drop them until the platform layer confirms the
  // connection was replaced (resetRecv).
  std::atomic<bool> awaitingReset_{false};
```

- [ ] **Step 2: Drop data while latched, and set the latch on fatal**

In `onDataFromGo`, extend the entry guard:

```cpp
void KBBridge::onDataFromGo(uint8_t *data, int size) {
  if (isTornDown_.load() || awaitingReset_.load() || size <= 0 ||
      data == nullptr) {
    return;
  }
```

and in the `if (fatal)` block, set the latch before invoking `onFatal_`:

```cpp
  if (fatal) {
    reportError(fatalMsg);
    // The stream can no longer be trusted, so anything decoded in this batch
    // is dropped. The platform layer resets the Go connection and signals JS
    // so outstanding RPCs fail instead of hanging forever. Latch until that
    // reset lands: the rest of the dead stream is still in flight and would
    // otherwise trigger a reset per chunk, each one failing whatever JS just
    // re-issued.
    awaitingReset_.store(true);
    if (onFatal_) {
      onFatal_();
    }
    return;
  }
```

- [ ] **Step 3: Clear the latch in `resetRecv`**

Update the `resetRecv` added in Task 6:

```cpp
void KBBridge::resetRecv() {
  {
    std::lock_guard<std::mutex> lock(recvMutex_);
    if (recv_) {
      resetRecvLocked();
    }
  }
  // The connection has been replaced, so the in-flight remnants of the old
  // stream are gone and it is safe to deliver again.
  awaitingReset_.store(false);
}
```

- [ ] **Step 4: Make the platform fatal paths clear the latch**

The latch is only cleared by `resetRecv`, so both fatal handlers must call it after their `KeybaseReset`. In `Kb.mm`'s fatal callback, after the `KeybaseReset(&error)` block and before the `dispatch_async`:

```objc
            if (auto b = kbGetBridge()) {
                b->resetRecv();
            }
```

In `KbModule.kt`'s `onRpcStreamFatal`, after the `Keybase.reset()` try block:

```kotlin
        nativeResetRecv()
```

- [ ] **Step 5: Compile both platforms**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:externalNativeBuildDebug :react-native-kb:compileDebugKotlin --offline
cd ../ios && xcodebuild -workspace Keybase.xcworkspace -scheme react-native-kb \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
```
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add rnmodules/react-native-kb/
git commit -m "fix(rpc): latch after a desync so one bad frame is one reset

Bytes already in flight from the dead stream kept arriving and each failed
the header check, so a single desync fired a reset per 300KB chunk -- and
each reset failed whatever JS had re-issued since the last one. Drop incoming
data until the platform layer confirms the connection was replaced."
```

</details>

---

### Task 10: TS — wire the mobile account-switch reset, or delete the dead method

**The bug.** `index.platform.tsx` adds `NativeTransportMobile.reset()` and wires it to the `kb-engine-reset` meta event, and its comment claims it covers "engine reset". But `Engine.reset()` early-returns on mobile (`shared/engine/index.tsx:305-307`), the account-switch call sites (`shared/constants/init/index.tsx:310, 317`) go through `Engine.reset()`, and the native `engineReset` TurboModule method has **no caller in current source** — the only hits are a stale `coverage-ts` artifact and the module's own export.

So on a mobile account switch, pre-switch outstanding invocations are never failed and their callbacks can fire against post-switch state — precisely what `ProxyNativeTransport.reset()` exists to prevent on desktop.

Two reviewers found this independently. Resolve it rather than leaving a claim with no caller.

**Files:**
- Modify: `shared/engine/index.tsx:305-317` (`Engine.reset`)
- Test: `shared/engine/rpc-transport.test.ts`

**Interfaces:**
- Consumes: `LocalTransport.reset()` / `failAllOutstanding()` (existing).

- [ ] **Step 1: Read the current mobile early-return**

Run:
```bash
cd shared && sed -n '295,325p' engine/index.tsx
```
Confirm the exact shape of the mobile guard before editing — it must keep skipping the desktop-only socket teardown while still resetting the transport.

- [ ] **Step 2: Write the failing test**

Add to `shared/engine/rpc-transport.test.ts`:

```ts
test('reset fails every outstanding invocation exactly once', () => {
  const transport = new TestTransport()
  const calls: Array<unknown> = []
  transport.invoke({method: 'a', param: {}}, (err: unknown) => calls.push(err))
  transport.invoke({method: 'b', param: {}}, (err: unknown) => calls.push(err))

  transport.reset()

  expect(calls).toHaveLength(2)
  expect(calls.every(e => e instanceof Error)).toBe(true)

  // A second reset must not re-fail anything already failed.
  transport.reset()
  expect(calls).toHaveLength(2)
})

test('seqids keep advancing across a reset so a late reply cannot alias', () => {
  const transport = new TestTransport()
  const seen: Array<number> = []
  transport.invoke({method: 'a', param: {}}, () => {})
  seen.push(transport.lastSeqidForTest)
  transport.reset()
  transport.invoke({method: 'b', param: {}}, () => {})
  seen.push(transport.lastSeqidForTest)

  expect(seen[1]).toBeGreaterThan(seen[0]!)
})
```

If `TestTransport` does not already expose the last seqid, add a minimal accessor to the test double in that file rather than to production code — read the existing `TestTransport` definition first and match its style.

- [ ] **Step 3: Run the tests to see them fail or pass**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts
```
Expected: the exactly-once test **passes** (the map-swap in `failOutstanding` already guarantees it — this is a regression guard, and a guard that passes on first run is doing its job). The seqid test should also pass. If either fails, that is a real defect — stop and report it before continuing.

- [ ] **Step 4: Make `Engine.reset()` reset the mobile transport**

In `shared/engine/index.tsx`, change the mobile early-return so it still resets the transport. Using the exact surrounding code you read in Step 1, the mobile branch must call the transport's `reset()` before returning, e.g.:

```ts
  reset() {
    // Mobile has no socket to tear down and no reconnect to wait for, but the
    // in-flight invocations still have to be failed: after an account switch
    // nothing will answer them, and their callbacks would otherwise fire
    // against post-switch state.
    this._rpcClient.transport.reset()
    if (isMobile) {
      return
    }
    // ...existing desktop teardown unchanged...
  }
```

Match the real property names in that file (`_rpcClient` vs `_client` etc.) — do not guess.

- [ ] **Step 5: Delete the dead native `engineReset`, or wire it**

`engineReset` has no caller. Deleting it spans the TurboModule spec and both platform implementations, which is a wider blast radius than this plan's other tasks. **Do not delete it silently.** Instead:

Run:
```bash
cd /Users/chrisnojima/go/src/github.com/keybase/client && \
  grep -rn 'engineReset' --include=*.ts --include=*.tsx --include=*.mm --include=*.kt --include=*.cpp \
  shared/ rnmodules/ | grep -v node_modules | grep -v coverage-ts
```

Report the result to the user and ask whether to remove it or wire the account-switch path to it. Until they answer, fix the misleading comment on `NativeTransportMobile.reset()` in `index.platform.tsx` so it stops claiming coverage it does not have:

```ts
  // The Go connection can be reset underneath us (a stream desync detected
  // natively, or the read path losing the connection). Nothing will answer
  // the in-flight RPCs after that, so fail them rather than hang every caller.
  override reset() {
    this.failAllOutstanding()
  }
```

- [ ] **Step 6: Validate**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts && yarn lint:all
```
Expected: tests pass; lint, bailouts, and tsc all clean (0 bailouts).

- [ ] **Step 7: Commit**

```bash
git add shared/engine/index.tsx shared/engine/index.platform.tsx shared/engine/rpc-transport.test.ts
git commit -m "fix(engine): fail in-flight RPCs on a mobile account switch

Engine.reset() early-returned on mobile, so the account-switch path never
reached the transport and pre-switch invocations were never failed -- their
callbacks could fire against post-switch state, which is exactly what
ProxyNativeTransport.reset() prevents on desktop.

Add regression tests for exactly-once failure and for seqids continuing to
advance across a reset, since restarting the counter would let a late reply
from the dead connection alias a fresh invocation."
```

---

### Task 11: TS — an app-code throw must not wipe the packetizer (desktop)

**The bug.** `rpc-transport.tsx:329` dispatches **inside** the parse loop's `try`, and the `catch` at `:331-334` calls `p.reset()`, discarding all buffered bytes. `_onEngineIncoming` (`engine/index.tsx:220-222`) is unguarded, so any app-code handler that throws unwinds out of `dispatchDecodedMessage` into that catch and wipes the packetizer **mid-stream**. The socket keeps delivering the rest of the frame, parsing resumes at an arbitrary byte offset → `Bad frame header` → reset → repeat. On the renderer (`ProxyNativeTransport`) there is no socket to reconnect, so it is terminal until app restart.

This is the same failure mode the branch fixed for mobile, still live on desktop.

**Files:**
- Modify: `shared/engine/rpc-transport.tsx:320-335` (`packetizeData`)
- Test: `shared/engine/rpc-transport.test.ts`

- [ ] **Step 1: Read the current `packetizeData`**

Run:
```bash
cd shared && sed -n '300,340p' engine/rpc-transport.tsx
```
Note the exact variable names (`p`, `payload`) before editing.

- [ ] **Step 2: Write the failing test**

Add to `shared/engine/rpc-transport.test.ts`:

```ts
test('a throwing incoming handler does not desync the packetizer', () => {
  const delivered: Array<unknown> = []
  let shouldThrow = true
  const transport = new TestTransport()
  transport.setIncomingHandler((msg: unknown) => {
    if (shouldThrow) {
      shouldThrow = false
      throw new Error('app handler blew up')
    }
    delivered.push(msg)
  })

  // Two well-formed frames arriving in a single chunk. The first handler
  // throws; the second frame must still be parsed and delivered.
  transport.feedRawForTest(encodeTwoFramesForTest())

  expect(delivered).toHaveLength(1)
})
```

`TestTransport` almost certainly lacks `setIncomingHandler` / `feedRawForTest` / `encodeTwoFramesForTest`. Read the existing test file first and build these against whatever the real transport exposes — the required behavior is: feed two concatenated framed messages in one buffer, have the first handler throw, assert the second still arrives. If the existing `TestTransport` cannot feed raw bytes, construct a `ProxyNativeTransport` (or the shared base) directly in the test and call its packetize entry point.

- [ ] **Step 3: Run it and watch it fail**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts -t 'does not desync the packetizer'
```
Expected: FAIL — `delivered` is empty, because the throw reset the packetizer and the second frame's bytes were discarded.

- [ ] **Step 4: Isolate the dispatch**

In `packetizeData`, move the dispatch out of the framing `try` so only genuine decode/framing errors reach the reset path:

```ts
      // Dispatch outside the framing try: an app-side handler that throws must
      // not reach the catch below, which resets the packetizer and discards
      // every buffered byte. That leaves parsing to resume at an arbitrary
      // offset -- and on the renderer transport there is no socket to
      // reconnect, so it never recovers.
      try {
        this.dispatchDecodedMessage(payload)
      } catch (e) {
        logger.error('dispatchDecodedMessage threw', e)
      }
```

Keep the outer `catch` that calls `p.reset()` for decode/framing errors only.

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts
```
Expected: PASS, all tests.

- [ ] **Step 6: Validate and commit**

```bash
cd shared && yarn lint:all
```
Expected: clean, 0 bailouts.

```bash
git add shared/engine/rpc-transport.tsx shared/engine/rpc-transport.test.ts
git commit -m "fix(engine): app-code throws must not reset the packetizer

dispatchDecodedMessage ran inside the framing try, so any unguarded handler
throw unwound into the catch that resets the packetizer and drops every
buffered byte. Parsing then resumed mid-frame, producing Bad frame header
forever -- terminal on the renderer transport, which has no socket to
reconnect. Same failure mode the mobile side of this branch fixed."
```

---

### Task 12: TS — a throwing incoming-invoke handler must answer the call

**The bug.** The per-message catch in `index.platform.tsx` swallows the throw and moves on, but the `response` object created at `rpc-transport.tsx:351-355` is then never settled. A custom-response handler that throws — e.g. `chat.1.chatUi.chatWatchPosition` (`engine/index.tsx:26`) — leaves Go's RPC waiting on a reply that will never be sent: a permanent per-call hang.

The per-message catch is the right shape (failing the whole batch would drop messages N+1..M); it is just incomplete.

**Files:**
- Modify: `shared/engine/rpc-transport.tsx:345-365` (`dispatchDecodedMessage`, `MESSAGE_TYPE_INVOKE` case)
- Test: `shared/engine/rpc-transport.test.ts`

- [ ] **Step 1: Read the invoke case**

Run:
```bash
cd shared && sed -n '340,370p' engine/rpc-transport.tsx
```
Note how `payload.response` is built and which error constructor is in scope (`makeTransportError` or similar).

- [ ] **Step 2: Write the failing test**

```ts
test('a throwing invoke handler still answers the caller with an error', () => {
  const sent: Array<unknown> = []
  const transport = new TestTransport()
  transport.captureSentForTest(sent)
  transport.setIncomingHandler(() => {
    throw new Error('handler blew up')
  })

  transport.dispatchDecodedMessage(makeInvokeFrameForTest({seqid: 7, method: 'x'}))

  // Something must go back for seqid 7 -- otherwise the service waits forever.
  expect(sent).toHaveLength(1)
  expect(JSON.stringify(sent[0])).toContain('7')
})
```

Build `captureSentForTest` / `makeInvokeFrameForTest` against the real transport surface, following the existing file's conventions.

- [ ] **Step 3: Run it and watch it fail**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts -t 'still answers the caller'
```
Expected: FAIL — `sent` is empty.

- [ ] **Step 4: Answer the call on throw**

In the `MESSAGE_TYPE_INVOKE` case, wrap the handler invocation:

```ts
        try {
          this._incomingRPCCallback(payload)
        } catch (e) {
          // The handler threw, so nothing will answer this seqid and the
          // service side waits forever. Fail it explicitly.
          logger.error('incoming invoke handler threw', e)
          payload.response?.error?.(makeTransportError('UNKNOWN_METHOD'))
        }
```

Use the error constructor actually in scope, matching the file's existing usage.

- [ ] **Step 5: Run to verify it passes**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts
```
Expected: PASS

- [ ] **Step 6: Validate and commit**

```bash
cd shared && yarn lint:all
```

```bash
git add shared/engine/rpc-transport.tsx shared/engine/rpc-transport.test.ts
git commit -m "fix(engine): answer the caller when an incoming invoke handler throws

The per-message catch swallowed the throw but never settled the response, so
a throwing custom-response handler left the service waiting on a reply that
never came -- a permanent per-call hang. Keep the per-message shape (failing
the batch would drop the remaining messages) and error the response instead."
```

---

### Task 13: TS — reset must report the disconnect, and clear the packetizer

**Two bugs, same code path.**

First: the `kb-engine-reset` handler calls `transport.reset()` then `connectCallback()`, but never `disconnectCallback()`. So `Engine._onDisconnect()` (`engine/index.tsx:114-123`) never runs — `_cancelOutstandingSessions()` is skipped and `_onConnectedCB(false)` never fires, so `onEngineDisconnected` (`constants/init/shared.tsx:294-300`) never sets the daemon error and the UI never shows the reconnect state. Sessions survive mostly by luck (each session's `start()` invoke is outstanding, so `failAllOutstanding` → `wrappedCallback` → `session.end()`), but any session not currently holding an outstanding invocation is leaked, and a pending custom-response prompt is left on screen bound to a dead seqid — `response.result()` then writes an unknown seqid into the *new* connection and silently does nothing. The desktop socket path does `onDisconnected()` → `onConnected()`; mobile should match.

Second: `failAllOutstanding()` (`rpc-transport.tsx:471-473`) fails invocations but leaves `_packetizer` holding a partial frame, unlike `close()` (`:456-461`) and `onDisconnected()` (`:239-243`), both of which reset it. Dead weight on mobile (no packetizer) but live on `ProxyNativeTransport.reset()` — the account-switch path — where a half-delivered pre-switch frame concatenates with post-switch bytes into one corrupt decode.

**Files:**
- Modify: `shared/engine/index.platform.tsx` (`onMetaEvent` handler)
- Modify: `shared/engine/rpc-transport.tsx:465-475` (`failAllOutstanding`)
- Test: `shared/engine/rpc-transport.test.ts`

- [ ] **Step 1: Write the failing test for the packetizer reset**

```ts
test('failAllOutstanding clears buffered frame bytes', () => {
  const transport = new TestTransport()
  // Feed half a frame, then reset, then feed a complete frame. The stale half
  // must not be prepended to the new bytes.
  transport.feedRawForTest(halfFrameForTest())
  transport.failAllOutstanding()

  const delivered: Array<unknown> = []
  transport.setIncomingHandler((m: unknown) => delivered.push(m))
  transport.feedRawForTest(completeFrameForTest())

  expect(delivered).toHaveLength(1)
})
```

Reuse the raw-feed helpers built in Task 11.

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts -t 'clears buffered frame bytes'
```
Expected: FAIL — the stale half-frame corrupts the following decode.

- [ ] **Step 3: Reset the packetizer in `failAllOutstanding`**

```ts
  failAllOutstanding() {
    // Also drop any partial frame: on the renderer transport this runs on the
    // account switch, and a half-delivered pre-switch frame would concatenate
    // with post-switch bytes into one corrupt decode.
    this._packetizer.reset()
    // ...existing invocation-failing logic unchanged...
  }
```

Match the real field name (`_packetizer` vs `_p`) and the reset method the sibling `close()`/`onDisconnected()` already call.

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts
```
Expected: PASS

- [ ] **Step 5: Report the disconnect before the reconnect**

In `index.platform.tsx`'s `onMetaEvent` handler:

```ts
          case 'kb-engine-reset':
            // Go dropped the loopback connection; anything in flight is dead.
            // Report the disconnect before the reconnect so the engine cancels
            // its sessions and the UI shows the reconnect state -- the desktop
            // socket path does the same pair.
            client.transport.reset()
            disconnectCallback()
            connectCallback()
```

- [ ] **Step 6: Validate**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts && yarn lint:all
```
Expected: tests pass; lint/bailouts/tsc clean.

- [ ] **Step 7: Manual verification (user drives)**

Ask the user to trigger a mobile engine reset (kill and restart the keybase service while the app is foregrounded) and confirm the app shows the disconnected state and then recovers, rather than sitting on stale spinners.

- [ ] **Step 8: Commit**

```bash
git add shared/engine/index.platform.tsx shared/engine/rpc-transport.tsx shared/engine/rpc-transport.test.ts
git commit -m "fix(engine): report the disconnect on a mobile engine reset

The reset handler called connectCallback without ever calling
disconnectCallback, so _onDisconnect never ran: sessions were not cancelled
and the daemon error was never set, leaving the UI with no reconnect state. A
pending prompt stayed on screen bound to a dead seqid, and answering it wrote
an unknown seqid into the new connection.

Also clear the packetizer in failAllOutstanding, matching close() and
onDisconnected() -- on the renderer transport this runs on the account switch,
where a half-delivered frame would corrupt the first post-switch decode."
```

---

### Task 14: Android — clear the pending JNI exception on allocation failure

**The bug.** `cpp-adapter.cpp:28-31`: if `NewByteArray` fails (OOM on a large attachment payload) it returns null **and leaves `OutOfMemoryError` pending on the JS thread**. The code returns `false` without `ExceptionClear()`, so control returns through `packAndSend` → `rpcOnGo` returns `Value(false)` to JS, and the JS thread continues making further JNI calls with an exception pending: undefined behavior, and a guaranteed abort under CheckJNI.

Also worth fixing while here: if `method(...)` throws (fbjni translating a pending Java exception into `JniException`), `DeleteLocalRef(jba)` is skipped. Using the RAII `local_ref` form removes both the leak and the manual delete.

**Files:**
- Modify: `rnmodules/react-native-kb/android/cpp-adapter.cpp:26-40` (`KbNativeAdapter::writeToGo`)

- [ ] **Step 1: Rewrite `writeToGo` with RAII and an exception clear**

```cpp
  bool writeToGo(void *ptr, size_t size) {
    jni::ThreadScope scope;
    auto env = jni::Environment::current();
    auto jba = env->NewByteArray(size);
    if (jba == nullptr) {
      // NewByteArray leaves OutOfMemoryError pending. Returning with it still
      // set means the JS thread makes its next JNI call with a live exception
      // -- UB, and an abort under CheckJNI.
      env->ExceptionClear();
      return false;
    }
    // Adopt into a local_ref so the ref is released even if the call below
    // throws a JniException.
    auto arr = jni::adopt_local(static_cast<jni::JArrayByte::javaobject>(jba));
    env->SetByteArrayRegion(jba, 0, size, (jbyte *)ptr);
    static auto method =
        JKbModule::javaClassStatic()
            ->getMethod<jboolean(jni::alias_ref<jni::JArrayByte>)>("rpcOnGo");
    auto ok = method(jModule_, arr);
    return ok != JNI_FALSE;
  }
```

- [ ] **Step 2: Compile**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:externalNativeBuildDebug --offline
```
Expected: `BUILD SUCCESSFUL`. If `adopt_local` does not accept that cast, check the fbjni version's signature in `shared/node_modules/react-native/ReactAndroid/src/main/jni/first-party/fbjni` and adapt — the requirement is an owning local ref, not that specific spelling.

- [ ] **Step 3: Commit**

```bash
git add rnmodules/react-native-kb/android/cpp-adapter.cpp
git commit -m "fix(rpc): clear the pending JNI exception when NewByteArray fails

NewByteArray leaves OutOfMemoryError pending on failure. Returning false
without clearing it meant the JS thread's next JNI call ran with a live
exception -- UB, and an abort under CheckJNI. Adopt the array into a
local_ref so the ref is also released if rpcOnGo throws."
```

---

### Task 15: Go — make a short write fatal instead of silently truncating

**Context and scope limit.** `keybase.go:586-593`: `currentConn.Write` can return `n != len(bytes)` **after** delivering `n` bytes. `rpcOnGo` returns `false` and JS fails that one RPC, but the server-side framer now holds a truncated frame and the next write is consumed as its remainder — every subsequent outbound RPC is garbage, indefinitely, with no reset and no desync signal (the new fatal machinery is inbound-only).

**This branch is dead today**: `LoopbackConn.Write` (`go/libkb/loopback.go:166-174`) is all-or-nothing (`lc.ch <- b`, returns `len(b)`), and both other `WriteArr` failure modes leave zero bytes in the stream. One reviewer initially rated this HIGH; a second disproved reachability. Fix it as **defense-in-depth**, and do not describe it as a live bug.

**Files:**
- Modify: `go/bind/keybase.go:580-595` (`WriteArr`)

- [ ] **Step 1: Read the current write path**

Run:
```bash
sed -n '550,600p' go/bind/keybase.go
```
Confirm the exact variable names and the existing error style before editing.

- [ ] **Step 2: Reset the connection on a partial write**

In the short-write branch, reset before returning so a truncated frame cannot survive into the next write:

```go
	if n != len(bytes) {
		// Not reachable through LoopbackConn today, whose Write is
		// all-or-nothing. If a future transport can short-write, the peer's
		// framer is left holding a partial frame and every later write would
		// be consumed as its remainder, so drop the connection rather than
		// corrupt the stream indefinitely.
		Reset()
		return fmt.Errorf("keybase: short write %d of %d", n, len(bytes))
	}
```

Match the file's existing error-construction style (`fmt.Errorf` vs `errors.New`) and confirm `Reset()` is callable from this scope without deadlocking against a lock `WriteArr` already holds — read the surrounding locking before committing to this shape.

- [ ] **Step 3: Build and vet**

Run:
```bash
cd go && go build ./bind/... && go vet ./bind/...
```
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add go/bind/keybase.go
git commit -m "fix(bind): reset the connection on a partial WriteArr

Not reachable through LoopbackConn, whose Write is all-or-nothing, but if a
short write ever happened the peer's framer would hold a truncated frame and
consume every later write as its remainder -- corrupting the outbound stream
indefinitely with no reset and no desync signal, since the stream-fatal
machinery is inbound-only."
```

---

### Task 16: Correct the comments that assert invariants the code doesn't have

Three reviewers independently flagged that this design lives in its comments, and that two of them are wrong. A future maintainer reasoning from them will reach false conclusions.

**Wrong claim 1 — "ReadArr returns nil when idle, so we must sleep or spin a core."** `ReadArr` **blocks**: `LoopbackConn.Read` (`go/libkb/loopback.go:120`) parks on `<-lc.partnerCh`. The `(nil, nil)` return at `keybase.go:650` needs `n == 0 && err == nil`, which a blocking read essentially never produces. The 10ms sleep is dead code in practice — harmless, but the stated rationale is false, and the one way to actually hit it (buffer never allocated because `Init` did not run) turns into a permanent silent 100Hz spin. Three of four reviewers who checked agreed; the fourth confirmed only that the code line exists, not that it is the idle path.

**Wrong claim 2 — "`invalidate` runs on the main thread."** Already corrected by Task 1; verify it landed.

**Files:**
- Modify: `rnmodules/react-native-kb/ios/Kb.mm:364-369`
- Modify: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` (`ReadFromKBLib.run` empty-data branch)

- [ ] **Step 1: Fix the iOS comment and make the degenerate case visible**

```objc
          if (data.length == 0) {
            // Not the idle path: ReadArr blocks in LoopbackConn.Read until
            // there is data, so an empty non-error result is degenerate (it
            // needs n == 0 with no error, which a blocking read does not
            // produce). It is reachable if Init never ran and the shared
            // buffer is zero-length, which would otherwise spin silently.
            kbLogToService(@"rpc read returned no data; is Keybase initialized?");
            [NSThread sleepForTimeInterval:0.01];
            continue;
          }
```

- [ ] **Step 2: Fix the Android comment**

```kotlin
                    if (data == null || data.isEmpty()) {
                        // Not the idle path: readArr blocks until there is
                        // data, so an empty non-error result is degenerate --
                        // reachable if Init never ran and the shared buffer is
                        // zero-length, which would otherwise spin silently.
                        NativeLogger.warn("$NAME: read returned no data; is Keybase initialized?")
                        Thread.sleep(10)
                        continue
                    }
```

- [ ] **Step 3: Verify the Task 1 thread comment landed**

Run:
```bash
grep -n 'main thread' rnmodules/react-native-kb/ios/Kb.mm
```
Expected: no hit inside `invalidate`. If one remains, correct it to "TurboModule shared method queue — any thread".

- [ ] **Step 4: Compile both platforms**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:compileDebugKotlin --offline
cd ../ios && xcodebuild -workspace Keybase.xcworkspace -scheme react-native-kb \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
```
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add rnmodules/react-native-kb/
git commit -m "docs(rpc): correct the reader-loop idle comments

ReadArr blocks in LoopbackConn.Read; it does not poll and return nil when
idle, so the sleep was justified by a rationale the code does not have. The
empty-data branch is actually a degenerate case reachable only if Init never
ran and the shared buffer is zero-length -- log it instead of spinning
silently."
```

---

### Task 17: Observability — make a field log-send show what happened

**The gap.** On a desync, a dropped frame, a failed write, or a reader wedge there is currently no counter and, on Android, no uploadable log line at all: the C++ `onError` and desync messages go to `__android_log_print` (logcat only), while iOS routes through `kbLogToService`. JS write failures use `console.warn`, not `logger`. Every incident is a single line with no rate signal, and a reader wedge is entirely unobservable.

**Files:**
- Modify: `rnmodules/react-native-kb/android/cpp-adapter.cpp` (route `onError` and the desync message through Kotlin)
- Modify: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` (add the log sink)
- Modify: `shared/engine/rpc-transport.tsx` (use `logger`, not `console.warn`)

- [ ] **Step 1: Add a Kotlin log sink callable from JNI**

In `KbModule.kt`, next to `onRpcStreamFatal`:

```kotlin
    // Called from JNI. Routes native bridge errors into the uploadable log --
    // __android_log_print only reaches logcat, which a field log send does not
    // include.
    @DoNotStrip
    fun onNativeLog(message: String) {
        NativeLogger.error("$NAME: $message")
    }
```

- [ ] **Step 2: Call it from the C++ error and fatal callbacks**

In `KbNativeAdapter`, add:

```cpp
  void onLog(const std::string &message) {
    jni::ThreadScope scope;
    static auto method =
        JKbModule::javaClassStatic()
            ->getMethod<void(jni::alias_ref<jni::JString>)>("onNativeLog");
    method(jModule_, jni::make_jstring(message));
  }
```

and in `getBindingsInstaller`, replace the `onError` callback body and add the same to the fatal callback (both now capture `adapter` strongly, per Task 5):

```cpp
            [adapter](const std::string &err) {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "JSI error: %s", err.c_str());
              adapter->onLog("jsi error: " + err);
            },
```

```cpp
            [adapter]() {
              __android_log_print(ANDROID_LOG_ERROR, "KBBridge",
                                  "rpc stream desync, resetting connection");
              adapter->onLog("rpc stream desync, resetting connection");
              adapter->onFatal();
            });
```

- [ ] **Step 3: Route the JS write failure through `logger`**

In `rpc-transport.tsx`, find the `console.warn` on the write-failure path and replace it with the module's `logger.error`, matching how the rest of the file logs. Run:

```bash
cd shared && grep -n 'console.warn' engine/rpc-transport.tsx
```
and convert each hit on an error path.

- [ ] **Step 4: Compile and validate**

Run:
```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:externalNativeBuildDebug :react-native-kb:compileDebugKotlin --offline
cd .. && yarn lint:all
```
Expected: build succeeds; lint/bailouts/tsc clean.

- [ ] **Step 5: Commit**

```bash
git add rnmodules/react-native-kb/android/ shared/engine/rpc-transport.tsx
git commit -m "fix(rpc): route Android native bridge errors into the uploadable log

The C++ onError and desync messages only reached logcat, which a field log
send does not include -- so the two failure modes this branch added detection
for were invisible in exactly the reports that need them. iOS already routed
through kbLogToService. Also move the JS write-failure warn onto logger so it
appears in a log send."
```

---

### Task 18: C++ — release the receive buffer's peak, and fix the size-limit off-by-header

**Two small bugs.**

`msgpack::unpacker` only rewinds in place (`msgpack/v1/unpack.hpp:1128-1136`); it never shrinks the `realloc`'d buffer. The send side handles this explicitly (`kSendBufKeepCapacity = 4MB`), the receive side has no equivalent, so one large attachment frame pins up to 64MB of native RSS for the rest of the session on a phone.

Separately, the limit check compares `up.nonparsed_size() > kMaxFrameSize`, but `nonparsed_size()` includes the header bytes plus any bytes of the *following* frame, while the header check accepts a declared size of exactly `kMaxFrameSize`. A legal maximal frame arriving in 300KB chunks therefore trips the fatal path on its last chunk.

**Files:**
- Modify: `rnmodules/react-native-kb/cpp/react-native-kb.cpp` (`onDataFromGo`)

- [ ] **Step 1: Give the size limit headroom**

Replace the limit check:

```cpp
      // nonparsed_size() includes the frame header and any bytes of the next
      // frame already in the buffer, while the header check accepts a declared
      // size of exactly kMaxFrameSize -- so compare with headroom or a legal
      // maximal frame trips this on its last chunk.
      if (up.nonparsed_size() > kMaxFrameSize + kMaxFrameSlack) {
        throw std::runtime_error("rpc frame exceeds size limit");
      }
```

and define the slack next to `kMaxFrameSize`:

```cpp
// Header bytes plus whatever of the following frame arrived in the same read.
static constexpr size_t kMaxFrameSlack = 1024 * 1024;
```

- [ ] **Step 2: Shrink the receive buffer at a safe resync point**

After the drain loop, still under `recvMutex_`, add:

```cpp
      // msgpack::unpacker rewinds but never shrinks, so one large frame would
      // pin its peak for the rest of the session. needSize with nothing
      // unparsed is a provably safe point to start over: no partial frame and
      // no state to lose.
      if (recv_->state == ReadState::needSize && up.nonparsed_size() == 0 &&
          up.parsed_size() > kRecvBufKeepCapacity) {
        resetRecvLocked();
      }
```

with, next to the other constants:

```cpp
static constexpr size_t kRecvBufKeepCapacity = 4 * 1024 * 1024;
```

Read `resetRecvLocked()` before relying on it — confirm it constructs a fresh `unpacker` (which is what actually frees the buffer) rather than only resetting flags. If it does not, this task must add that.

- [ ] **Step 3: Syntax check**

Run the Task 0 Step 3 command.
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add rnmodules/react-native-kb/cpp/react-native-kb.cpp
git commit -m "fix(rpc): release the receive buffer peak and fix the size-limit margin

msgpack::unpacker rewinds but never shrinks, so a single large attachment
frame pinned up to 64MB of native RSS for the session -- the send side
already caps its retained capacity. Start over at a needSize boundary with
nothing unparsed, which is a safe resync point.

Also give the limit check headroom: nonparsed_size() includes the header and
any of the next frame already buffered, so a legal maximal frame tripped the
fatal path on its last chunk."
```

---

### Task 19: Go — return a copy from `ReadArr`

**Rationale.** The permanent-reader design is correct and stays regardless. But `ReadArr` returning `buffer[0:n]` — a view of one 300KB package global (`keybase.go:348, 595, 639`) — makes "exactly one reader, forever" a *load-bearing* invariant enforced only by comments across three languages. gomobile already copies at the JNI/ObjC boundary, so returning a fresh slice costs one memcpy of a few KB on a path already doing a cross-language round trip, and converts a silent-corruption footgun into a non-issue.

The architecture reviewer recommended this explicitly as the one cheap Go-side hardening worth taking. It is last because nothing else depends on it.

**Files:**
- Modify: `go/bind/keybase.go:636-640` (`ReadArr` return)

- [ ] **Step 1: Read the current return**

Run:
```bash
sed -n '625,655p' go/bind/keybase.go
```

- [ ] **Step 2: Return a copy**

```go
	// Copy rather than returning a view of the shared buffer. gomobile copies
	// at the language boundary anyway, so this costs one memcpy of a few KB on
	// a call that is already crossing into ObjC/JNI -- and it means a second
	// reader can no longer silently corrupt an in-flight delivery, instead of
	// that being an invariant held up only by comments in three languages.
	out := make([]byte, n)
	copy(out, buffer[:n])
	return out, nil
```

Delete the now-stale "Returning a view of the shared buffer…" comment above it.

- [ ] **Step 3: Build and vet**

Run:
```bash
cd go && go build ./bind/... && go vet ./bind/...
```
Expected: exit 0, no output.

- [ ] **Step 4: Update the serial-access comment**

The `ReadArr` doc comment still says it must be called serially. That remains true for the `conn.Read` ordering, but is no longer true for buffer aliasing. Update it to say exactly which part still requires serialization, so a future reader does not conclude the whole constraint was lifted.

- [ ] **Step 5: Commit**

```bash
git add go/bind/keybase.go
git commit -m "fix(bind): return a copy from ReadArr instead of a shared-buffer view

ReadArr handed back a view of one package-global buffer, making 'exactly one
reader, forever' a load-bearing invariant enforced only by comments across
Go, ObjC and Kotlin. gomobile copies at the language boundary regardless, so
a fresh slice costs one memcpy of a few KB on a call already crossing into
JNI/ObjC, and a stray second reader can no longer corrupt an in-flight
delivery."
```

---

### Task 20: Harden the `rpcOnJs` batch dispatch edges

**Two small TS bugs.**

`index.platform.tsx` handles `count > 1 && Array.isArray(objs)`, but a non-array with `count > 1` now falls through to `dispatchOne(objs)` — one "Bad input packet" warning and `count - 1` messages vanish. Native never produces this (the C++ always builds an array when `size() > 1`), so it is defensive only, but it should be loud rather than silent.

Separately, three call sites log the identical string `'>>>> rpcOnJs JS thrown!'` — including the unrelated renderer path — which makes a real log dump ambiguous about which guard fired.

**Files:**
- Modify: `shared/engine/index.platform.tsx` (the `rpcOnJs` assignment and the three log sites)

- [ ] **Step 1: Make the count/shape mismatch loud and give each guard a distinct message**

```ts
    const dispatchOne = (obj: unknown) => {
      try {
        client.transport.dispatchDecodedMessage(obj)
      } catch (e) {
        logger.error('rpcOnJs: dispatch threw', e)
      }
    }

    global.rpcOnJs = (objs: unknown, count: number) => {
      try {
        if (count > 1) {
          if (!Array.isArray(objs)) {
            // Native always sends an array when it batches, so this means the
            // two sides disagree -- and count-1 messages would vanish silently.
            logger.error(`rpcOnJs: count ${count} but payload is not an array`)
            return
          }
          for (const obj of objs) {
            dispatchOne(obj)
          }
        } else {
          dispatchOne(objs)
        }
      } catch (e) {
        logger.error('rpcOnJs: batch guard threw', e)
      }
    }
```

- [ ] **Step 2: Rename the unrelated renderer log site**

Run:
```bash
cd shared && grep -n 'rpcOnJs JS thrown' engine/index.platform.tsx
```
Any remaining hit is the renderer path — give it its own message describing what it actually guards.

- [ ] **Step 3: Validate**

Run:
```bash
cd shared && yarn lint:all
```
Expected: clean, 0 bailouts.

- [ ] **Step 4: Commit**

```bash
git add shared/engine/index.platform.tsx
git commit -m "fix(engine): fail loudly when rpcOnJs count and payload disagree

A non-array with count > 1 fell through to a single dispatch, discarding
count-1 messages with only a generic warning. Native always batches into an
array, so a mismatch means the two sides disagree and should say so. Also
give the three identical '>>>> rpcOnJs JS thrown!' sites distinct messages --
they guard different things and a log dump could not tell them apart."
```

---

### Task 21: TS — surface failed writes on the response and renderer paths

**Two remaining silent-drop paths, both the mirror image of the fix this branch already made for invokes.**

`send()` now correctly returns `false` on a write failure, but `makeResponse` (`rpc-transport.tsx:493, 496`) **ignores the return**. If `KeybaseWriteArr` fails while answering an incoming service RPC, `rpcOnGo` returns false → `writeMessage` throws → `send` returns false → nobody notices, and the service side hangs on that call forever. The invoke direction is handled properly (`invokeNow`, callback fired exactly once with the error); the response direction is not. Two reviewers flagged this independently.

Separately, `ProxyNativeTransport.writeMessage` (`index.platform.tsx:142-145`) does `engineSend?.(message)` — if `engineSend` is undefined it silently no-ops and `send()` returns `true`, leaving the RPC outstanding forever. Identical to the mobile bug this branch fixed, still live on the renderer.

**Files:**
- Modify: `shared/engine/rpc-transport.tsx:488-500` (`makeResponse`)
- Modify: `shared/engine/index.platform.tsx:142-145` (`ProxyNativeTransport.writeMessage`)
- Test: `shared/engine/rpc-transport.test.ts`

- [ ] **Step 1: Read `makeResponse`**

Run:
```bash
cd shared && sed -n '485,505p' engine/rpc-transport.tsx
```
Note both `send()` call sites (the result path and the error path) and the surrounding logger usage.

- [ ] **Step 2: Write the failing test**

```ts
test('a failed response write is reported, not swallowed', () => {
  const transport = new TestTransport()
  transport.failNextWriteForTest()
  const errors: Array<unknown> = []
  jest.spyOn(logger, 'error').mockImplementation((...args) => errors.push(args))

  const response = transport.makeResponseForTest({seqid: 11})
  response.result({})

  expect(errors).toHaveLength(1)
})
```

Build `failNextWriteForTest` / `makeResponseForTest` against the real surface, matching the conventions already in the file. If `makeResponse` is not reachable from the test, drive it through `dispatchDecodedMessage` with an invoke frame (the helper from Task 12) and answer the resulting response.

- [ ] **Step 3: Run it and watch it fail**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts -t 'failed response write'
```
Expected: FAIL — `errors` is empty, because the `false` return is discarded.

- [ ] **Step 4: Report the failure in `makeResponse`**

At both `send()` call sites:

```ts
      if (!this.send(...)) {
        // The service is waiting on this reply and nothing else will tell it.
        // A failed write here means the connection is gone, so the caller
        // hangs forever unless this is visible.
        logger.error(`failed to write response for seqid ${seqid}`)
      }
```

Use the real argument shape at each site rather than the elision above — read them in Step 1.

- [ ] **Step 5: Make the renderer's missing `engineSend` throw**

```ts
class ProxyNativeTransport extends LocalTransport {
  protected writeMessage(message: RPCMessage) {
    const {engineSend} = KB2.functions
    if (!engineSend) {
      // Silently no-oping leaves the invocation outstanding forever. Throwing
      // lets the transport fail it, same as the mobile path.
      throw new Error('engineSend missing')
    }
    engineSend(message)
  }
```

- [ ] **Step 6: Run to verify it passes**

Run:
```bash
cd shared && yarn jest engine/rpc-transport.test.ts
```
Expected: PASS

- [ ] **Step 7: Validate and commit**

```bash
cd shared && yarn lint:all
```

```bash
git add shared/engine/rpc-transport.tsx shared/engine/index.platform.tsx shared/engine/rpc-transport.test.ts
git commit -m "fix(engine): surface failed writes on the response and renderer paths

makeResponse ignored send()'s new false return, so a write that failed while
answering an incoming service RPC left the service hanging forever -- the
mirror image of the invoke-direction hang this branch fixed.
ProxyNativeTransport.writeMessage had the same shape: a missing engineSend
no-oped and reported success, leaving the invocation outstanding."
```

---

## Final Verification

- [ ] **Full TS validation**

```bash
cd shared && yarn lint:all && yarn jest engine/
```
Expected: lint clean, 0 bailouts, tsc clean on both configs, all engine tests pass.

- [ ] **Full native builds**

```bash
./plans/scripts/sync-native-kb.sh
cd shared/android && ./gradlew :react-native-kb:externalNativeBuildDebug :react-native-kb:compileDebugKotlin --offline
cd ../ios && xcodebuild -workspace Keybase.xcworkspace -scheme react-native-kb \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
cd ../../go && go build ./bind/... && go vet ./bind/...
```
Expected: all succeed.

- [ ] **Confirm no stray edits to the node_modules copy**

```bash
git status --short
```
Expected: only tracked files under `rnmodules/`, `shared/engine/`, `go/bind/`, `plans/`. `shared/node_modules/` must not appear.

- [ ] **Manual smoke (user drives — never drive the simulator or device yourself)**

Ask the user to verify on each platform: cold start reaches the inbox; send and receive a message; background and foreground the app; on Android, back-button to home then relaunch (Task 2's case); switch accounts (Task 10's case). Report exactly what they confirm — do not claim a platform is verified without their word.

---

## Deferred — needs a decision, not in scope here

These came out of review but should not be actioned without the user choosing:

1. **Dead `engineReset` TurboModule method** (Task 10 Step 5) — delete it across the spec plus both platform implementations, or wire the account-switch path to it. Spans the codegen'd spec; wider blast radius than the rest of this plan.
2. **No backpressure from the reader to JS** — `invokeAsync` is unbounded, so a stalled JS thread lets the reader queue batches that each retain a msgpack zone. Pre-existing, but the permanent reader makes it permanent. Needs a bounded-queue design decision.
3. **Second `ReactHost` / multi-instance** — one `g_bridge`, one `instance`, one Go `conn`; a second host starves silently. Not a regression and single-host may be a hard invariant, but nothing documents or asserts it. Either add an assert or a header comment saying so.
4. **iOS reader thread QoS** — the reader inherits the QoS of whatever submitted it (`_sharedModuleQueue`) and freezes it for the process lifetime, permanently consuming one libdispatch worker. A dedicated `NSThread` with an explicit `qualityOfService` is the canonical shape for a permanent blocking loop.
5. **`packNumber` above 2^53** — emits uint64/int64 where `@msgpack/msgpack` emits float64, so a double of 2^60 encodes as a different msgpack type than the desktop path. Harmless for current RPC shapes; the comment claiming equivalence overstates it. Also `-0` packs as uint `0`.
6. **`kbTeardown` is a plain writable global** — any JS doing `globalThis.kbTeardown = undefined` makes it collectible, and the finalizer then runs `teardown()` on a *live* runtime, permanently setting `isTornDown_` with no recovery short of a reload. Define it non-writable/non-configurable.
7. **Assorted C++ LOWs not worth their own task**, but real: `resetCaches` compares runtimes by pointer, so a new `Runtime` allocated at a freed one's address would keep stale handles (unreachable today with one bridge per runtime, but that function exists for the multi-runtime case — a generation counter is safer); `arrayBuf.data(runtime) + offset` is `nullptr + 0` for a detached ArrayBuffer, which is UB per the standard even though it is benign in practice; `callInvoker_` is dereferenced unguarded while `writeToGo_` and `recv_` are both null-checked; and `install()` is unsynchronized and its "call exactly once, before publication" requirement is enforced only by how the platform layers happen to call it. Bundle these into one cleanup pass if desired.
8. **Android copies per RPC** — three on the outbound path (`SetByteArrayRegion`, Go's load-bearing `make`/`copy`, the loopback) and an avoidable one inbound (`pin()` uses `GetByteArrayElements` and releases with mode 0, copying unmodified data back). `GetByteArrayRegion` straight into `up.buffer()` would drop one round trip. Perf only, and this is a perf branch, so worth considering — but it touches the hot path and deserves measurement first.
9. **`~KBBridge` can run on any thread** (C++ F2) — the destructor is `= default` and destroys jsi handles; the safety argument rests entirely on `KBTearDownSimple` having already nulled them on the JS thread, which nothing enforces. Either pin the bridge's lifetime to the host object with a strong `shared_ptr`, or add a debug assert so it regresses loudly. Deferred because the strong-ref option changes ownership across both platforms and deserves its own review.

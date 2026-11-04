---
name: running-e2e-release-gates
description: Use when asked to run the e2e flows, the release gate, or an e2e screenshot report for the Electron/desktop app or the iOS simulator (yarn test:e2e:desktop:release, yarn test:e2e:ios:release), or when stopping or checking on such a run.
---

# Running the e2e release gates

The desktop and iOS gates each run preflight → launch → sweep → flows → visual tour → census → report → secret scan. Their preflight refuses a broken setup, but several things it can't see have wasted whole runs before. Do every step below, in order.

## Rules

- **Serial, never parallel.** Both gates take `/tmp/kb-e2e-release.lock` and sweep the same test accounts. When both are asked for, run desktop first, wait for it to exit, then iOS. Start iOS even if desktop failed, and report both.
- If preflight says the lock is held, check `pgrep -fl release.mts`. If a gate is running, wait for it. If none is, ask the owner before removing the lock.
- If a check needs the owner (personal account active, `sudo`, an unsigned or stale app on the sim), stop that gate and report it. Don't work around it, even when the owner is away.
- **Full runs are expensive** (desktop's deadline is 150 min, iOS's is 275 min). Run a full gate only when asked, or as the last step before a push. While iterating, run the targeted flow files.
- From `shared/`. Write the gate's own logs to the session scratchpad. The service and KBFS logs go where the harness reads them (`/tmp/kb-e2e/`).

## Before any run

1. **Keep the Mac awake.** Start `caffeinate -d -i -m` as a background task, and stop it when the last gate exits. A locked session throttles the simulator, and preflight refuses to run.
2. **Run a freshly built local service and KBFS, never the installed (prod) Keybase.** Set `K=$(go env GOPATH)/bin/keybase`. The `keybase` on PATH is the installed app's client.
   1. Build both from `go/`: `go install github.com/keybase/client/go/keybase github.com/keybase/client/go/kbfs/kbfsfuse`. `$(go env GOPATH)/bin/kbfs` must be a symlink to `kbfsfuse`.
   2. Stop the installed Keybase if any of it runs (`pgrep -fl /Applications/Keybase.app`, `launchctl list | grep keybase`): `/Applications/Keybase.app/Contents/SharedSupport/bin/keybase ctl stop`. That stops its service, KBFS, updater and GUI, and also quits the Keybase app in a booted simulator; the iOS gate relaunches that app itself. Wait until both checks come back empty. Leave the e2e peer services (`keybase --home .../keybase-e2e/homes/...`) running.
   3. Start the service as a background task, logging to the env file's `KB_E2E_SERVICE_LOG` (`/tmp/kb-e2e/service.log`): `exec $K -d --log-file=/tmp/kb-e2e/service.log service`. Wait until `$K whoami` answers. The runtime-stats flow reads this log, so a different path fails it.
   4. Start KBFS as a background task with the harness's own command (`KBFS_START_COMMAND` in `shared/tests/e2e/shared/gate/processes.ts`, without the `&`): `exec $(go env GOPATH)/bin/kbfsfuse -debug -log-file /tmp/kb-e2e/kbfs.log /Volumes/Keybase`. The KBFS-detailed-logging flow reads that log, so a different path fails it. Without FUSE installed, its "failed to FUSE mount" error is expected; KBFS keeps serving. On macOS the service doesn't start KBFS; launchd does, from a plist that points at the installed binary. Wait until `$K fs ls /keybase/private/$KB_SMOKE_USER` answers.
   5. A rebuilt binary can trigger a macOS keychain prompt. Until someone clicks Allow, the service sits unbootstrapped. Tell the owner to watch for it.
   6. Both processes are background tasks of this session and die with it. When the work is done, stop them. Ask the owner before restoring the installed app (`open -a Keybase`).
3. **Use a test account.** `$K whoami` must print `$KB_SMOKE_USER` from the e2e env file. If it prints the owner's personal account, stop and ask.
4. **KBFS is online, not just answering.** Preflight only runs `keybase fs ls`, which can succeed while the app's Files tab shows *offline*. Also check:
   - `pgrep -fl bin/kbfsfuse`: the local KBFS is up.
   - `grep -E "MDServer Unauthorized|MDServerRemote is disconnected" /tmp/kb-e2e/kbfs.log | tail`: there's no disconnect that a later `MDServerRemote ... Connection: connected` didn't resolve.
   If KBFS looks offline, stop and report it. Don't start a gate on it: the Files and deep-link flows will fail.

## Desktop: `yarn test:e2e:desktop:release`

1. Run `rm -rf node_modules/.vite`. A stale Vite pre-bundle serves old dependencies and fakes regressions.
2. Ports 4000, 9222 and 9229 must be free. If an app you didn't launch holds them, stop it (the owner allows this), but never drive it.
3. `KB_E2E_NO_OPEN=1 yarn test:e2e:desktop:release > <scratchpad>/desktop-release.log 2>&1` with `run_in_background`.

## iOS: `yarn test:e2e:ios:release` (only after desktop has exited)

1. Boot the sim with a visible window: `xcrun simctl boot iPhoneTest; open -a Simulator`. A hidden simulator renders throttled.
2. The installed app must be a **signed** dev build. Never `simctl install` an unsigned (`CODE_SIGNING_ALLOWED=NO`) build: it logs the sim out.
3. If `simctl` hangs, check `pgrep -fl runFirstLaunch`. If it's waiting, ask the owner to run `! sudo xcodebuild -runFirstLaunch`. After any Xcode update, run `killall -9 com.apple.CoreSimulator.CoreSimulatorService` and reboot the sim.
4. `KB_E2E_NO_OPEN=1 yarn test:e2e:ios:release > <scratchpad>/ios-release.log 2>&1` with `run_in_background`.

## Targeted desktop runs (not the gate)

Do the "Before any run" steps and the Vite clear, then:

1. `node tests/e2e/electron/launch-app.mts` (kills any earlier app, launches, waits until ready).
2. `yarn -s test:e2e:desktop:flows tests/e2e/electron/flows/<file>.test.ts [-g "<title>"]`. Don't pass `--reporter`: it replaces the configured reporters, so no `results.json` gets written and the secret scan doesn't run.

Runs outside the gate write under `tests/results/targeted/` (`test-results/`, `report/`). The gate's own results in `tests/results/` stay in place, so `yarn test:e2e:desktop:report` can still rebuild the gate's report. `yarn test:e2e:desktop:report:targeted` builds `tests/results/targeted/electron-report.html` from the targeted run. Each targeted invocation empties `tests/results/targeted/test-results/`, so read a failure's `test-failed-1.png` and `error-context.md` before you start the next invocation. To reproduce a failure from a gate run, run the flows that ran before it in the gate's order (the numbered `✓` lines in the gate log), not just the failing file. Earlier flows such as device provisioning and account switches leave state behind.

## While it runs

- Watch the log only until the preflight line (`preflight: ok` or `preflight: FAILED`), then stop the monitor. Per-test lines are noise, and you get a notification when the run exits.
- If preflight refuses, do what its message says and rerun. Don't work around the check.
- **To stop a run**, run `pkill -INT -f "electron/release.mts"` (iOS: `ios-appium/release.mts`; confirm with `pgrep -fl release.mts`) and wait for the `=== release summary ===` block. SIGINT lets it stop its app, Metro and Appium, release the lock and scan for secrets. Killing the background shell or yarn skips all of that.

## Reporting

Paste the `=== release summary ===` block (one line per phase) and give the full paths:

- `shared/tests/results/electron-report.html` and `shared/tests/results/ios-report.html` (the screenshot reports)
- `shared/tests/results/census.md` and `shared/tests/results/manual-checklist.md` (desktop), or `shared/tests/results/ios-census.md` and `shared/tests/results/ios-manual-checklist.md` (iOS)

A path marked `(not written by this run)` is stale output from an earlier run. Say so.

Name every failing flow. For each one, look at its `test-results/*/test-failed-1.png` and `error-context.md` before guessing a cause.

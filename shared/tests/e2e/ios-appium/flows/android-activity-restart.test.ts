import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'
import {anyExist, byText, el, els, waitForTestID, enterText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

// Regression coverage for the Android "back-button wedge" (fixed in
// 15647bb4d4, HOTPOT-rpc-fixes). onHostDestroy fires when the LAST ACTIVITY
// is destroyed while the ReactInstance/TurboModules SURVIVE (MainApplication
// holds the ReactHost in an application-scoped `by lazy`) — pressing back
// from the root exits to the launcher this way, without killing the process.
// The bug: nativeInvalidate() was reachable from that path and nulled the
// C++ g_bridge, which only the JSI bindings installer repopulates — and a
// surviving ReactInstance never re-runs that installer. Outbound RPC still
// "works" (writeArr doesn't check g_bridge), so every inbound reply is
// silently dropped for the life of the process; the app looks alive and
// never gets a response. Reopening the app (without a process restart) must
// still be able to complete a full RPC round trip.
const ANDROID_PACKAGE = 'io.keybase.ossifrage'

describe('android activity restart (back-button RPC wedge)', () => {
  it('keeps inbound RPC alive after the Activity (not the process) is destroyed and reopened', async () => {
    if (!browser.isAndroid) return

    // Proving the process survived needs `mobile: shell`, which needs the
    // appium service running with relaxedSecurity. That widens what the local
    // appium server will execute, so it is opt-in. Without it this test cannot
    // tell a surviving process from a fresh one, and a fresh one reinstalls the
    // bridge and passes while proving nothing — so skip instead of pretending.
    if (!process.env['KB_E2E_RELAXED_SECURITY']) {
      console.warn(
        'android-activity-restart: SKIPPED — set KB_E2E_RELAXED_SECURITY=1 to run it (needs appium relaxedSecurity for pidof)'
      )
      return
    }

    requireSmokeUser()
    await escapeToTabs()
    await navigateToChat()

    // Baseline: inbound RPC works before we touch the Activity lifecycle at
    // all. If there are no conversations to prove this with, the rest of the
    // test can't prove anything either.
    if (!(await anyExist(T.CHAT_INBOX_ROW))) {
      throw new Error('android-activity-restart: no chat conversations to establish an RPC baseline with')
    }

    // Capture the process PID BEFORE destroying the Activity. `mobile: shell`
    // needs the appium service started with relaxedSecurity (wdio.android.conf.ts).
    const pidBefore = await getAppPid()
    if (!pidBefore) {
      throw new Error(
        'android-activity-restart: could not read a PID via `mobile: shell pidof` — cannot prove ' +
          'process continuity, which is the entire point of this test. Refusing to continue rather ' +
          'than risk a false green (see comment above getAppPid).'
      )
    }

    // Destroy the Activity WITHOUT killing the process: press back all the
    // way out to the launcher. Do NOT use terminateApp/closeApp — killing the
    // process resets init{} and the bindings installer, which would make the
    // wedge impossible to reproduce and this test a false green.
    for (let i = 0; i < 12; i++) {
      const pkg = await browser.getCurrentPackage().catch(() => '')
      if (pkg !== ANDROID_PACKAGE) break
      await browser.back()
      await browser.pause(500)
    }
    const pkgAfterBack = await browser.getCurrentPackage().catch(() => '')
    if (pkgAfterBack === ANDROID_PACKAGE) {
      throw new Error('android-activity-restart: never left the app after 12 back presses')
    }

    // Give onHostDestroy a moment to actually run before reopening.
    await browser.pause(1000)

    // Reopen via activateApp, which brings the existing process's task back to
    // the foreground and creates a NEW Activity — it does not relaunch the
    // process. (This mirrors escapeToTabs' own recovery path.)
    await browser.activateApp(ANDROID_PACKAGE)
    await browser.waitUntil(async () => (await browser.getCurrentPackage().catch(() => '')) === ANDROID_PACKAGE, {
      timeout: 10000,
      interval: 250,
    })

    // The critical guard: if the PID changed, Android killed the process
    // during step 3 (low memory, aggressive OEM task killer, etc). That means
    // activateApp started a FRESH process — init{} reran, the bridge was
    // reinstalled, and any pass below would prove nothing about the wedge.
    // Fail loudly rather than silently pass on a meaningless run.
    const pidAfter = await getAppPid()
    if (pidAfter !== pidBefore) {
      throw new Error(
        `android-activity-restart: process PID changed (${pidBefore} -> ${pidAfter}) — Android killed ` +
          'the process instead of just the Activity, so this run cannot exercise the back-button wedge ' +
          '(a fresh process reinstalls the native bridge via init{}, masking the bug). Not a real failure ' +
          'of the fix; the environment did not hold up its end. Re-run on a device/emulator with more ' +
          'headroom, or investigate why the process was killed.'
      )
    }

    await escapeToTabs()
    await navigateToChat()
    await waitForTestID(T.CHAT_INBOX_ROW, 5000)
    await els(T.CHAT_INBOX_ROW)[0]!.click()
    await waitForTestID(T.CHAT_MESSAGE_LIST, 5000)

    // Strongest available proof of a live inbound RPC path: a full round trip.
    const testMessage = `e2e-restart-${Date.now()}`
    await waitForTestID(T.CHAT_INPUT, 5000)
    await enterText(T.CHAT_INPUT, testMessage)
    await waitForTestID(T.CHAT_SEND_BUTTON, 3000)
    await el(T.CHAT_SEND_BUTTON).click()

    const sent = byText(testMessage)
    await sent.waitForDisplayed({
      timeout: 5000,
      timeoutMsg: `sent message "${testMessage}" never appeared after Activity restart — inbound RPC is likely wedged`,
    })
    await expect(sent).toBeDisplayed()
  })
})

// `pidof` via `mobile: shell` is the process-continuity signal: it requires
// the appium service to run with relaxedSecurity (see wdio.android.conf.ts).
// Returns undefined if the command isn't available or the app isn't running,
// in which case the caller must refuse to proceed rather than assume
// continuity it can't actually prove.
async function getAppPid(): Promise<string | undefined> {
  try {
    const result = (await browser.execute('mobile: shell', {
      command: 'pidof',
      args: [ANDROID_PACKAGE],
    })) as string | {stdout?: string} | undefined
    const raw = typeof result === 'string' ? result : (result?.stdout ?? '')
    const pid = raw.trim().split(/\s+/)[0]
    return pid || undefined
  } catch {
    return undefined
  }
}

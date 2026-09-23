import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {byText, tab} from '../helpers/elements'
import {
  activateApp,
  appPid,
  appSnapshot,
  backgroundApp,
  closeNotificationCenter,
  crashReportsSince,
  findLines,
  goAppStateUpdates,
  goLogMark,
  goLogSince,
  launchApp,
  metroClientLogSince,
  metroLogMark,
  openNotificationCenter,
  openSelfConversation,
  startSenderDevice,
  terminateApp,
  waitFor,
  waitForAppState,
  waitForAvatar200,
  waitForLinesInOrder,
} from '../helpers/lifecycle'

// Log lines these flows rely on:
// - Go (ios.log): "MobileAppState.Update: useful update: <FOREGROUND|BACKGROUND|BACKGROUNDACTIVE|
//   INACTIVE>, …" per Go app state transition (deduped: only logged when the state actually
//   changes — iOS resign-active reports BACKGROUNDACTIVE, not INACTIVE, so gregor/the image
//   server stay up through it), "startHTTPSrv: start success: addr: <address>" when the image
//   server starts on a new address, "kbhttp.Srv: server starting on: <address>" on every start
//   of a Go http server.
// - Metro (JS): "[AppState] native: <active|inactive|background>" for every native lifecycle
//   report JS's listener takes (onNativeAppLifecycle in constants/init/shared.tsx) once
//   subscribed, and "app focus changed: <state>" when the shell store's app state changes.
// The cold launch test requires a match of each server line, so an empty result in the
// Notification Center test means no restart, not a pattern that no longer matches Go's log.
const httpSrvStarted = /startHTTPSrv: start success: addr: /
const httpSrvStartedAny = /kbhttp\.Srv: server starting on: /
// Go dedupes state transitions, so "BACKGROUND" alone would also match "BACKGROUNDACTIVE"; the
// trailing comma from "useful update: %v, we are currently in state: %v" disambiguates them.
const goForeground = /useful update: FOREGROUND,/
const goBackground = /useful update: BACKGROUND,/
const goBackgroundActive = /useful update: BACKGROUNDACTIVE,/
describe('app lifecycle: app state', () => {
  it('cold launch reaches active under scenes and serves images', async () => {
    const user = requireSmokeUser()
    const since = Date.now()
    await terminateApp()
    const goMark = goLogMark()
    await launchApp()

    // The app restores its last screen, which may hide the tab bar, so wait on state.
    const snap = await waitForAppState('active', undefined, 90000)
    // Go defaults to FOREGROUND at process start; didFinishLaunching reports the real
    // (not-yet-active) state before RN even starts, then didBecomeActive reports active. JS's
    // own listener mounts only once the bundle has loaded, which can race either report on a
    // cold launch, so the launch is proven from Go's deterministic two-step transition instead
    // of a JS log line.
    const goLines = await waitForLinesInOrder('Go to report the launch', () => goLogSince(goMark), [
      goBackgroundActive,
      goForeground,
    ])
    expect(goLines).toHaveLength(2)
    // JS must hold the address of the server Go started, not a stale one.
    const started = findLines(goLogSince(goMark), httpSrvStarted).at(-1) ?? ''
    expect(started).toContain(`addr: ${snap.httpSrv.address} `)
    expect(findLines(goLogSince(goMark), httpSrvStartedAny).length).toBeGreaterThanOrEqual(1)

    const avatar = await waitForAvatar200(user)
    expect(avatar.status).toBe(200)

    // The UIScene SIGTRAP crashed within a second of launch; give it several.
    const pid = appPid()
    await browser.pause(5000)
    expect(appPid()).toBe(pid)
    expect(crashReportsSince(since)).toEqual([])
  })

  it('background, then foreground: images load and chat receives a new message', async () => {
    const user = requireSmokeUser()
    const since = Date.now()
    const convID = await openSelfConversation(user)
    const sender = await startSenderDevice(user)
    try {
      const pid = appPid()
      const goMark = goLogMark()
      const metroMark = metroLogMark()
      await backgroundApp()
      // resignActive reports BACKGROUNDACTIVE before didEnterBackground drops to BACKGROUND.
      await waitForLinesInOrder('Go to go to the background', () => goLogSince(goMark), [
        goBackgroundActive,
        goBackground,
      ])

      const text = `e2e-lifecycle-recv-${Date.now()}`
      await sender.send(convID, text)
      await browser.pause(10000)
      await activateApp()

      const snap = await waitForAppState('active')
      expect(snap.screen?.params?.['conversationIDKey']).toBe(convID)
      // A background-fetch task (go/bind/keybase.go's BackgroundSync, run from a BGAppRefreshTask)
      // can legitimately flip Go BACKGROUND -> BACKGROUNDACTIVE -> BACKGROUND again during the
      // 10s window above; drop those extra flips and require only that the app reached
      // BACKGROUND, then later FOREGROUND, exactly once each and in order.
      expect(goAppStateUpdates(goMark).filter(s => s !== 'BACKGROUNDACTIVE')).toEqual(['BACKGROUND', 'FOREGROUND'])
      // JS's own listener has been mounted since well before this test started, so unlike the
      // cold-launch case there's no race with subscribing: it must see the same round trip
      // directly from native (constants/init/shared.tsx's onNativeAppLifecycle), independent of
      // Go's app-state machine. A second device is attached to the same Metro server for the
      // send below, so this only checks containment (not an exact sequence) in case its own,
      // unrelated activity lands in the same shared log window.
      const jsStates = findLines(metroClientLogSince(metroMark), /\[AppState\] native: /)
      expect(jsStates.some(l => l.endsWith('background'))).toBe(true)
      expect(jsStates.at(-1)).toMatch(/\[AppState\] native: active$/)
      await waitForAvatar200(user)

      // The message sent from the other device while this one was in the background.
      await byText(text).waitForExist({interval: 250, timeout: 60000, timeoutMsg: `"${text}" never arrived`})
      expect(appPid()).toBe(pid)
      expect(crashReportsSince(since)).toEqual([])
    } finally {
      // A cleanup failure must not hide the test's own failure.
      await sender.stop().catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.warn(`sender device cleanup failed: ${e instanceof Error ? e.message : String(e)}`)
      })
    }
  })

  it('five quick background/foreground cycles leave the app healthy', async () => {
    const user = requireSmokeUser()
    const since = Date.now()
    await waitForAppState('active')
    const pid = appPid()
    const goMark = goLogMark()
    const metroMark = metroLogMark()

    const cycles = 5
    for (let i = 0; i < cycles; i++) {
      await backgroundApp()
      await browser.pause(700)
      await activateApp()
      await browser.pause(700)
    }

    await waitForAppState('active')
    expect(appPid()).toBe(pid)
    // Every cycle reaches Go, and the last word is foreground.
    await waitFor(
      'Go to see every cycle',
      () => {
        const updates = goAppStateUpdates(goMark)
        const backgrounds = updates.filter(s => s === 'BACKGROUND').length
        const actives = updates.filter(s => s === 'FOREGROUND').length
        return backgrounds >= cycles && actives >= cycles && updates.at(-1) === 'FOREGROUND' ? true : undefined
      },
      {interval: 500, timeout: 20000}
    )
    // JS saw the app go away and come back, ending active.
    const focus = findLines(metroClientLogSince(metroMark), /app focus changed: /)
    expect(focus.some(l => l.endsWith('app focus changed: background'))).toBe(true)
    expect(focus.at(-1)).toMatch(/app focus changed: active$/)

    const avatar = await waitForAvatar200(user)
    expect(avatar.status).toBe(200)
    await expect(tab('People')).toExist()
    expect(crashReportsSince(since)).toEqual([])
  })

  it('Notification Center makes the app inactive and keeps images served', async () => {
    const user = requireSmokeUser()
    const before = await waitForAppState('active')
    const goMark = goLogMark()
    const metroMark = metroLogMark()

    await openNotificationCenter()
    const inactive = await waitForAppState('inactive', undefined, 15000)
    // Notification Center only resigns active; it never backgrounds the app, so iOS reports
    // BACKGROUNDACTIVE to Go (not INACTIVE), keeping gregor and the image server up.
    await waitForLinesInOrder('Go to go inactive', () => goLogSince(goMark), [goBackgroundActive])
    expect(inactive.httpSrv.address).toBe(before.httpSrv.address)
    await waitForAvatar200(user)
    expect(findLines(goLogSince(goMark), goBackground)).toEqual([])

    await closeNotificationCenter()
    await waitForAppState('active', undefined, 15000)
    await waitForLinesInOrder('Go to become active again', () => goLogSince(goMark), [goForeground])
    const focus = findLines(metroClientLogSince(metroMark), /app focus changed: /)
    expect(focus).toEqual([
      expect.stringMatching(/app focus changed: inactive$/),
      expect.stringMatching(/app focus changed: active$/),
    ])
    expect(findLines(goLogSince(goMark), httpSrvStartedAny)).toEqual([])
    expect((await appSnapshot()).httpSrv.address).toBe(before.httpSrv.address)
  })
})

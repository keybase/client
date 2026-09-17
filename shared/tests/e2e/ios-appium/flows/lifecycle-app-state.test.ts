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
// - Go (ios.log): "lifecycle: <event>: ..." per native lifecycle event,
//   "MobileAppState.Update: useful update: <STATE>" per Go app state change,
//   "Srv: startHTTPSrv: addr: <address>" when the image server (re)starts.
// - Metro (JS): "app focus changed: <state>" when the shell store's app state changes.
describe('app lifecycle: app state', () => {
  it('cold launch reaches active under scenes and serves images', async () => {
    const user = requireSmokeUser()
    const since = Date.now()
    await terminateApp()
    const goMark = goLogMark()
    await launchApp()

    // The app restores its last screen, which may hide the tab bar, so wait on state.
    const snap = await waitForAppState('active', undefined, 90000)
    const goLines = await waitForLinesInOrder('Go to report the launch', () => goLogSince(goMark), [
      /lifecycle: willEnterForeground: /,
      /MobileAppState\.Update: useful update: FOREGROUND/,
      /lifecycle: didBecomeActive: /,
    ])
    expect(goLines).toHaveLength(3)
    // JS must hold the address of the server Go started, not a stale one.
    const started = findLines(goLogSince(goMark), /Srv: startHTTPSrv: addr: /).at(-1) ?? ''
    expect(started).toContain(`addr: ${snap.httpSrv.address} `)

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
      await backgroundApp()
      await waitForLinesInOrder('Go to go to the background', () => goLogSince(goMark), [
        /lifecycle: willResignActive: /,
        /lifecycle: didEnterBackground: /,
      ])

      const text = `e2e-lifecycle-recv-${Date.now()}`
      await sender.send(convID, text)
      await browser.pause(10000)
      await activateApp()

      const snap = await waitForAppState('active')
      expect(snap.screen?.params?.['conversationIDKey']).toBe(convID)
      await waitForLinesInOrder('Go to return to the foreground', () => goLogSince(goMark), [
        /lifecycle: didEnterBackground: /,
        /lifecycle: willEnterForeground: /,
        /MobileAppState\.Update: useful update: FOREGROUND/,
        /lifecycle: didBecomeActive: /,
      ])
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
        const lines = goLogSince(goMark)
        const backgrounds = findLines(lines, /lifecycle: didEnterBackground: /).length
        const actives = findLines(lines, /lifecycle: didBecomeActive: /).length
        return backgrounds >= cycles && actives >= cycles && goAppStateUpdates(goMark).at(-1) === 'FOREGROUND'
          ? true
          : undefined
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
    await waitForLinesInOrder('Go to go inactive', () => goLogSince(goMark), [
      /MobileAppState\.Update: useful update: INACTIVE/,
      /lifecycle: willResignActive: /,
    ])
    // INACTIVE is not background: the image server keeps serving at the same address.
    expect(inactive.httpSrv.address).toBe(before.httpSrv.address)
    await waitForAvatar200(user)
    expect(findLines(goLogSince(goMark), /lifecycle: didEnterBackground: /)).toEqual([])

    await closeNotificationCenter()
    await waitForAppState('active', undefined, 15000)
    await waitForLinesInOrder('Go to become active again', () => goLogSince(goMark), [
      /MobileAppState\.Update: useful update: FOREGROUND/,
      /lifecycle: didBecomeActive: /,
    ])
    const focus = findLines(metroClientLogSince(metroMark), /app focus changed: /)
    expect(focus).toEqual([
      expect.stringMatching(/app focus changed: inactive$/),
      expect.stringMatching(/app focus changed: active$/),
    ])
    expect(findLines(goLogSince(goMark), /Srv: startHTTPSrv: addr: /)).toEqual([])
    expect((await appSnapshot()).httpSrv.address).toBe(before.httpSrv.address)
  })
})

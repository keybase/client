import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {el, enterText, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'
import {
  activateApp,
  appPid,
  backgroundApp,
  deviceUdid,
  findLines,
  goAppStateUpdates,
  goLogMark,
  goLogSince,
  jsEval,
  metroBundlingStartedSince,
  metroClientLogSince,
  metroLogMark,
  nsLogSince,
  openSelfConversation,
  setLocation,
  simctl,
  terminateApp,
  waitFor,
  waitForAppState,
  waitForLinesInOrder,
  BUNDLE_ID,
} from '../helpers/lifecycle'

// Live location on iOS: Go asks JS to watch (chatWatchPosition), JS starts react-native-kb's
// native watcher, and each fix goes native -> JS -> localLocationUpdate -> Go, which posts it to
// the conversation as a map unfurl. These flows move the simulated location and follow that in
// the Go log (ios.log):
// - "LiveLocationTracker: StartTracking" / "StopAllTracking" when sharing starts and stops,
// - "+ LiveLocationTracker: LocationUpdate" for each fix JS hands Go,
// - "LiveLocationTracker: tracker[<id>]: got coords" when the tracker takes it,
// - "+ LiveLocationTracker: updateMapUnfurl" when Go posts the location to the conversation,
// - "LiveLocationTracker: restoreLocked: restored <n> trackers" when a relaunch restores sharing,
// - "AppDidEnterBackground: setting background active" when the app backgrounds while sharing:
//   Go keeps running for the share, so resign-active reports INACTIVE, the background reports
//   BACKGROUNDACTIVE, and Go never goes to BACKGROUND. Only a connecting scene reports FOREGROUND
//   (see goAppStateUpdates in helpers/lifecycle.ts).
// And in the app's NSLog lines: "KbLocationWatcher: starting location updates" and
// "KbLocationWatcher: stopping location updates" when the native watcher turns the OS service on
// and off.
// A kill while sharing leaves significant-change monitoring on, so a move relaunches the app in
// the background. No scene connects there, so no JS runs (Metro's start.log sees neither a bundle
// request nor a JS log line), and since every fix reaches Go through JS, none does. Go restores
// the share on that launch, but its watch request finds no chat UI (NullChatUI), so nothing
// starts a watch; once the user opens the app, JS init stops the leftover OS monitoring
// (initIOSLocation). Not ported from the native-Go branch: a fix posted by the background
// relaunch itself, which needed Go to own the watcher.
// The posted map itself never renders here: the maps server rejects the render request, so the
// unfurl fails after Go posts it. The flows stop at the post.
//
// Only the smoke user's conversation with themselves is used.

// The simulator reports no fix when the watcher starts at the location it already has, so
// each run starts somewhere new.
const start = {lat: 37.7749 + Math.random() * 0.01, lon: -122.4194}
// Far enough apart that Go, which in the background waits for real movement, records them,
// and the last far enough for iOS to count it as a significant change.
const moves = [
  {lat: start.lat + 0.01, lon: start.lon},
  {lat: start.lat + 0.02, lon: start.lon},
  {lat: start.lat + 0.06, lon: start.lon + 0.04},
]

const locationUpdates = (lines: Array<string>) => findLines(lines, /\+ LiveLocationTracker: LocationUpdate/)

const sendCommand = async (text: string) => {
  await waitForTestID(T.CHAT_INPUT, 10000)
  await enterText(T.CHAT_INPUT, text)
  await waitForTestID(T.CHAT_SEND_BUTTON, 5000)
  await el(T.CHAT_SEND_BUTTON).click()
}

describe('app lifecycle: live location', () => {
  let convID = ''
  let sharing = false

  before(() => {
    const udid = deviceUdid()
    simctl('privacy', udid, 'grant', 'location-always', BUNDLE_ID)
    setLocation(start.lat, start.lon)
  })

  // Sharing must never be left on, even when a flow fails partway.
  after(async () => {
    if (!sharing) return
    await activateApp()
    await waitForAppState('active', undefined, 90000)
    await jsEval(
      `kbModule('chat/conversation/send-actions.tsx').sendTextToConversation(${JSON.stringify(convID)}, ${JSON.stringify(requireSmokeUser())}, '/location stop'); return true`
    )
  })

  it('shares live location and posts a move while in the foreground', async () => {
    const user = requireSmokeUser()
    convID = await openSelfConversation(user)
    const goMark = goLogMark()
    const since = new Date(Date.now() - 1000)
    await sendCommand('/location live 15m')
    sharing = true
    await waitForLinesInOrder('Go to start tracking', () => goLogSince(goMark), [/LiveLocationTracker: StartTracking/], 30000)
    await waitForLinesInOrder('the native watcher to start', () => nsLogSince('KbLocationWatcher: ', since), [
      /starting location updates/,
    ])

    const moveMark = goLogMark()
    setLocation(moves[0]!.lat, moves[0]!.lon)
    // The tracker can be busy posting the first fix for up to a minute before it posts this one.
    await waitForLinesInOrder(
      'the foreground move to be posted',
      () => goLogSince(moveMark),
      [/\+ LiveLocationTracker: LocationUpdate/, /tracker\[\d+\]: got coords/, /\+ LiveLocationTracker: updateMapUnfurl/],
      180000
    )
  })

  it('posts a move while in the background', async () => {
    await waitForAppState('active')
    const goMark = goLogMark()
    await backgroundApp()
    await waitForLinesInOrder('the app to enter the background', () => goLogSince(goMark), [
      /MobileAppState\.Update: useful update: INACTIVE,/,
      /AppDidEnterBackground: setting background active/,
      /MobileAppState\.Update: useful update: BACKGROUNDACTIVE,/,
    ])
    // JS keeps running in the background while the watcher is on, and relays the fix.
    const moveMark = goLogMark()
    setLocation(moves[1]!.lat, moves[1]!.lon)
    await waitForLinesInOrder(
      'the background move to be posted',
      () => goLogSince(moveMark),
      [/\+ LiveLocationTracker: LocationUpdate/, /tracker\[\d+\]: got coords/, /\+ LiveLocationTracker: updateMapUnfurl/],
      180000
    )
    expect(goAppStateUpdates(goMark)).not.toContain('FOREGROUND')
    await activateApp()
    await waitForAppState('active')
  })

  it('stops sharing, stops the OS location service, and a move no longer relaunches the app', async function () {
    this.timeout(420000)
    const user = requireSmokeUser()
    await activateApp()
    await waitForAppState('active', undefined, 90000)
    await openSelfConversation(user)
    const goMark = goLogMark()
    const since = new Date(Date.now() - 1000)
    await sendCommand('/location stop')
    // The tracker posts a final "done" update before it lets go of the watcher, and that post
    // waits up to a minute for the unfurl that fails here.
    await waitForLinesInOrder(
      'Go to stop tracking',
      () => goLogSince(goMark),
      [
        /LiveLocationTracker: StopAllTracking/,
        /tracker\[\d+\]: stopped, updating with done status/,
        /- LiveLocationTracker: updateMapUnfurl -> /,
      ],
      150000
    )
    sharing = false
    await waitForLinesInOrder('the native watcher to stop', () => nsLogSince('KbLocationWatcher: ', since), [
      /stopping location updates/,
    ])

    // A move reaches neither Go nor, once the app is killed, a relaunch.
    const moveMark = goLogMark()
    setLocation(moves[0]!.lat, moves[0]!.lon)
    await browser.pause(15000)
    expect(locationUpdates(goLogSince(moveMark))).toEqual([])

    // A relaunch took up to a minute and a half while sharing, so wait longer than that.
    await terminateApp()
    setLocation(moves[2]!.lat, moves[2]!.lon)
    await browser.pause(120000)
    expect(appPid()).toBeUndefined()
    await activateApp()
    await waitForAppState('active', undefined, 90000)
  })

  it('a move relaunches the killed app in the background, where no JS runs to relay it', async function () {
    // iOS delivers significant location changes on its own schedule: seconds to minutes. The
    // budget covers sharing again, the relaunch, the Go log, the quiet wait and the activation.
    this.timeout(600000)
    const user = requireSmokeUser()
    await activateApp()
    await waitForAppState('active', undefined, 90000)
    await openSelfConversation(user)
    const shareMark = goLogMark()
    const since = new Date(Date.now() - 1000)
    await sendCommand('/location live 15m')
    sharing = true
    await waitForLinesInOrder('Go to start tracking', () => goLogSince(shareMark), [/LiveLocationTracker: StartTracking/], 30000)
    await waitForLinesInOrder('the native watcher to start', () => nsLogSince('KbLocationWatcher: ', since), [
      /starting location updates/,
    ])

    await terminateApp()
    const goMark = goLogMark()
    // start.log is shared by every device attached to Metro, so this device must be the only
    // one running while the relaunch is watched.
    const metroMark = metroLogMark()
    setLocation(start.lat, start.lon)

    const pid = await waitFor('iOS to relaunch the app for the move', () => appPid(), {interval: 1000, timeout: 300000})
    await waitForLinesInOrder(
      'the relaunched service to restore sharing',
      () => goLogSince(goMark),
      [/LiveLocationTracker: restoreLocked: restored [1-9]\d* trackers/],
      120000
    )
    // Long enough for a fix the relaunch was for to have reached Go, had anything relayed it.
    await browser.pause(30000)
    expect(appPid()).toBe(pid)
    expect(locationUpdates(goLogSince(goMark))).toEqual([])
    // Launched for location, not by the user: no scene came to the foreground.
    expect(goAppStateUpdates(goMark)).not.toContain('FOREGROUND')
    expect(metroBundlingStartedSince(metroMark)).toEqual([])
    expect(metroClientLogSince(metroMark)).toEqual([])

    // Control: starting a scene makes both readers, from that same mark, see the JS start they
    // just reported absent, so neither can go quietly blind.
    await activateApp()
    await waitForAppState('active', undefined, 90000)
    expect(metroBundlingStartedSince(metroMark).length).toBeGreaterThan(0)
    expect(metroClientLogSince(metroMark).length).toBeGreaterThan(0)
  })
})

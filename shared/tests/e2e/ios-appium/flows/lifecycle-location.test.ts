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
  goLogMark,
  goLogSince,
  jsEval,
  metroBundlingStartedSince,
  metroClientLogSince,
  metroLogMark,
  nativeLogSince,
  openSelfConversation,
  setLocation,
  simctl,
  terminateApp,
  waitFor,
  waitForAppState,
  waitForLinesInOrder,
  BUNDLE_ID,
} from '../helpers/lifecycle'

// Live location on iOS runs natively: Go asks the Swift watcher to start, each fix goes
// straight to Go, and Go posts it to the conversation as a map unfurl. These flows move the
// simulated location and follow that in the Go log (ios.log):
// - "LiveLocationTracker: StartTracking" / "StopAllTracking" when sharing starts and stops,
// - "+ LiveLocationTracker: LocationUpdate" for each fix Go records (native hands it every fix),
// - "LiveLocationTracker: tracker[<id>]: got coords" when the tracker takes it,
// - "+ LiveLocationTracker: updateMapUnfurl" when Go posts the location to the conversation,
// - "LiveLocationTracker: restoreLocked: restored <n> trackers" when a relaunch restores sharing,
// - "lifecycle: acquire: liveLocation hold " when a fix holds a backgrounded app up.
// The relaunch flow also reads Metro's start.log: a background launch must start no JS at all, so
// neither a bundle request nor a JS log line may appear while it runs, and activating the app
// afterwards must make both appear from the same mark.
// And in the app's unified log (com.keybase.app, category location): "starting location updates"
// and "stopping location updates" when the Swift watcher turns the OS service on and off.
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
    await waitForLinesInOrder('the native watcher to start', () => nativeLogSince('location', since), [
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
      /lifecycle: uiBackground: /,
    ])
    // JS doesn't run in the background, so anything after this comes from native.
    const moveMark = goLogMark()
    setLocation(moves[1]!.lat, moves[1]!.lon)
    await waitForLinesInOrder(
      'the background move to be posted',
      () => goLogSince(moveMark),
      [/\+ LiveLocationTracker: LocationUpdate/, /tracker\[\d+\]: got coords/, /\+ LiveLocationTracker: updateMapUnfurl/],
      180000
    )
    expect(findLines(goLogSince(moveMark), /lifecycle: ui(Inactive|Active): /)).toEqual([])
    await activateApp()
    await waitForAppState('active')
  })

  it('a move relaunches the app after it was killed and posts from the background', async function () {
    // iOS delivers significant location changes on its own schedule: seconds to minutes. The
    // budget covers all three waits below: the relaunch, the Go log, and the control's activation.
    this.timeout(510000)
    await terminateApp()
    const goMark = goLogMark()
    // start.log is shared by every device attached to Metro, so this device must be the only
    // one running while the relaunch is watched.
    const metroMark = metroLogMark()
    setLocation(moves[2]!.lat, moves[2]!.lon)

    // iOS relaunches the app in the background for the significant location change.
    const pid = await waitFor('iOS to relaunch the app for the move', () => appPid(), {interval: 1000, timeout: 300000})
    const lines = await waitForLinesInOrder(
      'the relaunched app to restore sharing and post the move',
      () => goLogSince(goMark),
      [
        /LiveLocationTracker: restoreLocked: restored [1-9]\d* trackers/,
        /\+ LiveLocationTracker: LocationUpdate/,
        /tracker\[\d+\]: got coords/,
        /\+ LiveLocationTracker: updateMapUnfurl/,
      ],
      120000
    )
    expect(lines).toHaveLength(4)
    // Launched for location, not by the user: no scene came to the foreground.
    const relaunched = goLogSince(goMark)
    expect(findLines(relaunched, /lifecycle: acquire: liveLocation hold /).length).toBeGreaterThan(0)
    expect(findLines(relaunched, /lifecycle: ui(Inactive|Active): /)).toEqual([])
    expect(appPid()).toBe(pid)
    // No scene connected, so React Native never started: no bundle request and no JS logging.
    expect(metroBundlingStartedSince(metroMark)).toEqual([])
    expect(metroClientLogSince(metroMark)).toEqual([])

    // Control: starting a scene makes both readers, from that same mark, see the JS start they
    // just reported absent, so neither can go quietly blind.
    await activateApp()
    await waitForAppState('active', undefined, 90000)
    expect(metroBundlingStartedSince(metroMark).length).toBeGreaterThan(0)
    expect(metroClientLogSince(metroMark).length).toBeGreaterThan(0)
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
    await waitForLinesInOrder('the native watcher to stop', () => nativeLogSince('location', since), [
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
})

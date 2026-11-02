// Location in chat, sent from the phone into a throwaway channel of the e2e team this run made, with
// the simulator only ever at fixed public points around Apple Park (location-lib.ts):
// - the current location: + → "Share your location" opens the location screen, which watches the
//   position and hands it to the service (chat.1.local.locationUpdate); "Send current location" posts
//   it, and the host reads the location message back;
// - live location for 15 minutes from the same screen: the service starts tracking and the native
//   watcher starts; a move in the foreground and one in the background are each posted; `/location
//   stop` from the composer stops the tracker and the watcher;
// - live location with the app killed: a far move has iOS relaunch the app in the background, where
//   the service restores the share; once the app is in front again a move is posted.
//
// Location is granted to keybase.ios (location-always) in each test's body; the flow's afterEach puts
// it back. The service's lines are read from its log (ios.log) from a mark, the native watcher's from
// the simulator's log. 'location' is credited only once the host has read the location message back.
// The map itself never renders here (the maps server rejects the render), so the flow stops at the
// posts. Registered last: a post the maps server fails retries from the outbox for up to 15 minutes,
// until the channel is deleted.
//
// The afterEach, in order and after a timeout too: the app back up in front; sharing stopped (from the
// composer, else the app's own `/location stop` with the recorder paused) and the service's stop read;
// the simulated location cleared; the location permission put back; the app up again (a permission
// change can kill it); the channel deleted (which drops the outbox's retries). A failure of any of
// those poisons the gate.
import {loadE2EAccounts} from '../../accounts/env'
import {createThrowawayChannel, deleteThrowawayChannel, readFromCli} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {clearLocation, grantPrivacy, launchedBy, launchIfGone, restorePrivacy, setLocation, toBackground, toForeground} from '../gate/device'
import type {PrivacyRestore} from '../gate/device-lib.ts'
import {stopSharingFromApp} from '../gate/location'
import {
  APPLE_PARK,
  CURRENT_LOCATION,
  FAR,
  GO_BACKGROUND_SHARING,
  GO_MOVE_POSTED,
  GO_RESTORED,
  GO_START_TRACKING,
  GO_STOP_ALL,
  GO_STOPPED,
  GO_TRACKER_STOPPED,
  holdsLocationMessage,
  LIVE_15M,
  NEAR,
  NEARER,
  WATCHER,
  WATCHER_STOPPED,
  watcherRunning,
  type Point,
} from '../gate/location-lib.ts'
import {clearGatePoison, poisonGate} from '../gate/poison-lib.ts'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {openConversation, typeInComposer} from '../helpers/chat'
import {el, waitForTestID} from '../helpers/elements'
import {expectScreen, waitSignedIn} from '../helpers/files'
import {appPid, goLogMark, goLogSince, nsLogSince, waitFor, waitForAppState, waitForLinesInOrder} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const LOCATION_UPDATE = 'chat.1.local.locationUpdate'

describe('chat location', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120;  open
  //             openConversation 100
  //   grant     grantPrivacy 640 (the TCC read 15, the runtime 1, a checkpoint 60, simctl 120, the
  //             kill watch 15 overrun by one pid read 120, the launch: simctl 120, the runtime 120,
  //             the captures 4, a checkpoint 60);  restore  restorePrivacy 150
  //   location  setLocation 120 (simctl's deadline);  clear  clearLocation 120
  //   more      the + button 1, its row 10, the tap 1 = 12;  screen  expectScreen 21 (20, one read 1)
  //   calls     the recorder's call log, 30s of reads overrun by one 2 = 32;  button  10, its tap 1 = 11
  //   cli       the host's read of the channel, 30s of reads overrun by one 60 = 90
  //   mark      goLogMark 120 (the app's container through simctl);  go  waitForLinesInOrder 31 (30,
  //             one read 1);  bg go  21;  post  a move posted 181;  stopped  the done post 151
  //   watcher   the simulator's log, 20s of reads overrun by one simctl read 120 = 140
  //   moves     toBackground 1;  toForeground 1;  active  waitForAppState 31
  //   composer  the stop typed 2, the send button 5 and its tap 1 = 8
  //   relaunch  iOS's relaunch for the move: 300s of pid reads overrun by one 120 = 420;  restored
  //             121 (120, one read 1);  launched  launchedBy 1186 (a checkpoint 60, terminate 10, the
  //             delivery: mark 120, location 120, relaunch 420, restored 121, foreground 1 = 782, its
  //             pid 150, the runtime 120, the captures 4, a checkpoint 60);  signed in  90
  //   step      2 (its 1s settle and the attach)

  // -- what the afterEach puts back -----------------------------------------------------------------
  // Each is set before what it undoes and cleared once that is put back.

  // the conversation a live share was started in
  let sharingIn: string | undefined
  // the simulated location was set
  let located = false
  // what grantPrivacy changed
  let privacy: PrivacyRestore | undefined
  // the throwaway channels a test made
  const channels = new Set<string>()

  // Runs `restore`; a failure poisons the gate (the phone or the account is left changed for every
  // later flow), a success clears that poison.
  const guarded = async (what: string, byHand: string, restore: () => Promise<void>) => {
    try {
      await restore()
    } catch (e) {
      if (isAttemptOver(e)) throw e
      poisonGate(what, byHand)
      throw e
    }
    clearGatePoison(what)
  }

  // From the composer, else the app's own send (recorder paused); then the service's stop and the live
  // tracker's own stop, read off its log. Bound: mark 120, open 100, composer 8, the app's send 3, the
  // stops 61 = 292.
  const stopSharing = async () =>
    guarded('location sharing', "send /location stop in the run's location channel in the Keybase app", async () => {
      const convID = sharingIn
      if (!convID) return
      const mark = goLogMark()
      try {
        await openConversation(convID)
        await stopFromComposer()
      } catch (e) {
        if (isAttemptOver(e)) throw e
        await stopSharingFromApp(convID)
      }
      await waitForLinesInOrder('the phone service to stop the live tracker', () => goLogSince(mark), [GO_STOP_ALL, GO_TRACKER_STOPPED], 60_000)
      sharingIn = undefined
    })

  // clearLocation poisons the gate itself. Bound: clear 120.
  const clearMoves = () => {
    if (!located) return
    clearLocation()
    located = false
  }

  // restorePrivacy poisons the gate itself. Bound: restore 150.
  const putBackPrivacy = () => {
    if (!privacy) return
    restorePrivacy(privacy)
    privacy = undefined
  }

  // Bound: a channel 120.
  const deleteChannels = async () =>
    guarded('the location channel', "delete the run's stamped location channel of the e2e team", async () => {
      for (const topicName of [...channels]) {
        await masked(async () => deleteThrowawayChannel(topicName))
        channels.delete(topicName)
      }
    })

  // Worst case (s): launchIfGone 272, stopSharing 292, clear 120, restore 150, launchIfGone 272, a
  // channel 120, escapeToTabs 30 = 1256.
  afterEach(async function () {
    this.timeout(1_300_000)
    await withCleanup(launchIfGone, [stopSharing, clearMoves, putBackPrivacy, launchIfGone, deleteChannels, escapeToTabs])
  })

  // -- helpers --------------------------------------------------------------------------------------

  // Bound: location 120.
  const moveTo = (p: Point) => {
    located = true
    setLocation(p)
  }

  // A throwaway channel, location granted, the simulator at Apple Park, the channel open. Bound:
  // channel 240, grant 640, location 120, open 100, step 2 = 1102.
  const inChannelWithLocation = async () => {
    const made = await masked(async () => createThrowawayChannel('loc', {withSecond: false}))
    channels.add(made.topicName)
    privacy = await grantPrivacy('location-always')
    moveTo(APPLE_PARK)
    await openConversation(made.convID)
    await step('In the channel, with location granted')
    return made
  }

  // The location screen from the composer's + menu, and when it was asked for (the native watcher's
  // lines are read from then). Bound: more 12, screen 21 = 33.
  const openLocationScreen = async (convID: string) => {
    const opened = new Date(Date.now() - 1_000)
    await el(T.CHAT_MORE_BUTTON).click()
    await el(T.CHAT_MORE_SHARE_LOCATION).waitForExist({timeout: 10_000})
    await el(T.CHAT_MORE_SHARE_LOCATION).click()
    await expectScreen('the location screen', 'chatLocationPreview', p => p['conversationIDKey'] === convID, 20_000)
    return opened
  }

  // Bound: button 11.
  const tapLocationButton = async (testID: string) => {
    await el(testID).waitForExist({timeout: 10_000})
    await el(testID).click()
  }

  // Bound: composer 8.
  const stopFromComposer = async () => {
    await typeInComposer('/location stop')
    await waitForTestID(T.CHAT_SEND_BUTTON, 5_000)
    await el(T.CHAT_SEND_BUTTON).click()
  }

  // Waits for the host to read the smoke account's location message `body` in the channel. Bound: cli
  // 90.
  const hostReads = async (topicName: string, body: string) => {
    const {smokeUser} = loadE2EAccounts()
    await waitFor(
      'the host to read the location message in the channel',
      async () => (holdsLocationMessage(await masked(async () => readFromCli({topicName})), smokeUser, body) ? true : undefined),
      {interval: 2_000, timeout: 30_000}
    )
  }

  // Moves to `p` and waits for the service to post it. Bound: mark 120, location 120, post 181 = 421.
  const movePosted = async (p: Point, what: string) => {
    const mark = goLogMark()
    moveTo(p)
    // the tracker can be busy posting the previous fix for up to a minute before it posts this one
    await waitForLinesInOrder(what, () => goLogSince(mark), GO_MOVE_POSTED, 180_000)
  }

  // Starts a 15 minute live share from the location screen opened at `opened`, and waits for the
  // service to track with the native watcher running: the screen started it, and the share keeps it.
  // Bound: mark 120, button 11, go 31, watcher 140 (20s of reads overrun by one 120) = 302.
  const startLiveShare = async (convID: string, opened: Date) => {
    const mark = goLogMark()
    sharingIn = convID
    await tapLocationButton(T.CHAT_LOCATION_LIVE_15M)
    await waitForLinesInOrder('the phone service to start tracking', () => goLogSince(mark), [GO_START_TRACKING], 30_000)
    await waitFor('the native location watcher to run for the share', () => (watcherRunning(nsLogSince(WATCHER, opened)) ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })
  }

  // -- tests ----------------------------------------------------------------------------------------

  it('the current location is sent from the location screen and read back in the channel', async function () {
    // worst case (s): in channel 1102, seq 2, location screen 33, calls 32, step 2, button 11, cli 90,
    // step 2 = 1274
    this.timeout(1_320_000)
    const {convID, topicName} = await inChannelWithLocation()
    const seq = await currentCallSeq()
    await openLocationScreen(convID)
    // the screen watches the position and hands each fix to the service
    await waitForUiCall('the location screen to hand the position to the service', seq, LOCATION_UPDATE, {interval: 500, timeout: 30_000})
    await step('The location screen has the position')

    await tapLocationButton(T.CHAT_LOCATION_SEND_CURRENT)
    await hostReads(topicName, CURRENT_LOCATION)
    creditSurface('location')
    await step('The current location is in the channel', {card: true})
  })

  it('live location from the location screen posts a move in the foreground and one in the background, and stops from the composer', async function () {
    // worst case (s): in channel 1102, location screen 33, live share 302, cli 90, step 2; the
    // foreground move 421, step 2; the background: mark 120, background 1, bg go 21, the move 421,
    // foreground 1, active 31, step 2; the stop: mark 120, composer 8, stopped 151, watcher 140, step
    // 2 = 2970
    this.timeout(3_050_000)
    const {convID, topicName} = await inChannelWithLocation()
    const opened = await openLocationScreen(convID)
    await startLiveShare(convID, opened)
    await hostReads(topicName, LIVE_15M)
    await step('Sharing live location')

    await movePosted(NEAR, 'the foreground move to be posted')
    await step('The foreground move was posted')

    const bgMark = goLogMark()
    await toBackground()
    // the service stays up for the share: inactive, then background active, never background
    await waitForLinesInOrder('the app to go to the background while sharing', () => goLogSince(bgMark), GO_BACKGROUND_SHARING)
    await movePosted(NEARER, 'the background move to be posted')
    await toForeground()
    await waitForAppState('active', undefined, 30_000)
    await step('The background move was posted')

    const stopMark = goLogMark()
    const since = new Date(Date.now() - 1_000)
    await stopFromComposer()
    // the tracker posts a last "done" update, which waits up to a minute for the unfurl that fails here
    await waitForLinesInOrder('the phone service to stop tracking', () => goLogSince(stopMark), GO_STOPPED, 150_000)
    sharingIn = undefined
    await waitForLinesInOrder('the native location watcher to stop', () => nsLogSince(WATCHER, since), [WATCHER_STOPPED])
    creditSurface('location')
    await step('Sharing stopped', {card: true})
  })

  it('with the app killed while sharing, a far move has iOS relaunch it, the share is restored, and a move is posted once it is in front', async function () {
    // worst case (s): in channel 1102, location screen 33, live share 302, cli 90, step 2, launched
    // 1186, signed in 90, the move 421, step 2 = 3228
    this.timeout(3_300_000)
    const {convID, topicName} = await inChannelWithLocation()
    const opened = await openLocationScreen(convID)
    await startLiveShare(convID, opened)
    await hostReads(topicName, LIVE_15M)
    await step('Sharing live location')

    await launchedBy(async () => {
      // marked once the killed process is gone, so its last lines are not read as the relaunch's
      const mark = goLogMark()
      moveTo(FAR)
      // iOS delivers a significant change on its own schedule, seconds to minutes: a long wait that
      // fails loudly
      await waitFor('iOS to relaunch the killed app for the far move', () => (appPid() === undefined ? undefined : true), {
        interval: 1_000,
        timeout: 300_000,
      })
      await waitForLinesInOrder('the relaunched service to restore the share', () => goLogSince(mark), [GO_RESTORED], 120_000)
      // a relaunch for location starts no scene, and no JS: the app is brought to the front
      await toForeground()
    })
    await waitSignedIn()
    await movePosted(NEAR, 'a move to be posted once the relaunched app is in front')
    creditSurface('location')
    creditSurface('relaunch')
    await step('The restored share posted a move', {card: true})
  })
})

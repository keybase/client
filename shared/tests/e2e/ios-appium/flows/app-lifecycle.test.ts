// The app's own life on the phone: a cold launch (terminated and launched again) that comes up on the
// screen it saved, with Go's launch transitions, the image server the app holds the address of, the
// avatar served from it and no crash; a trip to the background and back while the second account
// posts a stamped message into a throwaway channel of the e2e team this run made (the app is the same
// process, active again, and shows the message); five round trips in a row, each seen by Go in order;
// and Notification Center pulled over the app, which only makes it inactive and opens nothing.
//
// Go's transitions are read from the phone's service log (ios.log) from a mark, the app's own lines
// from its in-runtime log capture, and the cold launch from the new runtime's first recording.
// 'background-foreground' and 'relaunch' are credited only once all of that is asserted.
//
// The flow's afterEach launches the app again or brings it to the front when a test stopped part way
// (no recording; a failure there poisons the gate), deletes the channel and goes back to the tab root.
import {loadE2EAccounts} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {sendWithRetry} from '../../shared/peer-actors'
import {e2eMarker} from '../../shared/run-marker.ts'
import {appLogMark, appLogUntilMarker} from '../gate/app-log'
import {creditSurface} from '../gate/attempt'
import {requireSecondNotBlocked} from '../gate/blocks'
import {appRuntime, launchIfGone, relaunchApp, toBackground, toForeground} from '../gate/device'
import {focusChanges, focusLeftAndBack, GO_BACKGROUND, GO_FOREGROUND, GO_HTTP_SRV, GO_INACTIVE, GO_LAUNCHING, roundTrips} from '../gate/links-push-lib.ts'
import {attemptRecording} from '../gate/recording'
import {expectScreen, fromPeople, leaveOnPeople} from '../gate/screens'
import {step} from '../gate/step'
import {withNotificationCenter} from '../gate/system-ui'
import {openConversation, rowElement, waitForRow, waitSignedIn} from '../helpers/chat'
import {
  appPid,
  appSnapshot,
  crashReportsSince,
  goLogMark,
  waitForAppState,
  waitForAvatar200,
  waitForLinesInOrder,
} from '../helpers/lifecycle'
import {linesSince} from '../gate/go-log-lib.ts'
import {check} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {secondSender, throwawayChannels} from '../helpers/chat-host'
import {masked} from '../helpers/teams'

const CYCLES = 5

describe('app lifecycle', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   leave     leaveOnPeople 103;  people  fromPeople 66 (escapeToTabs 30, the People tab 15, the
  //             screen 21)
  //   relaunch  relaunchApp 254 (a checkpoint 60, terminate 10, the new runtime 120, the error and log
  //             captures 4, a checkpoint 60);  signed in  90;  rec  a checkpoint 60
  //   mark      goLogMark 120 (the app's container through simctl);  go  waitForLinesInOrder 21 (20,
  //             one read 1);  app mark  appLogMark 2;  until  appLogUntilMarker 12
  //   state     appSnapshot 1;  active  waitForAppState 31 (30, one read 1);  identity  appIdentity 121
  //             (appPid's simctl 120, the runtime 1);  same  sameProcess 122 (the identity, the crash
  //             reports 1);  avatar  waitForAvatar200 21
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120;  open  openConversation
  //             100
  //   peer      the peer found 45 and a failing call's diagnosis 25 = 70;  peer send  sendWithRetry 90
  //             (30, overrun by one send's 60)
  //   message   waitForRow 61 (60, one read 1);  drawn  10
  //   center    withNotificationCenter 55, with its fn: inactive 16 and go 21
  //   screen    expectScreen 11 (10, one read 1)
  //   step      2 (its 1s settle and the attach)

  before(async function () {
    // the second account posts into the channel: a failed chat-blocks restore refuses here. The host
    // read 75s.
    this.timeout(90_000)
    await masked(async () => requireSecondNotBlocked())
  })

  // the throwaway channels a test made
  const channels = throwawayChannels()

  const deleteChannels = async () => masked(channels.deleteAll)

  // Nothing a test left behind, after a timeout too: the app back up in front first (no recording; the
  // next test's reset drives it), the channel, the tab root. Worst case (s): launchIfGone 272 (a
  // launch 120 or the activate 1, in front 31, the runtime 121), a channel 120, escapeToTabs 30 = 422.
  afterEach(async function () {
    this.timeout(450_000)
    await withCleanup(launchIfGone, [deleteChannels, escapeToTabs])
  })

  // The app as it is now, to compare with later: its process and its JS runtime (a JS reload keeps the
  // process). Bound: pid 120, runtime 1 = 121.
  const appIdentity = async () => {
    const pid = appPid()
    const runtime = await appRuntime()
    if (pid === undefined || runtime === undefined) throw new Error('the app has no process or no JS runtime to compare with later')
    return {pid, runtime}
  }

  // The same process and JS runtime as `was`, with no crash report of the app's written since `since`.
  // Bound: appIdentity 121, the crash reports 1 = 122.
  const sameProcess = async (was: {pid: number; runtime: string}, since: number, what: string) => {
    const now = {pid: appPid(), runtime: await appRuntime()}
    check(now.pid === was.pid, `the app is not the same process ${what}`)
    check(now.runtime === was.runtime, `the app's JS reloaded ${what}`)
    check(crashReportsSince(since).length === 0, `the app wrote a crash report ${what}`)
  }

  it('a cold launch comes up on the screen it saved, serves images and does not crash', async function () {
    // worst case (s): leave 103, step 2, relaunch 254 with the mark 120 inside it, signed in 90, the
    // identity 121, rec 60, go 21, state 1, avatar 21, same 122, step 2 = 917
    this.timeout(960_000)
    const {smokeUser} = loadE2EAccounts()
    await leaveOnPeople()
    await step('On People, saved as the screen the next launch opens')

    const since = Date.now()
    // marked once the old process is gone, so its last lines are not read as the launch's
    let goMark: ReturnType<typeof goLogMark> | undefined
    await relaunchApp({
      whileDown: () => {
        goMark = goLogMark()
      },
    })
    const mark = goMark!
    await waitSignedIn()
    const launched = await appIdentity()
    // the new runtime's first recording comes up on the saved screen
    const rec = attemptRecording()
    await rec.checkpoint()
    check(!!rec.recordings.at(-1)?.startRoutes.includes('peopleRoot'), 'the relaunched app did not come up on People, the screen it saved')
    // Go's launch: not yet active (whichever launch callback lands first), then active
    await waitForLinesInOrder('the phone service to record the launch', () => linesSince(mark), [GO_LAUNCHING, GO_FOREGROUND])
    // the app holds the address of the image server Go started for it, not a stale one
    const started = linesSince(mark).flatMap(l => GO_HTTP_SRV.exec(l)?.[1] ?? []).at(-1)
    check(started !== undefined && started === (await appSnapshot()).httpSrv.address, "the app does not hold the address of the image server Go started")
    await waitForAvatar200(smokeUser)
    await sameProcess(launched, since, 'after the launch')
    creditSurface('relaunch')
    await step('The relaunched app is up on People with images served', {card: true})
  })

  it('a trip to the background and back keeps the app, and shows a message that came in meanwhile', async function () {
    // worst case (s): channel 240, open 100, step 2, the identity 121, mark 120, go 21, peer 70, peer
    // send 90, go 21, active 31, screen 11, message 61, drawn 10, same 122, step 2 = 1022
    this.timeout(1_060_000)
    const made = await masked(async () => channels.make('life', {withSecond: true}))
    const {convID} = made
    await openConversation(convID)
    await step('In the channel')

    const since = Date.now()
    const before = await appIdentity()
    const goMark = goLogMark()
    await toBackground()
    await waitForLinesInOrder('the phone service to record the app in the background', () => linesSince(goMark), [GO_BACKGROUND])
    const text = e2eMarker('lifecycle-recv')
    await sendWithRetry(await secondSender(), convID, text)
    await toForeground()

    await waitForLinesInOrder('the phone service to record the trip in order', () => linesSince(goMark), [GO_BACKGROUND, GO_FOREGROUND])
    await waitForAppState('active', undefined, 30_000)
    await expectScreen('the channel still up after the trip', 'chatConversation', p => p['conversationIDKey'] === convID)
    // the message the second account sent while the app was away, loaded and drawn
    await waitForRow(text, 60_000)
    await rowElement(text).waitForExist({timeout: 10_000})
    await sameProcess(before, since, 'after the trip to the background')
    creditSurface('background-foreground')
    await step('Back from the background with the new message', {card: true})
  })

  it('five round trips in a row are each seen in order, and leave the app active in the same process', async function () {
    // worst case (s): active 31, the identity 121, mark 120; each cycle: the background 1, go 21, the
    // foreground 1, go 21 = 44, five 220; active 31, same 122, step 2 = 647
    this.timeout(680_000)
    await waitForAppState('active', undefined, 30_000)
    const since = Date.now()
    const before = await appIdentity()
    const goMark = goLogMark()
    for (let i = 1; i <= CYCLES; i++) {
      await toBackground()
      await waitForLinesInOrder(`the phone service to record trip ${i} to the background`, () => linesSince(goMark), [...roundTrips(i - 1), GO_BACKGROUND])
      await toForeground()
      await waitForLinesInOrder(`the phone service to record trip ${i} back`, () => linesSince(goMark), roundTrips(i))
    }
    await waitForAppState('active', undefined, 30_000)
    await sameProcess(before, since, `after ${CYCLES} round trips`)
    await step(`Active after ${CYCLES} round trips`, {card: true})
  })

  it('Notification Center pulled over the app makes it inactive, then active again, and opens nothing', async function () {
    // worst case (s): people 66, app mark 2, mark 120, center 55 + 16 + 21, go 21, until 12, screen 11,
    // step 2 = 326
    this.timeout(360_000)
    await fromPeople()
    const mark = await appLogMark()
    const goMark = goLogMark()
    await withNotificationCenter(async () => {
      await waitForAppState('inactive', undefined, 15_000)
      // Notification Center only resigns active; the same read that holds INACTIVE holds no BACKGROUND
      await waitForLinesInOrder('the phone service to record the app inactive', () => linesSince(goMark), [GO_INACTIVE])
      check(!linesSince(goMark).some(l => GO_BACKGROUND.test(l)), 'the app went to the background under Notification Center')
    })
    // withNotificationCenter waited for the app to be active again
    await waitForLinesInOrder('the phone service to record the app active again', () => linesSince(goMark), [GO_INACTIVE, GO_FOREGROUND])
    const focus = focusChanges(await appLogUntilMarker(mark, 'notification-center'))
    check(focusLeftAndBack(focus), `the app's focus went ${focus.join(', ') || 'nowhere'}, not inactive and back to active`)
    await expectScreen('People still up after Notification Center', 'peopleRoot')
    await step('Active again on People after Notification Center', {card: true})
  })
})

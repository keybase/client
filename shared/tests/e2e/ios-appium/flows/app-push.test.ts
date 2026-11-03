// Push notifications delivered to the simulator (simctl push of a chat.newmessage, gate/device.ts),
// each for a throwaway channel of the e2e team this run made and the smoke account's uid, its body
// this run's stamped marker (no message content): one pushed while the app is in the foreground shows
// nothing and opens nothing (a second one right after, to the app in the background, shows its
// banner, so pushes were reaching the phone); one shown while the app is in the background and left
// untapped opens nothing when the app comes back; a tapped banner opens its conversation; a banner
// tapped while the app is not running launches the app into it. Then the Settings > Notifications
// "Phone notifications" group: one of its settings switched from the phone, read back on the server,
// and switched back.
//
// A push to the background waits for the phone's service to record the app in the background first:
// one sent before that is handed to the app instead of shown. 'push-notification' (and 'relaunch'
// for the cold tap) is credited only once the screen the tap opened is asserted: its route and
// conversation. Each "opened nothing" is read off the app's log up to a marker logged after the
// delivery, and the screen read after it.
//
// The flow's afterEach launches the app again, or brings it to the front, when a test stopped part
// way, clears this run's notifications from Notification Center (only those: their bodies carry the
// run's stamp; a failure there poisons the gate), puts back the notification settings through the
// host (as smoke, each read back) and deletes the channel.
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eMarker} from '../../shared/run-marker.ts'
import {
  globalNotifSettings,
  restoreGlobalNotifSettings,
  restoreSubscriptions,
  subscriptions,
  type EmailSubscription,
} from '../../shared/settings'
import * as T from '../../shared/test-ids'
import {appUid} from '../gate/accounts'
import {appLogMark, appLogUntilMarker} from '../gate/app-log'
import {creditSurface} from '../gate/attempt'
import {launchedBy, launchIfGone, pushNotification, toBackground, toForeground} from '../gate/device'
import {accountLinkLines, deepLinkEvents, focusChanges, GO_BACKGROUND, launchedInto, pushTapLinks} from '../gate/links-push-lib.ts'
import {attemptRecording} from '../gate/recording'
import {conversationOpened, expectScreen, fromPeople, leaveOnPeople} from '../gate/screens'
import {step} from '../gate/step'
import {findBanner, tapBanner, withNotificationCenter} from '../gate/system-ui'
import {waitSignedIn} from '../helpers/chat'
import {goLogMark, waitFor, waitForAppState} from '../helpers/lifecycle'
import {linesSince} from '../gate/go-log-lib.ts'
import {check} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {throwawayChannels} from '../helpers/chat-host'
import {expectShown, openNotificationSettings, settles, switchOf, tapAndCall} from '../helpers/setting-controls'
import {masked} from '../helpers/teams'

const POST_JSON = 'keybase.1.apiserver.PostJSON'

// how long a push to the app in the foreground is watched for a banner (it shows none)
const FOREGROUND_WINDOW_MS = 8_000

describe('app push notifications', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120
  //   uid       appUid 2;  people  fromPeople 66 (escapeToTabs 30, the People tab 15, the screen 21);
  //             leave  leaveOnPeople 103
  //   push      pushNotification 30 (simctl's deadline);  banner  findBanner 9 (8, its lookups 1);
  //             tap  tapBanner 9;  window  findBanner over the window 9
  //   background  inBackground 142 (the log mark 120, the background 1, 20s of reads overrun by one
  //             1);  foreground  toForeground 1, active 31
  //   mark      appLogMark 2;  until  appLogUntilMarker 12;  screen  expectScreen 21;  cold screen 61
  //   launched  launchedBy 323 (a checkpoint 60, terminate 10, the push 30 and its tap 9, its launch
  //             30, the new runtime 120, the error and log captures 4, a checkpoint 60);  signed in 90
  //   rec       a checkpoint 60
  //   host      a host read 150;  open  openNotificationSettings 97;  shown  expectShown 41;  tap
  //             tapAndCall 37;  settles  a host read's 180
  //   step      2 (its 1s settle and the attach)

  // -- what the afterEach puts back -----------------------------------------------------------------

  // the throwaway channels a test made
  const channels = throwawayChannels()
  // set before a push is sent, cleared once Notification Center shows none of this run's
  let pushed = false
  // the notification settings a test may have changed, set before the first change and cleared once
  // put back: a toggle saves every group the page loaded and the chat notification settings too
  let notifications:
    | {map: Record<string, boolean>; email: Array<EmailSubscription>; push: Array<EmailSubscription>}
    | undefined

  const deleteChannels = async () => masked(channels.deleteAll)

  // Bound: withNotificationCenter 55 (open 1, the clear 30 overrun by one swipe and its Clear 4, close
  // 1, the app active 11, the springboard settings 8).
  const clearBanners = async () => {
    if (!pushed) return
    await withNotificationCenter(async () => Promise.resolve())
    pushed = false
  }

  // Bound: three host restores 1065 (each a read 150, the write 35, 20s of reads overrun by one 170).
  // One that fails keeps `notifications`, so every later afterEach tries it again, and the settings
  // test refuses to start until it is put back.
  const restoreNotifications = async () => {
    const n = notifications
    if (!n) return
    await masked(async () => restoreGlobalNotifSettings(n.map))
    await masked(async () => restoreSubscriptions('email', n.email))
    await masked(async () => restoreSubscriptions('app_push', n.push))
    notifications = undefined
  }

  // Nothing a test left behind, after a timeout too: the app back up in front first (no recording; the
  // next test's reset drives it), then this run's notifications, the settings, the channel and the tab
  // root. Worst case (s): launchIfGone 272 (a launch 120 or the activate 1, in front 31, the runtime
  // 121), clearBanners 55, restoreNotifications 1065, a channel 120, escapeToTabs 30 = 1542.
  afterEach(async function () {
    this.timeout(1_600_000)
    await withCleanup(launchIfGone, [clearBanners, restoreNotifications, deleteChannels, escapeToTabs])
  })

  // -- helpers --------------------------------------------------------------------------------------

  // A throwaway channel for the push to name, and the smoke account's uid. Bound: channel 240, uid 2.
  const pushTarget = async () => {
    const made = await masked(async () => channels.make('push', {withSecond: false}))
    return {convID: made.convID, uid: await appUid()}
  }

  // Sends a push for `convID` showing `body`. Bound: push 30.
  const push = (convID: string, uid: string, body: string) => {
    pushed = true
    pushNotification({body, convID, uid})
  }

  // Moves the app to the background and waits for the phone's service to record it there. Bound:
  // inBackground 142.
  const inBackground = async () => {
    const mark = goLogMark()
    await toBackground()
    await waitFor('the phone service to record the app in the background', () => (linesSince(mark).some(l => GO_BACKGROUND.test(l)) ? true : undefined), {
      interval: 500,
      timeout: 20_000,
    })
  }

  // The app in the foreground again. Bound: foreground 1, active 31.
  const backInForeground = async () => {
    await toForeground()
    await waitForAppState('active', undefined, 30_000)
  }

  // -- pushes ---------------------------------------------------------------------------------------

  it('a push that arrives while the app is in the foreground shows nothing and opens nothing', async function () {
    // worst case (s): channel 240, uid 2, people 66, mark 2, push 30, window 9, until 12, screen 21,
    // step 2; the delivery check: background 142, push 30, banner 9, foreground 32, step 2 = 599
    this.timeout(640_000)
    const {convID, uid} = await pushTarget()
    await fromPeople()
    const mark = await appLogMark()
    const body = e2eMarker('push-foreground')
    push(convID, uid, body)
    // the app presents a push in the foreground as nothing (AppDelegate willPresent)
    check((await findBanner(body, FOREGROUND_WINDOW_MS)) === undefined, 'a push to the app in the foreground showed a banner')
    const lines = await appLogUntilMarker(mark, 'push-foreground')
    check(pushTapLinks(lines).length === 0, 'the app took a notification tap for the push in the foreground')
    await expectScreen('People still up after the push', 'peopleRoot')
    // People lists people who are not test accounts
    await step('The push in the foreground opened nothing', {screenshot: false})

    // the same push to the same conversation shows once the app is in the background, so pushes were
    // reaching the phone while the one above showed nothing
    await inBackground()
    const shown = e2eMarker('push-delivered')
    push(convID, uid, shown)
    check((await findBanner(shown)) !== undefined, 'a push to the app in the background right after showed no banner: pushes were not reaching the phone')
    await backInForeground()
    await step('A push right after, in the background, showed its banner', {screenshot: false})
  })

  it('a push shown while the app is in the background, left untapped, opens nothing when the app comes back', async function () {
    // worst case (s): channel 240, uid 2, people 66, mark 2, background 142, push 30, banner 9,
    // foreground 32, until 12, screen 21, step 2 = 558
    this.timeout(600_000)
    const {convID, uid} = await pushTarget()
    await fromPeople()
    const mark = await appLogMark()
    await inBackground()
    const body = e2eMarker('push-untapped')
    push(convID, uid, body)
    check((await findBanner(body)) !== undefined, 'the push to the app in the background showed no banner')
    await backInForeground()
    // the app's own line for coming back is in the window, so the window holds what it did
    const lines = await appLogUntilMarker(mark, 'push-untapped')
    check(focusChanges(lines).includes('active'), "the app's log holds no return to the foreground")
    check(pushTapLinks(lines).length === 0, 'the app took a notification tap for the untapped push')
    await expectScreen('People still up after the untapped push', 'peopleRoot')
    // People lists people who are not test accounts
    await step('The untapped push opened nothing', {screenshot: false})
  })

  it('a banner tapped while the app is in the background opens its conversation', async function () {
    // worst case (s): channel 240, uid 2, people 66, mark 2, background 142, push 30, tap 9, active
    // 31, screen 21, until 12, step 2 = 557
    this.timeout(600_000)
    const {convID, uid} = await pushTarget()
    await fromPeople()
    const mark = await appLogMark()
    await inBackground()
    const body = e2eMarker('push-tapped')
    push(convID, uid, body)
    await tapBanner(body)
    await waitForAppState('active', undefined, 30_000)
    await conversationOpened('the conversation the tapped banner opened', convID)
    const lines = await appLogUntilMarker(mark, 'push-tapped')
    const taps = pushTapLinks(lines)
    check(taps.length === 1 && taps[0] === `keybase://convid/${convID}`, `the app took ${taps.length} notification taps, not the one for the conversation`)
    check(deepLinkEvents(lines).length === 0, 'the tap reached the app as a link event too')
    check(accountLinkLines(lines).length === 0, 'the tap started an account switch')
    creditSurface('push-notification')
    await step('The tapped banner opened its conversation', {card: true})
  })

  it('a banner tapped while the app is not running launches the app into its conversation', async function () {
    // worst case (s): channel 240, uid 2, leave 103, step 2, launched 323, signed in 90, cold screen
    // 61, rec 60, step 2 = 883
    this.timeout(920_000)
    const {convID, uid} = await pushTarget()
    await leaveOnPeople()
    // People lists people who are not test accounts
    await step('On People, saved as the screen the next launch opens', {screenshot: false})

    const body = e2eMarker('push-cold')
    await launchedBy(async () => {
      push(convID, uid, body)
      await tapBanner(body)
    })
    await waitSignedIn()
    await conversationOpened('the conversation the tapped banner launched into', convID, 60_000)
    // the new runtime's first recording: up on the conversation as it started, People never shown
    const rec = attemptRecording()
    await rec.checkpoint()
    check(launchedInto(rec.recordings.at(-1), 'chatConversation'), 'the launched app did not come up on the conversation the push named')
    creditSurface('push-notification')
    creditSurface('relaunch')
    await step('The tapped banner launched the app into its conversation', {card: true})
  })

  // -- the phone notification settings -------------------------------------------------------------

  it('Settings > Notifications: a phone notification switched from the phone, read back on the server, and switched back', async function () {
    // worst case (s): host 150 x3, open 97, shown 41, step 2, tap 37, settles 180, shown 41, step 2,
    // tap 37, settles 180, shown 41, step 2 = 1110
    this.timeout(1_200_000)
    check(notifications === undefined, "refusing to run: an earlier attempt's notification settings were not put back")
    // refuses an account unsubscribed from all of a group; "Unsubscribe from all" is never pressed
    const pushSettings = await masked(async () => subscriptions('app_push'))
    const email = await masked(async () => subscriptions('email'))
    const map = await masked(async () => globalNotifSettings())
    notifications = {email, map, push: pushSettings}
    const first = pushSettings[0]!
    check(/^[a-z0-9_]+$/.test(first.name), 'the first phone notification setting has a name that is not plain')
    const base = `${T.SETTINGS_NOTIFY_SWITCH_PREFIX}app_push-${first.name}`
    const subscribed = async () => {
      const s = (await masked(async () => subscriptions('app_push'))).find(x => x.name === first.name)
      check(s !== undefined, 'the phone notification setting is gone from the account')
      return s!.subscribed
    }
    const was = first.subscribed

    await openNotificationSettings()
    await expectShown(switchOf(base, was), 'the phone notification before the change')
    await step('The phone notification before the change')

    await tapAndCall(base, POST_JSON, 'the notification settings save')
    await settles('the phone notification to read back changed', subscribed, !was)
    await expectShown(switchOf(base, !was), 'the phone notification after the change')
    await step('The phone notification changed', {card: true})

    await tapAndCall(base, POST_JSON, 'the notification settings save back')
    await settles('the phone notification to read back changed back', subscribed, was)
    await expectShown(switchOf(base, was), 'the phone notification after the change back')
    await step('The phone notification changed back')
  })
})

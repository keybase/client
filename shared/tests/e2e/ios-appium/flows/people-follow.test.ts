// Following and unfollowing the second account from its profile on the phone. Only the second account
// is ever followed (requireFollowTarget). Whether the smoke account follows it is read before the file
// runs, every test starts from not following, and the flow's afterEach puts the original back; each
// change the phone makes is read back from the server's follower list of the second account (through
// the host's `keybase apicall`), whose answer must parse (its status and user list are the anchor), so
// a failed read never reads as "not following".
//
// The follow button reads "Follow" or "Follow back" (the second account follows back) and "Following"
// once followed; tapping "Following" unfollows on the phone. The "..." menu offers Unfollow only
// when the profile's identify is not valid (profile/user/actions/index.tsx), so that test drives it
// when the menu offers it, and checks the menu against the identify state the app holds (a store read).
//
// A device sees a follow change another device of the account made only once the server's merkle
// tree holds it, and on this server a new merkle root can take ten minutes. Until then the host's
// `keybase list-following` and `keybase follow` take the phone's change as not made (follow reads
// "Your view is up-to-date" and writes nothing), and the phone's follow button keeps the host's change
// unseen (no notification reaches the phone, and a relaunch loads the stale view). So the reads go to
// the server's list, the tests change the follow only from the phone, and the host writes only to put
// a state back: hostSetsFollow tries the CLI until the server lists the state, and a test after a host
// write relaunches the app until the button reads it.
//
// Runs after the chat flows: a follow adds a link to the smoke account's sigchain, and a peer send
// right after it can fail until the server's chain catches up with its merkle tree.
import {loadE2EAccounts} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {requireFollowTarget, serverSaysFollowsSecond, setFollowSecondFromCli} from '../../shared/people'
import * as T from '../../shared/test-ids'
import {requireSecondNotBlocked} from '../gate/blocks'
import {relaunchOnSmoke} from '../gate/accounts'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {openLink} from '../gate/device'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import type {CallMark} from '../gate/recorder-lib'
import {trackerState} from '../gate/app-ask'
import {step} from '../gate/step'
import {closeMessageMenu} from '../helpers/chat'
import {el} from '../helpers/elements'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, menuLabels, menuOffers, openMenuFrom} from '../helpers/menus'
import {labelParts} from '../gate/page-source-lib'
import {escapeToTabs} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const FOLLOW = 'keybase.1.identify3.identify3FollowUser'
const FOLLOWING = ['Following']
const NOT_FOLLOWING = ['Follow', 'Follow back']

describe('people follow', function () {
  // whether the smoke account followed the second account before the file; undefined until read
  let originallyFollows: boolean | undefined
  // set when the host changed the follow state, cleared once the phone's button reads the change
  let hostWrote = false

  // -- reads --------------------------------------------------------------------------------------

  const onSecond = async () => {
    const {secondUser} = loadE2EAccounts()
    return expectScreen("the second account's profile", 'profile', p => p['username'] === secondUser)
  }

  // Bound: 30 of tries and one read overrun (75, whoami 15 and two calls 30) = 105.
  const expectHostFollows = async (want: boolean, what: string) =>
    waitFor(
      what,
      async () => ((await masked(async () => serverSaysFollowsSecond())) === want ? true : undefined),
      {interval: 2_000, timeout: 30_000}
    )

  // Waits for the follow button to read one of `labels`. Bound: `timeout` 10s, plus one read 1.
  const followReads = async (what: string, labels: ReadonlyArray<string>, timeout = 10_000) =>
    waitFor(
      what,
      async () => {
        const button = el(T.PROFILE_FOLLOW_BUTTON)
        if (!(await button.isExisting())) return undefined
        const parts = labelParts((await button.getAttribute('label').catch(() => null)) ?? '')
        return labels.some(l => parts.includes(l)) ? true : undefined
      },
      {interval: 250, timeout}
    )

  const followCalls = async (seq: CallMark) => (await uiCallsSince(seq, FOLLOW)).length

  // The second account's profile, opened from a link, with its follow button drawn. Bound:
  // escapeToTabs 30, the link 1, screen 11, the button 31 (30, one overrun 1) = 73.
  const openSecondProfile = async () => {
    const {secondUser} = loadE2EAccounts()
    requireFollowTarget(secondUser)
    await escapeToTabs()
    openLink(`keybase://profile/show/${secondUser}`)
    await onSecond()
    await el(T.PROFILE_FOLLOW_BUTTON).waitForExist({timeout: 30_000})
  }

  // The second account's profile with its follow button reading one of `labels`. After a host write
  // the phone's view lags the server's merkle tree, so until the button reads it the app is relaunched
  // and the profile opened again. Bound: openSecondProfile 73, the label 11; after a host write 900 of
  // tries, overrun by one (the label 16, relaunch 200, signed in 90, the account 1,
  // openSecondProfile 73) 380 = 1280.
  const openSecondProfileReading = async (what: string, labels: ReadonlyArray<string>) => {
    await openSecondProfile()
    if (!hostWrote) {
      await followReads(what, labels)
      return
    }
    await waitFor(
      what,
      async () => {
        if (await followReads(what, labels, 15_000).then(() => true, (e: unknown) => {
          if (isAttemptOver(e)) throw e
          return false
        })) {
          return true
        }
        await relaunchOnSmoke()
        await openSecondProfile()
        return undefined
      },
      {interval: 1_000, timeout: 900_000}
    )
    hostWrote = false
  }

  // Taps the follow button on the second account's profile, and waits for the follow call to go out
  // exactly once. Bound: seq 2, screen 11, tap 1, waited for 12, calls 2 = 28.
  const tapFollowButton = async () => {
    const seq = await currentCallSeq()
    await onSecond()
    await el(T.PROFILE_FOLLOW_BUTTON).click()
    await waitForUiCall('the follow call to go out', seq, FOLLOW)
    check((await followCalls(seq)) === 1, 'the button sent the follow call more than once')
  }

  // -- what the afterEach puts back ---------------------------------------------------------------

  // Puts the follow state to `want` from the host CLI. While the host's view lags the phone's last
  // change its CLI writes nothing (or reads `want` already), so it is tried again until the server
  // lists `want`. Bound: the first read 75, then 900 of tries 30s apart, overrun by one
  // (setFollowSecondFromCli: a read 45, the write 60, then 30 of reads overrun by one 45 = 180; the
  // server read 75) 255 = 1230.
  const hostSetsFollow = async (want: boolean) => {
    if ((await masked(async () => serverSaysFollowsSecond())) === want) return
    hostWrote = true
    await waitFor(
      `the host to put the follow state back to ${want ? 'following' : 'not following'}`,
      async () => {
        // the host's own view can read `want` already, or throw after a write it did not make
        await masked(async () => setFollowSecondFromCli(want)).catch((e: unknown) => {
          if (isAttemptOver(e)) throw e
        })
        return (await masked(async () => serverSaysFollowsSecond())) === want ? true : undefined
      },
      {interval: 30_000, timeout: 900_000}
    )
  }

  // Bound: hostSetsFollow 1230.
  const restoreFollow = async () => {
    if (originallyFollows === undefined) return
    await hostSetsFollow(originallyFollows)
  }

  before(async function () {
    // the second account is followed: a failed chat-blocks restore refuses here. The block read 75s,
    // the follow read 75.
    this.timeout(180_000)
    await masked(async () => requireSecondNotBlocked())
    originallyFollows = await masked(async () => serverSaysFollowsSecond())
  })

  // every test starts from not following; hostSetsFollow is bounded at 1230s
  beforeEach(async function () {
    this.timeout(1_260_000)
    await hostSetsFollow(false)
  })

  // Worst case (s): close 19, restoreFollow 1230, escapeToTabs 30 = 1279.
  afterEach(async function () {
    this.timeout(1_300_000)
    await withCleanup(closeMessageMenu, [restoreFollow, escapeToTabs])
  })

  it('follow and unfollow from the second account’s profile', async function () {
    // worst case (s): openSecondProfileReading 1280, step 2, a tap 28, the host 105, the label 11,
    // step 2, a tap 28, the host 105, the label 11, step 2 = 1574
    this.timeout(1_590_000)
    await openSecondProfileReading('the follow button before the follow', NOT_FOLLOWING)
    await step('The second account’s profile, not followed')

    await tapFollowButton()
    await expectHostFollows(true, 'the second account in list-following after the follow')
    await followReads('the follow button once followed', FOLLOWING)
    await step('Followed', {card: true})

    await tapFollowButton()
    await expectHostFollows(false, 'the second account gone from list-following after the unfollow')
    await followReads('the follow button after the unfollow', NOT_FOLLOWING)
    await step('Unfollowed')
  })

  it('unfollow from the “...” menu when the profile offers it', async function () {
    // worst case (s): openSecondProfileReading 1280, a tap 28, the host 105, the label 11, step 2,
    // screen 11, the menu button 31 and its open 19, the menu read 15, step 2, the state read 22, then
    // the seq 2, the item 22 (or close 19, a tap 28), the call 12, its count 2, the host 105, the label
    // 11, step 2 = 1690
    this.timeout(1_710_000)
    // followed from the phone: a host follow would leave the phone's view behind
    await openSecondProfileReading('the follow button before the follow', NOT_FOLLOWING)
    await tapFollowButton()
    await expectHostFollows(true, 'the second account in list-following after the follow')
    await followReads('the follow button once followed', FOLLOWING)
    await step('The second account’s profile, followed')

    await onSecond()
    await el(T.PROFILE_ACTIONS_MENU).waitForExist({timeout: 30_000})
    await openMenuFrom("the profile's menu", async () => el(T.PROFILE_ACTIONS_MENU).click())
    const labels = await menuLabels()
    // the profile's own items anchor the read
    check(menuOffers(labels, 'Add to team...'), "the open menu is not the profile's")
    await step('The profile’s menu')

    // the menu offers Unfollow only while the identify is not valid (profile/user/actions/index.tsx)
    const {secondUser} = loadE2EAccounts()
    const state = await masked(async () => trackerState(secondUser))
    const offered = menuOffers(labels, 'Unfollow')
    check(state !== null, 'the app holds no identify state for the second account')
    check(
      offered === (state !== 'valid'),
      offered
        ? 'the menu offers Unfollow while the identify state is valid'
        : `the menu offers no Unfollow while the identify state is ${state}, not valid`
    )

    if (offered) {
      const seq = await currentCallSeq()
      await chooseMenuItem('Unfollow')
      await waitForUiCall('the follow call to go out', seq, FOLLOW)
      check((await followCalls(seq)) === 1, 'the menu sent the follow call more than once')
      await expectHostFollows(false, 'the second account gone from list-following after the menu Unfollow')
      await followReads('the follow button after the unfollow', NOT_FOLLOWING)
      await step('Unfollowed from the menu')
    } else {
      await step('The menu holds no Unfollow, as the valid identify state says')
      // put back from the phone too: its Following button
      await closeMessageMenu()
      await tapFollowButton()
      await expectHostFollows(false, 'the second account gone from list-following after the unfollow')
      await followReads('the follow button after the unfollow', NOT_FOLLOWING)
    }
  })
})

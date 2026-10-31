// Following and unfollowing the second account from its profile on the phone. Only the second account
// is ever followed (requireFollowTarget). Whether the smoke account follows it is read before the file
// runs, every test starts from not following, and the flow's afterEach puts the original back; each
// change the phone makes is read back from `keybase list-following` on the host, whose answer must
// parse (its header and rule are the anchor), so a failed list never reads as "not following".
//
// The follow button reads "Follow" or "Follow back" (the second account follows back) and "Following"
// once followed; tapping "Following" unfollows on the phone. The "..." menu offers Unfollow only
// when the profile's identify is not valid (profile/user/actions/index.tsx), so that test drives it
// when the menu offers it, and checks the menu against the identify state the app holds (a store read).
//
// Runs after the chat flows: a follow adds a link to the smoke account's sigchain, and a peer send
// right after it can fail until the server's chain catches up with its merkle tree.
import {loadE2EAccounts} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {followsSecond, requireFollowTarget, setFollowSecondFromCli} from '../../shared/people'
import * as T from '../../shared/test-ids'
import {requireSecondNotBlocked} from '../gate/blocks'
import {openLink} from '../gate/device'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import type {CallMark} from '../gate/recorder-lib'
import {trackerState} from '../gate/app-ask'
import {step} from '../gate/step'
import {closeMessageMenu} from '../helpers/chat'
import {el} from '../helpers/elements'
import {expectScreen} from '../helpers/files'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, menuLabels, menuOffers, openMenuFrom} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const FOLLOW = 'keybase.1.identify3.identify3FollowUser'

describe('people follow', function () {
  // whether the smoke account followed the second account before the file; undefined until read
  let originallyFollows: boolean | undefined

  // -- reads --------------------------------------------------------------------------------------

  const onSecond = async () => {
    const {secondUser} = loadE2EAccounts()
    return expectScreen("the second account's profile", 'profile', p => p['username'] === secondUser)
  }

  // Bound: 30 of tries and one read overrun (45, whoami 15 and the CLI 30) = 75.
  const expectHostFollows = async (want: boolean, what: string) =>
    waitFor(
      what,
      async () => ((await masked(async () => followsSecond())) === want ? true : undefined),
      {interval: 2_000, timeout: 30_000}
    )

  // Waits for the follow button to read one of `labels`. Bound: 10s, plus one read 1.
  const followReads = async (what: string, ...labels: Array<string>) =>
    waitFor(
      what,
      async () => {
        const button = el(T.PROFILE_FOLLOW_BUTTON)
        if (!(await button.isExisting())) return undefined
        const label = ((await button.getAttribute('label').catch(() => null)) ?? '').replace(/\u00a0/g, ' ')
        const parts = label.split(', ').map(p => p.trim())
        return labels.some(l => parts.includes(l)) ? true : undefined
      },
      {interval: 250, timeout: 10_000}
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

  // Bound: setFollowSecondFromCli: a read 45, the write 60, then 30 of reads overrun by one 45 = 180.
  const restoreFollow = async () => {
    if (originallyFollows === undefined) return
    await masked(async () => setFollowSecondFromCli(originallyFollows!))
  }

  before(async function () {
    // the second account is followed: a failed chat-blocks restore refuses here. The block read 75s,
    // the follow read 45.
    this.timeout(150_000)
    await masked(async () => requireSecondNotBlocked())
    originallyFollows = await masked(async () => followsSecond())
  })

  // every test starts from not following; the write is bounded at 180s
  beforeEach(async function () {
    this.timeout(200_000)
    await masked(async () => setFollowSecondFromCli(false))
  })

  // Worst case (s): close 5, restoreFollow 180, escapeToTabs 30 = 215.
  afterEach(async function () {
    this.timeout(240_000)
    await withCleanup(closeMessageMenu, [restoreFollow, escapeToTabs])
  })

  it('follow and unfollow from the second account’s profile', async function () {
    // worst case (s): openSecondProfile 73, the label 11, step 2, a tap 28, the host 75, the label 11,
    // step 2, a tap 28, the host 75, the label 11, step 2 = 318
    this.timeout(330_000)
    await openSecondProfile()
    await followReads('the follow button before the follow', 'Follow', 'Follow back')
    await step('The second account’s profile, not followed')

    await tapFollowButton()
    await expectHostFollows(true, 'the second account in list-following after the follow')
    await followReads('the follow button once followed', 'Following')
    await step('Followed', {card: true})

    await tapFollowButton()
    await expectHostFollows(false, 'the second account gone from list-following after the unfollow')
    await followReads('the follow button after the unfollow', 'Follow', 'Follow back')
    await step('Unfollowed')
  })

  it('unfollow from the “...” menu when the profile offers it', async function () {
    // worst case (s): the host follow 180, openSecondProfile 73, the label 11, step 2, screen 11, the
    // menu button 31 and its open 19, the menu read 15, step 2, the state read 22, then the seq 2, the item 22, the
    // call 12, its count 2, the host 75, the label 11, step 2 = 492
    this.timeout(510_000)
    await masked(async () => setFollowSecondFromCli(true))
    await openSecondProfile()
    await followReads('the follow button once followed', 'Following')
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
      await followReads('the follow button after the unfollow', 'Follow', 'Follow back')
      await step('Unfollowed from the menu')
    } else {
      await step('The menu holds no Unfollow, as the valid identify state says')
    }
  })
})

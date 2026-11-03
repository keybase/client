// keybase:// links handed to the app as the OS hands them (simctl openurl), one link per test, each
// from the People tab so a screen the link did not open can't pass: a team channel, a team page, the
// second account's profile, the smoke account's private folder, a malformed link (the link error, and
// back), a conversation link that launches the app, and a conversation link naming another account,
// which opens as a plain link and never switches accounts.
//
// Every link names only the test accounts, the e2e team (its page, viewed) or a throwaway channel of
// it this run made (and the flow's afterEach deletes). openLink keeps the link out of its errors.
// 'deep-link' (and 'relaunch' for the cold link) is credited only once the screen the link opened
// is asserted: its route and params, and what it draws.
import {loadE2EAccounts} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {kbfsList, smokeFolder} from '../../shared/files.ts'
import {teamID} from '../../shared/teams.ts'
import * as T from '../../shared/test-ids'
import {appAccount} from '../gate/accounts'
import {appLogMark, appLogUntilMarker} from '../gate/app-log'
import {creditSurface} from '../gate/attempt'
import {launchedBy, launchIfGone, openLink} from '../gate/device'
import {accountLinkLines, deepLinkEvents, launchedInto, pushTapLinks} from '../gate/links-push-lib.ts'
import {attemptRecording} from '../gate/recording'
import {backToScreen, conversationOpened, expectScreen, fromPeople, leaveOnPeople} from '../gate/screens'
import {step} from '../gate/step'
import {el, waitForTestID} from '../helpers/elements'
import {expectFolder} from '../helpers/files'
import {waitSignedIn} from '../helpers/chat'
import {waitFor} from '../helpers/lifecycle'
import {check, labelledElement} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {throwawayChannels} from '../helpers/chat-host'
import {expectTeamPage, masked} from '../helpers/teams'

// the texts of the navigation bar, where a conversation's header draws its channel's name
const HEADER_TEXTS = '-ios class chain:**/XCUIElementTypeNavigationBar/**/XCUIElementTypeStaticText'

// a uid that is no account's: a link, unlike a tapped notification, never acts on one
const OTHER_UID = '00000000000000000000000000000019'

describe('app deep links', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120
  //   people    fromPeople 66 (escapeToTabs 30, the People tab 15, the screen 21);  leave
  //             leaveOnPeople 103 (fromPeople 66, the saved route 37)
  //   link      openLink 120 (simctl's own deadline)
  //   screen    expectScreen 21 (20, one read 1);  cold screen  61 (60, one read 1)
  //   header    the channel's name in the header 11;  page  expectTeamPage 21;  tabs  10
  //   host      a host read 150;  listing  one host listing 60
  //   launched  launchedBy 404 (a checkpoint 60, terminate 10, the link 120, its launch 30, the new
  //             runtime 120, the error and log captures 4, a checkpoint 60);  signed in  90
  //   rec       a checkpoint 60;  account  appAccount 1;  mark  appLogMark 2;  until  appLogUntilMarker 12
  //   back      backToScreen 101 (five backs of 20, one read 1)
  //   step      2 (its 1s settle and the attach)

  // the throwaway channels a test made
  const channels = throwawayChannels()
  const newChannel = async () => masked(async () => channels.make('link', {withSecond: false}))
  const deleteChannels = async () => masked(channels.deleteAll)

  // Nothing a test made left behind, after a timeout too: the app launched again or brought to the
  // front when a test stopped part way (no recording; the next test's reset drives it), the channel
  // deleted, the tab root. Worst case (s): launchIfGone 272 (a launch 120 or the activate 1, in front 31, the
  // runtime 121), a channel 120, escapeToTabs 30 = 422.
  afterEach(async function () {
    this.timeout(450_000)
    await withCleanup(launchIfGone, [deleteChannels, escapeToTabs])
  })

  it('a team channel link opens the channel', async function () {
    // worst case (s): channel 240, people 66, link 120, screen 21, header 11, step 2 = 460
    this.timeout(500_000)
    const {team} = loadE2EAccounts()
    const {convID, topicName} = await newChannel()
    await fromPeople()
    openLink(`keybase://chat/${team}#${topicName}`)
    await conversationOpened('the conversation the channel link opened', convID)
    // the name compared in memory, never put into a selector or an error
    await waitFor('the channel name in the header', async () => labelledElement(HEADER_TEXTS, `#${topicName}`, 'the channel name in the header'), {
      interval: 250,
      timeout: 10_000,
    })
    creditSurface('deep-link')
    await step('The channel link opened the channel', {card: true})
  })

  it('a team page link opens the team', async function () {
    // worst case (s): host 150, people 66, link 120, page 21, tabs 10, step 2 = 369
    this.timeout(400_000)
    const {team} = loadE2EAccounts()
    const id = await masked(async () => teamID(team))
    await fromPeople()
    openLink(`keybase://team-page/${team}`)
    await expectTeamPage('the team page the link opened', id)
    await el(T.TEAMS_TABS).waitForExist({timeout: 10_000})
    creditSurface('deep-link')
    await step('The team page link opened the team', {card: true})
  })

  it("a profile link opens the second account's profile", async function () {
    // worst case (s): people 66, link 120, screen 21, the profile 10, step 2 = 219
    this.timeout(240_000)
    const {secondUser} = loadE2EAccounts()
    await fromPeople()
    openLink(`keybase://profile/show/${secondUser}`)
    await expectScreen('the profile the link opened', 'profile', p => p['username'] === secondUser, 20_000)
    await waitForTestID(T.PROFILE_PAGE, 10_000)
    creditSurface('deep-link')
    await step('The profile link opened the second account', {card: true})
  })

  it("a private folder link opens the smoke account's folder with its listing", async function () {
    // worst case (s): listing 60, people 66, link 120, the folder 11, a row 20, step 2 = 279
    this.timeout(300_000)
    const {smokeUser} = loadE2EAccounts()
    // the host lists something there, so a row drawn is the listing loaded
    const listed = await masked(async () => kbfsList(smokeFolder()))
    check(listed.length > 0, "the smoke account's private folder is empty: no row could show its listing loaded")
    await fromPeople()
    openLink(`keybase://private/${smokeUser}`)
    await expectFolder('the folder the link opened', smokeFolder())
    await el(T.FILES_ROW).waitForExist({timeout: 20_000})
    creditSurface('deep-link')
    await step('The folder link opened the private folder', {card: true})
  })

  it('a malformed link opens the link error, and back leaves it', async function () {
    // worst case (s): people 66, link 120, screen 21, the error 10, step 2, back 101, gone 1, step 2
    // = 323
    this.timeout(340_000)
    const {team} = loadE2EAccounts()
    await fromPeople()
    // two channel separators: no channel to open
    openLink(`keybase://chat/${team}#x#y`)
    await expectScreen('the link error', 'keybaseLinkError', () => true, 20_000)
    await el(T.KEYBASE_LINK_ERROR).waitForExist({timeout: 10_000})
    creditSurface('deep-link')
    await step('The malformed link opened the link error', {card: true})

    // pushed onto the People tab, which its back leaves
    await backToScreen('peopleRoot')
    check(!(await el(T.KEYBASE_LINK_ERROR).isExisting()), 'the link error is still drawn back on People')
    // People lists people who are not test accounts
    await step('Back on People', {screenshot: false})
  })

  it('a conversation link launches the app into the conversation', async function () {
    // worst case (s): channel 240, leave 103, step 2, launched 404, signed in 90, cold screen 61, rec
    // 60, step 2 = 962
    this.timeout(1_000_000)
    const {convID} = await newChannel()
    await leaveOnPeople()
    // People lists people who are not test accounts
    await step('On People, saved as the screen the next launch opens', {screenshot: false})

    await launchedBy(() => openLink(`keybase://convid/${convID}`))
    await waitSignedIn()
    await conversationOpened('the conversation the link launched into', convID, 60_000)
    // the new runtime's first recording: up on the conversation as it started, People never shown
    const rec = attemptRecording()
    await rec.checkpoint()
    check(launchedInto(rec.recordings.at(-1), 'chatConversation'), 'the launched app did not come up on the conversation the link named')
    creditSurface('deep-link')
    creditSurface('relaunch')
    await step('The link launched the app into the conversation', {card: true})
  })

  it('a link naming another account opens as a plain link and never switches accounts', async function () {
    // worst case (s): channel 240, people 66, account 1, mark 2, link 120, screen 21, until 12,
    // account 1, step 2 = 465
    this.timeout(500_000)
    const {convID} = await newChannel()
    await fromPeople()
    const before = await appAccount()
    const mark = await appLogMark()
    const url = `keybase://convid/${convID}?uid=${OTHER_UID}`
    openLink(url)
    await conversationOpened('the conversation the link opened', convID)
    // what the app logged from the link up to a marker logged now, so an absence below is read off a
    // window known to have been captured
    const lines = await appLogUntilMarker(mark, 'other-uid')
    const events = deepLinkEvents(lines)
    check(events.length === 1 && events[0] === url, `the app took the link as ${events.length} link events, not one`)
    check(accountLinkLines(lines).length === 0, 'the link started an account switch')
    check(pushTapLinks(lines).length === 0, 'the app took the link as a notification tap')
    const after = await appAccount()
    check(
      after.loggedIn && !after.switching && after.username === before.username,
      'the app is not on the account it was on before the link'
    )
    creditSurface('deep-link')
    await step('The link opened the conversation on the same account', {card: true})
  })
})

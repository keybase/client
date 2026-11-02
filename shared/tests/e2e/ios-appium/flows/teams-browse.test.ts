// The Teams tab on the phone, read-only: the e2e team (KB_E2E_TEAM) found by its exact name in the
// list and opened, each of its tabs, and the smoke account's member page from its members list; the
// new-team wizard's purpose and name screens, backed out of (a team is never made here: a team name
// is permanent); and leaving the Teams tab, which has the app dismiss the tab's badges.
//
// Nothing is written, so nothing needs putting back. The list holds every team of the smoke account,
// the first one included: only the e2e team's row is ever tapped, found by its name. Each team page
// is checked by its route's team id against the host's.
import {loadE2EAccounts} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import * as T from '../../shared/test-ids'
import {teamID as hostTeamID} from '../../shared/teams.ts'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {closeMessageMenu, hideKeyboard} from '../helpers/chat'
import {el} from '../helpers/elements'
import {filesRowNamed} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {cardTitledIn, press} from '../helpers/menus'
import {escapeToTabs, tabTo} from '../helpers/navigate'
import {backToTeamPage, backToTeamsRoot, masked, onlyField, openTeamFromList, openTeamTab, openTeamsRoot, tapTeamsCard} from '../helpers/teams'

// each tab of a team page, and the testID its body carries while it is the tab up; Members last, as
// the member page is opened from it
const TABS: ReadonlyArray<{body: string; button: string; label: string}> = [
  {body: T.TEAMS_CHANNEL_LIST, button: T.TEAMS_TAB_CHANNELS_BUTTON, label: 'Channels'},
  {body: T.TEAMS_EMOJI_TAB, button: T.TEAMS_TAB_EMOJI_BUTTON, label: 'Emoji'},
  {body: T.TEAMS_SETTINGS_TAB, button: T.TEAMS_TAB_SETTINGS_BUTTON, label: 'Settings'},
  {body: T.TEAMS_BOTS_TAB, button: T.TEAMS_TAB_BOTS_BUTTON, label: 'Bots'},
  {body: T.TEAMS_SUBTEAMS_TAB, button: T.TEAMS_TAB_SUBTEAMS_BUTTON, label: 'Subteams'},
  {body: T.TEAMS_MEMBER_LIST, button: T.TEAMS_TAB_MEMBERS_BUTTON, label: 'Members'},
]

describe('teams browse', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      the host's read of a team's id 315 (readBack: up to four reads of 75, whoami 15 and
  //             the call 60, 5s apart)
  //   root      openTeamsRoot 56;  team  openTeamFromList 109;  tab  openTeamTab 24
  //   row       a row by its name 31 (30, one drag 1);  screen  a screen waited for 11 (10, read 1)
  //   button    tapButton 6;  text  textShown 6;  field  onlyField 11;  back  backToTeamPage or
  //             backToTeamsRoot 44
  //   calls     the recorder's call log, one read 2;  waited for  12 (10, one read 2)
  //   tabTo     15 (three taps and 4s waits);  step  2 (its 1s settle and the attach)

  // Nothing to put back: a menu or keyboard left up, and the screen. Worst case (s): close 19,
  // keyboard 5, escape 30 = 54.
  afterEach(async function () {
    this.timeout(60_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, escapeToTabs])
  })

  it("the e2e team opened from its row, each of its tabs, and the smoke account's member page", async function () {
    // worst case (s): host 315, team 109, step 2; six tabs of tab 24 and step 2 = 156; the member
    // row 31, its tap 1, screen 11, the page's marker 10, step 2, back 44 = 99; = 681
    this.timeout(720_000)
    const {smokeUser, team} = loadE2EAccounts()
    const teamID = await masked(async () => hostTeamID(team))
    await openTeamFromList(team, teamID)
    await step('The e2e team page')

    for (const t of TABS) {
      await openTeamTab(t.button, t.body)
      await step(`The ${t.label} tab`)
    }

    // the Members tab is up: the smoke account's row, found by its name, opens its member page
    const row = await filesRowNamed(smokeUser, "the smoke account's member row", {testID: T.TEAMS_MEMBER_ROW})
    await press(row.e, 'the member row')
    await expectScreen("the smoke account's member page", 'teamMember', p => p['teamID'] === teamID && p['username'] === smokeUser)
    await el(T.TEAMS_MEMBER_PAGE).waitForExist({timeout: 10_000})
    await step("The smoke account's member page", {card: true})
    await backToTeamPage('the member page', teamID)
  })

  it("the new-team wizard's purpose and name screens backed out of, then the Teams tab left", async function () {
    // worst case (s): root 56, button 6, screen 11, step 2, the card 6 and its press 2, screen 11, field
    // 11, step 2, back 44; calls 2, tabTo 15, waited for 12, step 2 = 182
    this.timeout(200_000)
    await openTeamsRoot()
    await tapTeamsCard('Create a team', "the Teams tab's Create a team")
    await expectScreen("the new team's purpose screen", 'teamWizard1TeamPurpose')
    await step("The new team's purpose screen")
    // a card: its box merges its title and subtitle
    const friends = await waitFor('the friends purpose', async () => cardTitledIn(['XCUIElementTypeOther'], 'Friends, family, or squad', 'the friends purpose', {forTap: true}), {
      interval: 250,
      timeout: 5_000,
    })
    await press(friends, 'the friends purpose')
    await expectScreen("the new team's name screen", 'teamWizard2TeamInfo', p => (p['wizard'] as {teamType?: string} | undefined)?.teamType === 'friends')
    // the name is never typed and Continue never tapped: the wizard would make a team for good
    await onlyField('TextField', "the new team's name field")
    await step("The new team's name screen")
    await backToTeamsRoot("the new team's wizard")

    // leaving the tab clears its badges
    const seq = await currentCallSeq()
    await tabTo('People', T.PEOPLE_FEED)
    await waitForUiCall("the Teams tab's badges to be dismissed on leaving it", seq, 'keybase.1.gregor.dismissCategory')
    // the People tab it lands on lists people who are not test accounts
    await step('The Teams tab left', {screenshot: false})
  })
})

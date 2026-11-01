// What the phone sends to make, change and delete a subteam and its channels, in three tests that
// each own a subteam of the e2e team: one made through the new-subteam wizard from the e2e team's
// own Subteams tab; one the host makes, where the team's views with a submit button are opened and
// backed out of (Edit team info, the add-members wizard, a channel's edit screen, Add emoji) and a
// channel is made with a description, its name and description edited, and deleted; and one the
// host makes, renamed from its header and deleted from its menu.
//
// The e2e team itself is only read: the wizard is opened from its Subteams tab, so the name it
// makes is fixed under it, and submitted only once the full name the wizard carries and shows is
// this run's stamped one. Every other write is on the test's subteam, and the screen up is checked
// to aim at it (its team id, a channel of it, or its name) before each writing tap. The host stays
// on the smoke account: it makes the subteams the wizard does not, puts a channel in one (a team
// with one channel offers only "Create channels", which takes no description), and reads back what
// the phone did. The flow's afterEach deletes each subteam under every name it had, after a timeout
// too; a deleted team's name is never free again, so each attempt takes fresh names.
import {loadE2EAccounts} from '../../accounts/env'
import {stampedChannelName} from '../../accounts/run-id'
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eMarker, e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {
  conversationInfo,
  freshSubteamPart,
  makeSubteamChannel,
  requireThisRunSubteam,
  subteamExists,
  teamChannels,
  teamID as hostTeamID,
} from '../../shared/teams.ts'
import {elementInRow} from '../gate/chat-lib.ts'
import {labelParts} from '../gate/page-source-lib.ts'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import {retriedNavigation, step} from '../gate/step'
import {closeMessageMenu, hideKeyboard} from '../helpers/chat'
import {el} from '../helpers/elements'
import {buttonLabelled, clickUntil, filesRowNamed, fillField, pressTestID, tapButton} from '../helpers/files'
import {expectScreen, visibleScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, onScreen, openMenuFrom} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {
  backToTeamPage,
  drainMade,
  expectHost,
  expectTeamPage,
  makeOwnSubteam,
  masked,
  onlyField,
  openTeamFromList,
  openTeamTab,
  requireOnSubteam,
  revealTeamHeader,
  tapHeaderAction,
  tapHeaderAddInvite,
  textPartShown,
  textShown,
} from '../helpers/teams'

// the new-team wizard's id for the team it is making, before there is one
const newTeamWizardTeamID = 'NewTeamWizardTeam'

type NewTeamWizard = {name?: string; parentTeamID?: string; teamType?: string}
const wizardOf = (p: Record<string, unknown>) => (p['wizard'] ?? {}) as NewTeamWizard & {newTeamWizard?: NewTeamWizard; teamID?: string}

describe('teams subteams', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      a retried host read (readBack: up to four reads 5s apart): of the main service 315
  //             (four of 75, whoami 15 and the call 60), of the CLI 255 (four of 60);  polled  30s of
  //             reads, overrun by one read
  //   seed      makeSubteamChannel 510 (the CLI's create, four tries of 60, 255, and its listing 255)
  //   team      openTeamFromList 109;  page  expectTeamPage 21;  tab  openTeamTab 24;  header
  //             revealTeamHeader 8
  //   screen    a screen waited for 11 (10, read 1);  pin  requireOnSubteam 1
  //   button    tapButton 6;  action  tapHeaderAction 8;  text  textShown 6 (11 with a
  //             10s wait)
  //   field     onlyField 11;  fill  fillField 26 (the field 10, the typing 15, the read 1)
  //   row       a row by its name 31 (30, one drag 1);  in row  elementInRow 2
  //   menu      openMenuFrom 19 (15, overrun by one try: the tap 1, the sheet 3);  item
  //             chooseMenuItem 22 (15, overrun by one drag 1, the tap 1, the sheet gone 5)
  //   back      backToTeamPage 39;  calls  one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach)

  // -- what the afterEach puts back ---------------------------------------------------------------

  // every name a subteam this test made had: the one it was made under and the one it was renamed to,
  // each added before the tap that gives it
  const madeNames = new Set<string>()

  // Bound: 750 a name (deleteSubteamIfPresent: an existence read 315, the delete 90, 30s of reads
  // overrun by one 315).
  const deleteMade = async () => drainMade(madeNames)

  // Worst case (s): close 19, keyboard 5, two names 1500, escape 30 = 1554.
  afterEach(async function () {
    this.timeout(1_600_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, deleteMade, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  const channelRow = async (channel: string, what: string) => filesRowNamed(`#${channel}`, what, {testID: T.TEAMS_CHANNEL_ROW})

  // The channel rows drawn, by the label parts each reads.
  const drawnChannelRows = async () => {
    const out: Array<Array<string>> = []
    for (const e of await browser.$$(`~${T.TEAMS_CHANNEL_ROW}`).getElements()) {
      if (!(await onScreen(e))) continue
      out.push(labelParts((await e.getAttribute('label').catch(() => null)) ?? ''))
    }
    return out
  }

  it('a subteam made with the wizard from the e2e team', async function () {
    // worst case (s): host 315 (the e2e team's id), team 109, tab 24, its read 1, button 6, screen
    // 11, fill 26, step 2, the Continue enabled 11 (10, one read 1), clickUntil 10, screen 11, step 2,
    // action 8, screen 11, action 8, screen 11, text 6, step 2, calls 2, action 8, waited for 12,
    // polled 345, host 315 (its id), page 21, step 2 = 1279
    this.timeout(1_300_000)
    const {team} = loadE2EAccounts()
    const name = `${team}.${freshSubteamPart('sub')}`
    const part = requireThisRunSubteam(name)

    // -- the wizard, from the e2e team's own Subteams tab --------------------------------------------
    const parentID = await masked(async () => hostTeamID(team))
    await openTeamFromList(team, parentID)
    await openTeamTab(T.TEAMS_TAB_SUBTEAMS_BUTTON, T.TEAMS_SUBTEAMS_TAB)
    // the wizard is opened only from the e2e team's own page
    const up = await visibleScreen()
    check(up?.name === 'team' && up.params?.['teamID'] === parentID, "the Subteams tab up is not the e2e team's: not tapping")
    await tapButton('Create subteam', "the Subteams tab's Create subteam")
    await expectScreen('the new-subteam wizard under the e2e team', 'teamWizard2TeamInfo', p => {
      const w = wizardOf(p)
      return w.teamType === 'subteam' && w.parentTeamID === parentID
    })
    // the wizard's modal reports its elements visible=false now and then: the one field so placeheld
    await fillField(() => browser.$('-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue == "subteam"'), part, "the subteam's name field")
    await step("The subteam's name")
    const next = await waitFor(
      "the wizard's Continue to be enabled",
      async () => {
        const b = await buttonLabelled('Continue', "the wizard's Continue")
        return (await b.isEnabled()) ? b : undefined
      },
      {interval: 250, timeout: 10_000}
    )
    await clickUntil(async () => Promise.resolve(next), async () => (await visibleScreen())?.name === 'profileEditAvatar', "the wizard's Continue")
    // the avatar step: no picture picked, skipped
    await expectScreen("the new subteam's avatar step", 'profileEditAvatar', p => {
      const w = (p['newTeamWizard'] ?? {}) as NewTeamWizard
      return p['wizard'] === true && w.name === name && w.parentTeamID === parentID
    })
    await step("The new subteam's avatar step")
    await tapHeaderAction('Skip', "the avatar step's Skip")
    // the e2e team's members to bring along (it has more than the smoke account): none
    await expectScreen("the new subteam's members step", 'teamWizardSubteamMembers', p => wizardOf(p).name === name)
    await tapHeaderAction('Skip', "the members step's Skip")
    // where its first members come from: skipped, which makes the subteam. The full name the wizard
    // carries and the one it shows are this run's, checked before the tap
    await expectScreen("the new subteam's where-from step", 'teamAddToTeamFromWhere', p => {
      const w = wizardOf(p)
      return w.teamID === newTeamWizardTeamID && w.newTeamWizard?.name === name && w.newTeamWizard.parentTeamID === parentID
    })
    await textShown(name, 'the name the wizard will make')
    requireThisRunSubteam(name)
    await step('About to make the subteam')
    madeNames.add(name)
    const seq = await currentCallSeq()
    await tapHeaderAction('Skip', "the where-from step's Skip")
    await waitForUiCall('the subteam to be made', seq, 'keybase.1.teams.teamCreateFancy')
    await expectHost('the subteam made', async () => subteamExists(name), e => e)
    const teamID = await masked(async () => hostTeamID(name))
    // the wizard ends on the new subteam's page
    await expectTeamPage("the new subteam's page", teamID)
    await step('The subteam made', {card: true})
  })

  it("a subteam's views opened and backed out of, and a channel made, edited and deleted", async function () {
    // worst case (s):
    // setup: subteam 600, host 315 (its id), seed 510, listed 204 (60s of tries, overrun by one: team
    //   109, tab 24, the row 11), step 2 = 1631;
    // views: pin 1, header 8, button 6, screen 11, button 6, step 2, back 44 = 78 (Edit team
    //   info); pin 1, header 8, button 6, screen 11, text 6, step 2, back 44 = 78 (the add-members
    //   wizard); tab 24, row 31, in row 2 and its tap 1, screen 11, field 11 and its read 1, step 2,
    //   back 44 = 127 (a channel's edit screen); tab 24, button 6, screen 11, text 6, step 2, back 44
    //   = 93 (Add emoji); = 376;
    // create: tab 24, button 6, screen 11, field 11, fill 26, field 11, fill 26, step 2, pin 1,
    //   calls 2, clickUntil 10, waited for 12, page 21, polled 285, host 255, polled 345, row 31,
    //   step 2 = 1081;
    // edit: row 31, in row 2 and its tap 1, screen 11, field 11 and its read 1, fill 26, field 11,
    //   fill 26, step 2, pin 1, calls 2, clickUntil 10, waited for 12 twice, page 21, polled 345,
    //   host 255, row 31, step 2 = 813;
    // delete: row 31, in row 2, menu 19, item 22, screen 11, text 6, step 2, pin 1, calls 2, button
    //   6, waited for 12, page 21, polled 285, the rows read 22 (20, one read 2), step 2 = 444
    // = 1631 + 376 + 1081 + 813 + 444 = 4345
    this.timeout(4_400_000)
    const runId = e2eRunId()
    const {name} = await makeOwnSubteam('chn', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    const seed = stampedChannelName('seed', runId)
    const seedConvID = await masked(async () => makeSubteamChannel(name, seed))
    // the app shows the host's subteam and its channels once it has loaded them afresh: the page is
    // opened from the Teams tab until its Channels tab lists the seeded channel
    await retriedNavigation(
      "the subteam's page listing the host-made channel",
      async () => {
        await openTeamFromList(name, teamID)
        await openTeamTab(T.TEAMS_TAB_CHANNELS_BUTTON, T.TEAMS_CHANNEL_LIST)
        await filesRowNamed(`#${seed}`, "the host-made channel's row", {testID: T.TEAMS_CHANNEL_ROW, timeout: 10_000})
      },
      {intervals: [2_000], timeout: 60_000}
    )
    await step("The subteam's page", {card: true})

    const onSubteam = (p: Record<string, unknown>) => p['teamID'] === teamID

    // -- its views, opened and backed out of ---------------------------------------------------------
    await requireOnSubteam("the subteam's page", 'team', onSubteam)
    await revealTeamHeader()
    await tapButton('Edit', "the header's Edit")
    await expectScreen("the subteam's Edit team info", 'teamEditTeamInfo', onSubteam)
    // a disabled Save is drawn as its text alone
    await textShown('Save', "Edit team info's Save")
    await step('Edit team info')
    await backToTeamPage('Edit team info', teamID)

    await requireOnSubteam("the subteam's page", 'team', onSubteam)
    await revealTeamHeader()
    await tapHeaderAddInvite()
    await expectScreen("the subteam's add-members wizard", 'teamAddToTeamFromWhere', p => wizardOf(p).teamID === teamID)
    await textPartShown('A list of email addresses', "the wizard's email list choice")
    await step('The add-members wizard')
    await backToTeamPage('the add-members wizard', teamID)

    await openTeamTab(T.TEAMS_TAB_CHANNELS_BUTTON, T.TEAMS_CHANNEL_LIST)
    const seedRow = await channelRow(seed, "the host-made channel's row")
    await (await elementInRow(seedRow.rect, T.TEAMS_CHANNEL_ROW_EDIT)).click()
    await expectScreen("the host-made channel's edit screen", 'teamEditChannel', p => onSubteam(p) && p['conversationIDKey'] === seedConvID)
    check((await (await onlyField('TextField', "the channel's name field"))().getAttribute('value')) === seed, 'the edit screen is not for the channel tapped')
    await step("A channel's edit screen")
    await backToTeamPage("the channel's edit screen", teamID)

    await openTeamTab(T.TEAMS_TAB_EMOJI_BUTTON, T.TEAMS_EMOJI_TAB)
    await tapButton('Add emoji', "the Emoji tab's Add emoji")
    await expectScreen("the subteam's Add emoji", 'teamAddEmoji', onSubteam)
    // its Choose Images opens the photo picker: never tapped here
    await textPartShown('Choose images from your library', "Add emoji's prompt")
    await step('Add emoji')
    await backToTeamPage('Add emoji', teamID)

    // -- a channel made with a description ----------------------------------------------------------
    const channel = stampedChannelName('made', runId)
    // the field takes sentence capitals and corrections: a capital first word, and the stamp last
    const description = `Topic ${e2eMarker('topic')}`
    await openTeamTab(T.TEAMS_TAB_CHANNELS_BUTTON, T.TEAMS_CHANNEL_LIST)
    await tapButton('Create channel', "the Channels tab's Create channel")
    await expectScreen("the subteam's new channel screen", 'chatCreateChannel', onSubteam)
    await fillField(await onlyField('TextField', "the new channel's name field"), channel, "the new channel's name field")
    await fillField(await onlyField('TextView', "the new channel's description field"), description, "the new channel's description field")
    await step('The new channel typed')
    await requireOnSubteam('the new channel', 'chatCreateChannel', onSubteam)
    let seq = await currentCallSeq()
    await clickUntil(
      async () => buttonLabelled('Save', "the new channel's Save"),
      async () => (await uiCallsSince(seq, 'chat.1.local.newConversationLocal')).length > 0,
      "the new channel's Save"
    )
    await waitForUiCall("the channel's description to go out", seq, 'chat.1.local.postHeadlineNonblock')
    await expectTeamPage('the subteam page after the new channel', teamID)
    await expectHost('the new channel', async () => (await teamChannels(name)).has(channel), has => has)
    const convID = (await masked(async () => teamChannels(name))).get(channel) ?? ''
    await expectHost("the new channel's description", async () => (await conversationInfo(convID)).headline, h => h === description)
    await channelRow(channel, "the new channel's row")
    await step('The channel made', {card: true})

    // -- its name and description edited -----------------------------------------------------------
    // the edit screen's name field takes 16 characters: a label of up to 5
    const channelRenamed = stampedChannelName('after', runId)
    const edited = `Edited ${e2eMarker('edit')}`
    const madeRow = await channelRow(channel, "the new channel's row")
    await (await elementInRow(madeRow.rect, T.TEAMS_CHANNEL_ROW_EDIT)).click()
    const onChannel = (p: Record<string, unknown>) => onSubteam(p) && p['conversationIDKey'] === convID
    await expectScreen("the new channel's edit screen", 'teamEditChannel', onChannel)
    const nameField = await onlyField('TextField', "the channel's name field")
    check((await nameField().getAttribute('value')) === channel, 'the edit screen is not for the channel tapped')
    await fillField(nameField, channelRenamed, "the channel's name field")
    await fillField(await onlyField('TextView', "the channel's description field"), edited, "the channel's description field")
    await step('The channel edited')
    await requireOnSubteam("the channel's edit", 'teamEditChannel', onChannel)
    seq = await currentCallSeq()
    await clickUntil(
      async () => buttonLabelled('Save', "the edit screen's Save"),
      async () => (await uiCallsSince(seq, 'chat.1.local.postMetadata')).length > 0,
      "the edit screen's Save"
    )
    await waitForUiCall("the channel's new name to go out", seq, 'chat.1.local.postMetadata')
    await waitForUiCall("the channel's new description to go out", seq, 'chat.1.local.postHeadline')
    await expectTeamPage('the subteam page after the edit', teamID)
    await expectHost(
      'the channel under its new name and description',
      async () => conversationInfo(convID),
      i => i.topicName === channelRenamed && i.headline === edited
    )
    check((await masked(async () => teamChannels(name))).get(channelRenamed) === convID, 'the CLI does not list the channel under its new name')
    await channelRow(channelRenamed, "the edited channel's row")
    await step('The channel renamed')

    // -- the channel deleted ------------------------------------------------------------------------
    const editedRow = await channelRow(channelRenamed, "the edited channel's row")
    const rowMenu = await elementInRow(editedRow.rect, T.TEAMS_CHANNEL_ROW_MENU)
    await openMenuFrom("the channel row's menu", async () => rowMenu.click())
    await chooseMenuItem('Delete channel')
    await expectScreen("the channel's delete confirm", 'teamDeleteChannel', onChannel)
    await textShown(`Delete #${channelRenamed}?`, 'the delete prompt for the channel')
    await step("The channel's delete confirm")
    await requireOnSubteam("the channel's delete", 'teamDeleteChannel', onChannel)
    seq = await currentCallSeq()
    await tapButton('Delete channel', "the confirm's Delete channel")
    await waitForUiCall('the channel delete to go out', seq, 'chat.1.local.deleteConversationLocal')
    await expectTeamPage('the subteam page after the delete', teamID)
    // the same listing still holds general and the host-made channel
    await expectHost(
      'the channel gone',
      async () => teamChannels(name),
      c => !c.has(channelRenamed) && c.has('general') && c.get(seed) === seedConvID
    )
    await waitFor(
      'the channel row to go, with #general still drawn',
      async () => {
        const rows = await drawnChannelRows()
        return rows.some(r => r.includes('#general')) && !rows.some(r => r.includes(`#${channelRenamed}`)) ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    await step('The channel deleted')

  })

  it('a subteam renamed from its header and deleted from its menu', async function () {
    // worst case (s):
    // setup: subteam 600, host 315 (its id), opened 169 (60s of tries, overrun by one: team 109),
    //   step 2 = 1086;
    // rename: header 8, the icon 10 and its tap 1, screen 11, field 11, fill 26, text 6, step 2,
    //   pin 1, calls 2, clickUntil 10, page 21, polled 660 (30s of two reads of 315, overrun by one
    //   pair), step 2 = 771;
    // delete: header 8, menu 19, item 22, screen 11, text 11, three taps 3, the button enabled 6,
    //   step 2, pin 1, calls 2, its tap 1, waited for 12, the Teams tab's root 21, polled 345,
    //   step 2 = 466
    // = 1086 + 771 + 466 = 2323
    this.timeout(2_400_000)
    const {team} = loadE2EAccounts()
    const {name} = await makeOwnSubteam('rnd', madeNames)
    const renamed = `${team}.${freshSubteamPart('ren')}`
    const renamedPart = requireThisRunSubteam(renamed)
    const teamID = await masked(async () => hostTeamID(name))
    // the Teams tab lists the host's subteam once the app has heard of it
    await retriedNavigation("the subteam's page", async () => openTeamFromList(name, teamID), {intervals: [2_000], timeout: 60_000})
    await step("The subteam's page", {card: true})
    const onSubteam = (p: Record<string, unknown>) => p['teamID'] === teamID

    // -- the subteam renamed from its header ----------------------------------------------------------
    await revealTeamHeader()
    await el(T.TEAMS_HEADER_RENAME).waitForExist({timeout: 10_000})
    await pressTestID(T.TEAMS_HEADER_RENAME, "the header's rename")
    const onName = (p: Record<string, unknown>) => p['teamname'] === name
    await expectScreen("the subteam's rename", 'teamRename', onName)
    await fillField(await onlyField('TextField', "the subteam's new name field"), renamedPart, "the subteam's new name field")
    await textShown(`This team will be named ${renamed}`, 'the name the rename will give')
    await step('The rename typed')
    await requireOnSubteam('the rename', 'teamRename', onName)
    requireThisRunSubteam(renamed)
    madeNames.add(renamed)
    let seq = await currentCallSeq()
    await clickUntil(
      async () => buttonLabelled('Rename', "the rename's Rename"),
      async () => (await uiCallsSince(seq, 'keybase.1.teams.teamRename')).length > 0,
      "the rename's Rename"
    )
    await expectTeamPage('the subteam page after the rename', teamID)
    await expectHost('the subteam under its new name alone', async () => (await subteamExists(renamed)) && !(await subteamExists(name)), e => e)
    await step('The subteam renamed')

    // -- the subteam deleted from its menu ------------------------------------------------------------
    await revealTeamHeader()
    await openMenuFrom("the subteam's menu", async () => pressTestID(T.TEAMS_HEADER_MENU_BUTTON, "the subteam's menu button"))
    await chooseMenuItem('Delete team')
    await expectScreen("the subteam's delete confirm", 'teamDeleteTeam', onSubteam)
    // the confirm names the team once its info is in
    await textShown(`Delete ${renamed}?`, 'the delete prompt for the subteam', 10_000)
    for (const id of [T.TEAMS_DELETE_TEAM_CHATS_CHECK, T.TEAMS_DELETE_TEAM_FOLDER_CHECK, T.TEAMS_DELETE_TEAM_NOTIFY_CHECK]) {
      await el(id).click()
    }
    // enabled only once all three are agreed to
    const remove = await waitFor(
      "the confirm's Delete team to be enabled",
      async () => {
        const b = await buttonLabelled('Delete team', "the confirm's Delete team")
        return (await b.isEnabled()) ? b : undefined
      },
      {interval: 250, timeout: 5_000}
    )
    await step("The subteam's delete confirm")
    await requireOnSubteam("the subteam's delete", 'teamDeleteTeam', onSubteam)
    requireThisRunSubteam(renamed)
    seq = await currentCallSeq()
    await remove.click()
    await waitForUiCall('the subteam delete to go out', seq, 'keybase.1.teams.teamDelete')
    // the app closes the confirm and the subteam's page itself
    await expectScreen("the Teams tab's root after the delete", 'teamsRoot', () => true, 20_000)
    await expectHost('the subteam gone', async () => subteamExists(renamed), e => !e)
    await step('The subteam deleted')
  })
})

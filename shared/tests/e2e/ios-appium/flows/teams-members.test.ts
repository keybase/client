// What the phone sends to change a subteam's members and invites, from the smoke account's side, in
// tests that each own a subteam of the e2e team: the second account added from its profile's "Add
// to team..." with the subteam alone picked; added through the add-members wizard as a reader; its
// role changed on its member page; added to two channels from its member page and removed from one
// from the channel's page; removed from the subteam from the selection popup and, once the host has
// put it back, from its row's menu; an email invite to this run's example.com address sent through
// the wizard and cancelled from its row; and a request to join, made by the second account's own
// peer, denied from its row.
//
// The second account is the only one ever added, and "Block" is never tapped. Every write is on the
// test's subteam, and the screen up is checked to aim at it (its team id, a conversation of it, the
// second account, or the subteam alone picked) before each writing tap. The host stays on the smoke
// account: it makes the subteams and their channels, adds the second account where a test starts
// from it being in, and reads back what the phone did; the second account's request comes from its
// peer. The flow's afterEach takes the second account out of each subteam, cancels a leftover
// invite, deletes the subteam (after a timeout too; a deleted team's name is never free again, so
// each attempt takes a fresh one), then reads on the second account's peer that it is in none of
// this run's subteams.
import {loadE2EAccounts, loadE2EEnv} from '../../accounts/env'
import {stampedChannelName} from '../../accounts/run-id'
import {retryTransient} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {ensurePeer, runKeybase} from '../../shared/peer-service'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {
  addToSubteamFromCli,
  channelMembers,
  deleteSubteamIfPresent,
  inviteNames,
  makeSubteamChannel,
  readBack,
  requireThisRunSubteam,
  subteamExists,
  teamChannels,
  teamID as hostTeamID,
} from '../../shared/teams.ts'
import {jsEval} from '../gate/app-ask.ts'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {requireSecondNotBlocked} from '../gate/blocks'
import {labelHas, labelParts} from '../gate/page-source-lib.ts'
import {elementInRow, type Rect} from '../gate/chat-lib.ts'
import {openLink} from '../gate/device'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import type {CallMark} from '../gate/recorder-lib'
import {retriedNavigation, step} from '../gate/step'
import {pickState} from '../gate/team-pick-lib.ts'
import {closeMessageMenu, hideKeyboard} from '../helpers/chat'
import {el} from '../helpers/elements'
import {buttonLabelled, clickUntil, filesRowNamed, fillField, pressTestID, tapButton, typeInFilter} from '../helpers/files'
import {expectScreen, visibleScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {BUTTON_ELEMENTS, check, chooseMenuItem, elementWithLabelPart, onScreenID, openMenuFrom, press} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {
  backToTeamPage,
  drainMade,
  expectHost,
  expectTeamPage,
  makeOwnSubteam,
  masked,
  onlyField,
  openSubteamUntil,
  openTeamFromList,
  openTeamTab,
  pickRole,
  removeSecond,
  requireOnSubteam,
  revealTeamHeader,
  secondInNoSubteam,
  secondRoleIn,
  shownInside,
  tapHeaderAction,
  tapHeaderAddInvite,
  textPartShown,
  TEXTS,
  textShown,
} from '../helpers/teams'

type Params = Record<string, unknown>
type AddingMember = {assertion: string; resolvedFrom?: string; role: string}
type AddMembersWizard = {addingMembers?: Array<AddingMember>; role?: string; teamID?: string}
const wizardOf = (p: Params) => (p['wizard'] ?? {}) as AddMembersWizard

const MEMBERS = {body: T.TEAMS_MEMBER_LIST, button: T.TEAMS_TAB_MEMBERS_BUTTON}
const CHANNELS = {body: T.TEAMS_CHANNEL_LIST, button: T.TEAMS_TAB_CHANNELS_BUTTON}

describe('teams members', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      a retried host read (readBack: up to four reads 5s apart): of the main service 315
  //             (four of 75, whoami 15 and the call 60), of the CLI 255 (four of 60);  polled  30s of
  //             reads, overrun by one read: of the CLI 285, of the main service 345
  //   subteam   makeOwnSubteam 600;  add  addToSubteamFromCli 255;  seed  makeSubteamChannel 510
  //   peer      the second account's peer found 45 and a failing call's diagnosis 25 = 70;  peer
  //             call  one CLI call on it 60
  //   opened    openSubteamUntil: 60s of tries, overrun by one (team 109, tab 24, a row 11) = 204
  //   team      openTeamFromList 109;  page  expectTeamPage 21;  tab  openTeamTab 24;  header
  //             revealTeamHeader 8
  //   screen    a screen waited for 11 (10, read 1);  pin  requireOnSubteam 1
  //   button    tapButton 6;  action  tapHeaderAction 8;  text  textShown 6;  part  a label part
  //             waited for 6 (5, read 1)
  //   field     onlyField 11;  fill  fillField 26 (the field 10, the typing 15, the read 1)
  //   row       a row by its name 31 (30, one drag 1);  in row  elementInRow 2
  //   menu      openMenuFrom 19 (15, overrun by one try: the tap 1, the sheet 3);  item
  //             chooseMenuItem 22 (15, overrun by one drag 1, the tap 1, the sheet gone 5)
  //   role      pickRole 35 and its pin 1 = 36
  //   back      backToTeamPage 39;  calls  one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach)

  before(async function () {
    // only the second account is ever added: a failed chat-blocks restore refuses here. The host
    // read 75s.
    this.timeout(90_000)
    await requireSecondNotBlocked()
  })

  // -- what the afterEach puts back ---------------------------------------------------------------

  // every subteam a test made, added before its make
  const madeNames = new Set<string>()
  // the address of this run's email invite, set before the tap that sends it
  let invitedEmail: string | undefined

  // Cancels this run's email invite to a subteam of this run while it is pending, through the CLI.
  // Bound: its invites 255, the cancel 255 = 510.
  const cancelInvite = async (name: string, email: string) => {
    if (!(await inviteNames(name)).includes(email)) return
    requireThisRunSubteam(name)
    await retryTransient(
      async () => runKeybase(['team', 'remove-member', name, `--email=${email}`, '--force'], {timeoutMs: 60_000}),
      /not a member|not found/i
    )
  }

  // Bound: 2085 a name (exists 315, removeSecond 510, cancelInvite 510, deleteSubteamIfPresent 750:
  // an existence read 315, the delete 90, 30s of reads overrun by one 315).
  const restoreName = async (name: string, email: string | undefined) => {
    if (await subteamExists(name)) {
      await removeSecond(name)
      if (email) await cancelInvite(name, email)
    }
    await deleteSubteamIfPresent(name)
  }
  const restoreMade = async () => {
    const email = invitedEmail
    await drainMade(madeNames, async name => restoreName(name, email))
    invitedEmail = undefined
  }

  // Worst case (s): close 19, keyboard 5, the one name of a test 2085, the memberships 160, escape 30
  // = 2299.
  afterEach(async function () {
    this.timeout(2_400_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, restoreMade, secondInNoSubteam, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  const secondOut = (r: Awaited<ReturnType<typeof secondRoleIn>>) => r.anchored && r.second === 'none'

  // The usernames with a request to join a subteam, read through the CLI. Bound: 255.
  const requesters = async (name: string) => {
    const out = await readBack(async () => runKeybase(['team', 'list-requests', '--team', name, '-j'], {timeoutMs: 60_000}))
    return ((JSON.parse(out || '[]') as Array<{username: string}> | null) ?? []).map(r => r.username)
  }

  // A row in the Members tab by its exact name. Bound: `timeout`, one drag 1.
  const memberRow = async (username: string, what: string, timeout = 30_000) =>
    filesRowNamed(username, what, {testID: T.TEAMS_MEMBER_ROW, timeout})

  // Checks the member row at `rowRect` and returns the selection popup's rect. A tap on the check
  // that did not take (seen live: the circle stayed empty and no popup came) is tried once more,
  // only while no popup shows, so a check that took is never unchecked. Bound: two of (the check in
  // the row 2, its press 2, 5s of reads 6), the popup's read 1 = 21.
  const checkRowForPopup = async (rowRect: Rect, what: string): Promise<Rect> => {
    const popupUp = async () =>
      waitFor('the selection popup', async () => ((await onScreenID(T.TEAMS_SELECTION_POPUP)) ? true : undefined), {interval: 250, timeout: 5_000}).then(
        () => true,
        (e: unknown) => {
          if (isAttemptOver(e)) throw e
          return false
        }
      )
    for (let i = 0; ; i++) {
      await press(await elementInRow(rowRect, T.TEAMS_MEMBER_CHECK), what)
      if (await popupUp()) break
      if (i === 1) throw new Error(`two taps on ${what} brought no selection popup`)
    }
    const popup = await el(T.TEAMS_SELECTION_POPUP).getElement()
    return {...(await popup.getLocation()), ...(await popup.getSize())}
  }

  // The rows drawn with any of `testIDs`, each by its testID and the label parts it reads, for an
  // absence read that sees in the same read a row that must be there. Bound: one read 1.
  const drawnRows = async (testIDs: ReadonlyArray<string>) => {
    const out: Array<{parts: Array<string>; testID: string}> = []
    const selector = `-ios predicate string:(${testIDs.map(id => `name == ${JSON.stringify(id)}`).join(' OR ')}) AND visible == 1`
    for (const e of await browser.$$(selector).getElements()) {
      const testID = (await e.getAttribute('name').catch(() => null)) ?? ''
      out.push({parts: labelParts((await e.getAttribute('label').catch(() => null)) ?? ''), testID})
    }
    return out
  }
  const drawn = (rows: Awaited<ReturnType<typeof drawnRows>>, testID: string, part: string) =>
    rows.some(r => r.testID === testID && r.parts.includes(part))

  // On the second account's member page, the subteam's own row expanded (the page lists every team
  // of the tree the account is in, the e2e team too, so all of it is looked for inside this row).
  // Bound: the row 31, its caret 2 and tap 1, the expanded row 31, its activity line 12 (10, one read
  // 2), the row read again 31 = 108.
  const expandSubteamRow = async (name: string) => {
    requireThisRunSubteam(name)
    const row = await filesRowNamed(name, "the subteam's row on the member page", {testID: T.TEAMS_MEMBER_TEAM_ROW})
    await (await elementInRow(row.rect, T.TEAMS_MEMBER_TEAM_EXPAND)).click()
    const expanded = await filesRowNamed(name, "the subteam's expanded row", {testID: T.TEAMS_MEMBER_TEAM_ROW})
    await waitFor("the subteam's row to expand", async () => elementInRow(expanded.rect, T.TEAMS_MEMBER_TEAM_ACTIVITY), {
      interval: 250,
      timeout: 10_000,
    })
    return filesRowNamed(name, "the subteam's expanded row", {testID: T.TEAMS_MEMBER_TEAM_ROW})
  }

  // The second account's member page in a subteam, from its row in the Members tab (which is up).
  // Bound: the row 31, its tap 1, screen 11, the page's marker 10 = 53.
  const openSecondsMemberPage = async (teamID: string) => {
    const {secondUser} = loadE2EAccounts()
    const row = await memberRow(secondUser, "the second account's member row")
    await press(row.e, 'the row')
    await expectScreen("the second account's member page", 'teamMember', p => p['teamID'] === teamID && p['username'] === secondUser)
    await el(T.TEAMS_MEMBER_PAGE).waitForExist({timeout: 10_000})
  }

  it('the second account added to a subteam from its profile, with the subteam alone picked', async function () {
    // worst case (s): subteam 600, host 315 (its id), host 255 (its roles), the Teams tab listing it
    // 169 (60s of tries, overrun by one: team 109), escapeToTabs 30, the link 1, screen 21, the menu
    // button 31, menu 19, item 22, screen 11, row 34 (30, four drags), its press 2, the picks read 6
    // (5, one read 1), step 2, screen 1 and the picks 1, calls 2, button 6, waited for 12, its count
    // 2, polled 285, screen 11, step 2 = 1840
    this.timeout(1_900_000)
    const {secondUser} = loadE2EAccounts()
    const {name} = await makeOwnSubteam('prf', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    check((await masked(async () => secondRoleIn(name))).second === 'none', 'the second account is already in the new subteam')
    // the picker finds a picked team's id in the app's teams list, which hears of a subteam the host
    // made once it loads again: the Teams tab lists the subteam before the profile is opened
    await retriedNavigation("the subteam's page", async () => openTeamFromList(name, teamID), {intervals: [2_000], timeout: 60_000})

    await escapeToTabs()
    openLink(`keybase://profile/show/${secondUser}`)
    const onSecond = (p: Params) => p['username'] === secondUser
    await expectScreen("the second account's profile", 'profile', onSecond, 20_000)
    // the actions show once the profile's identify is done
    await el(T.PROFILE_ACTIONS_MENU).waitForExist({timeout: 30_000})
    await openMenuFrom("the profile's menu", async () => pressTestID(T.PROFILE_ACTIONS_MENU, "the profile's menu button"))
    await chooseMenuItem('Add to team...')
    await expectScreen("the profile's Add to team", 'profileAddToTeam', onSecond)
    const row = await filesRowNamed(name, "the subteam's row among the teams", {inTree: true, testID: T.PROFILE_ADD_TO_TEAM_ROW})
    await press(row.e, 'the row')

    // The picked rows, by the label parts each reads; the list is not virtualized, so a row scrolled
    // out of sight counts too. The smoke account is in teams that are not the tests' to change.
    const picked = async () => {
      const out: Array<Array<string>> = []
      for (const e of await browser.$$(`~${T.PROFILE_ADD_TO_TEAM_ROW_CHECKED}`).getElements()) {
        out.push(labelParts((await e.getAttribute('label').catch(() => null)) ?? ''))
      }
      return out
    }
    const subteamAlone = async () => {
      const rows = await picked()
      return rows.length === 1 && rows[0]!.includes(name)
    }
    await waitFor('the subteam alone to be picked', async () => ((await subteamAlone()) ? true : undefined), {interval: 250, timeout: 5_000})
    // the picker lists the smoke account's other teams
    await step('The subteam alone picked', {screenshot: false})
    await requireOnSubteam("the profile's Add to team", 'profileAddToTeam', onSecond)
    check(await subteamAlone(), 'a team other than the subteam is picked: not tapping')
    const seq = await currentCallSeq()
    await tapButton('Add to team', "the picker's Add to team")
    await waitForUiCall('the add to go out', seq, 'keybase.1.teams.teamAddMember')
    check((await uiCallsSince(seq, 'keybase.1.teams.teamAddMember')).length === 1, 'the picker sent an add for more than one team')
    await expectHost("the second account's role after Add to team", async () => secondRoleIn(name), r => r.second === 'writer')
    // the picker closes back to the profile
    await expectScreen('the profile after the add', 'profile', onSecond)
    await step('The second account added', {card: true})
  })

  it('the second account added through the add-members wizard as a reader', async function () {
    // worst case (s): subteam 600, host 315 (its id), opened 204, pin 1, header 8, button 6, screen
    // 11, part 6 and its tap 1, screen 11, typeInFilter 32, the pick 130 (a store read 24: 10s of tries
    // on a dropped inspector, overrun by one of page lookup 3, eval 10 and its pause 1; then two taps,
    // each a row, its press 2 and 3s of store reads overrun by a pause 1 and one read 24 = 28: the
    // first row 16 (15, one drag 1), the second 6 (5, one drag 1) and a read 24 before it), step 2,
    // action 8, screen 11, the dropdown 10 and its tap 1, role 36, screen 11, step 2, pin 1, calls 2,
    // button 6, waited for 12, page 21, polled 285, row 31, step 2 = 1766
    this.timeout(1_800_000)
    const {secondUser, smokeUser} = loadE2EAccounts()
    const {name} = await makeOwnSubteam('wiz', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    await openSubteamUntil("the subteam's members", name, teamID, MEMBERS, async () =>
      memberRow(smokeUser, "the smoke account's member row", 10_000)
    )
    const onSubteam = (p: Params) => p['teamID'] === teamID

    await requireOnSubteam("the subteam's page", 'team', onSubteam)
    await revealTeamHeader()
    await tapHeaderAddInvite()
    await expectScreen("the subteam's add-members wizard", 'teamAddToTeamFromWhere', p => wizardOf(p).teamID === teamID)
    await press(await textPartShown('From Keybase', "the wizard's From Keybase", 5_000, {forTap: true}), "the wizard's From Keybase")
    await expectScreen("the subteam's people search", 'teamsTeamBuilder', p => onSubteam(p) && p['namespace'] === 'teams')
    // the search is a SearchFilter: its field is not in the tree
    await typeInFilter(secondUser, "the people search's field")
    // A tap on the row can land and pick nothing (seen live: the keyboard stayed up, the row stayed
    // unpicked, so the header's Add never came), so a second tap may follow. A tap on a picked row
    // removes the pick, and a pick clears the search (the old row goes, recommendations come): the
    // store is read before every tap, and the row found afresh for each. Its usernames are compared
    // here, so no name goes into the eval; a failed read throws.
    const pick = async () => {
      const users = await jsEval<Array<string> | null>(
        `const s = kbModule('stores/team-building.tsx').TBstores.get('teams'); return s ? [...s.getState().teamSoFar].map(u => u.username) : null`
      )
      if (!users) throw new Error("the people search's store is not there")
      return pickState(users, secondUser)
    }
    let state = await pick()
    for (let tap = 0; state !== 'picked'; tap++) {
      if (state === 'stray') throw new Error('the people search holds a pick that is not the second account alone')
      if (tap === 2) throw new Error('two taps on the second account among the results picked nothing')
      const row = await filesRowNamed(secondUser, 'the second account among the results', {
        testID: T.TEAM_BUILDING_RESULT_ROW,
        timeout: tap ? 5_000 : 15_000,
      })
      // a first tap can land after its 3s of reads: read again before the second
      if (tap && (state = await pick()) !== 'none') continue
      await press(row.e, 'the result row')
      const end = Date.now() + 3_000
      do {
        await browser.pause(250)
        state = await pick()
      } while (state === 'none' && Date.now() < end)
    }
    // the team builder's results can hold people who are not test accounts
    await step('The second account picked', {screenshot: false})
    await tapHeaderAction('Add', "the people search's Add")

    // the wizard's confirm holds the second account alone, as `role`
    const onConfirm = (role: string) => (p: Params) => {
      const w = wizardOf(p)
      const m = w.addingMembers ?? []
      return w.teamID === teamID && m.length === 1 && m[0]!.assertion === secondUser && m[0]!.role === role && w.role === role
    }
    await expectScreen("the wizard's confirm", 'teamAddToTeamConfirm', onConfirm('writer'))
    await el(T.TEAMS_WIZARD_ROLE_BUTTON).waitForExist({timeout: 10_000})
    await pressTestID(T.TEAMS_WIZARD_ROLE_BUTTON, "the wizard's role button")
    // choosing the role writes nothing: the confirm's route takes it
    await pickRole('Reader', async () => requireOnSubteam("the wizard's confirm", 'teamAddToTeamConfirm', onConfirm('writer')))
    await expectScreen('the confirm inviting a reader', 'teamAddToTeamConfirm', onConfirm('reader'))
    await step('The second account to be invited as a reader')
    await requireOnSubteam("the wizard's confirm", 'teamAddToTeamConfirm', onConfirm('reader'))
    const seq = await currentCallSeq()
    await tapButton('Invite 1 person & finish', "the confirm's Invite 1 person & finish")
    await waitForUiCall('the invite to go out', seq, 'keybase.1.teams.teamAddMembersMultiRole')
    await expectTeamPage('the subteam page after the wizard', teamID)
    await expectHost("the second account's role after the wizard", async () => secondRoleIn(name), r => r.second === 'reader')
    await memberRow(secondUser, "the second account's member row")
    await step('The second account added as a reader', {card: true})
  })

  it("the second account's role changed on its member page", async function () {
    // worst case (s): subteam 600, host 315 (its id), add 255, opened 204, member page 53, the row
    // expanded 108, its role button 2 and its label 1 and tap 1, role 36 (its pin 1), calls 2, waited
    // for 12, polled 285, the button's new role 15 (10, one read: the row 2, in row 2, the label 1),
    // step 2 = 1891
    this.timeout(2_000_000)
    const {secondUser} = loadE2EAccounts()
    const {name} = await makeOwnSubteam('rol', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    await masked(async () => addToSubteamFromCli(name, secondUser, 'reader'))
    await openSubteamUntil("the subteam's members", name, teamID, MEMBERS, async () =>
      memberRow(secondUser, "the second account's member row", 10_000)
    )
    await openSecondsMemberPage(teamID)
    const onSecondHere = (p: Params) => p['teamID'] === teamID && p['username'] === secondUser

    const row = await expandSubteamRow(name)
    const roleButton = await elementInRow(row.rect, T.TEAMS_MEMBER_ROLE_BUTTON)
    check(labelHas((await roleButton.getAttribute('label').catch(() => null)) ?? '', 'Reader'), "the subteam row's role is not Reader")
    await roleButton.click()
    let seq: CallMark | undefined
    await pickRole('Writer', async () => {
      await requireOnSubteam("the second account's member page", 'teamMember', onSecondHere)
      seq = await currentCallSeq()
    })
    if (!seq) throw new Error('the role was saved before its call-log mark was taken')
    await waitForUiCall('the role change to go out', seq, 'keybase.1.teams.teamEditMembers')
    await expectHost("the second account's role after Save", async () => secondRoleIn(name), r => r.second === 'writer')
    await waitFor(
      "the subteam row's role to read Writer",
      async () => {
        const now = await filesRowNamed(name, "the subteam's expanded row", {testID: T.TEAMS_MEMBER_TEAM_ROW, timeout: 1_000})
        const label = (await (await elementInRow(now.rect, T.TEAMS_MEMBER_ROLE_BUTTON)).getAttribute('label').catch(() => null)) ?? ''
        return labelHas(label, 'Writer') ? true : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    await step('The second account is a writer', {card: true})
  })

  it('the second account added to two channels from its member page, and removed from one on its page', async function () {
    // worst case (s):
    // setup: subteam 600, host 315 (its id), two seeds 1020, add 255, two host reads 510, opened 250
    //   (60s of tries, overrun by one: team 109, tab 24, two rows of 11, tab 24, a row 11) = 2950;
    // add: member page 53, the row expanded 108, its button 6 and tap 1, screen 11, two channels of
    //   part 6 and a press 2 = 16, the subteam's channels 255, step 2, pin 1, calls 2, action 8,
    //   waited for 12, the call log 2, two polled 570, step 2 = 1047, two checked rows of 6 = 12 -> 1059;
    // remove: back 44, tab 24, row 31 and its tap 1, screen 11, the page's marker 10, row 31, the check
    //   and its popup 21, its button 6 and tap 1, screen 11, text 6, step 2, pin 1, calls 2,
    //   button 6, waited for 12, polled 285, two host reads 510, step 2 = 1017
    // = 2950 + 1059 + 1017 = 5026
    this.timeout(5_100_000)
    const {secondUser, smokeUser} = loadE2EAccounts()
    const runId = e2eRunId()
    const {name} = await makeOwnSubteam('chs', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    const channels = [stampedChannelName('mch1', runId), stampedChannelName('mch2', runId)] as const
    const convIDs: Array<string> = []
    for (const c of channels) convIDs.push(await masked(async () => makeSubteamChannel(name, c)))
    await masked(async () => addToSubteamFromCli(name, secondUser, 'writer'))
    for (const c of channels) {
      check(!(await masked(async () => channelMembers(name, c))).includes(secondUser), 'the second account is already in a new channel')
    }
    // the app lists the host's channels and the second account once it has loaded them afresh
    await openSubteamUntil("the subteam's channels and members", name, teamID, CHANNELS, async () => {
      for (const c of channels) await filesRowNamed(`#${c}`, "a host-made channel's row", {testID: T.TEAMS_CHANNEL_ROW, timeout: 10_000})
      await openTeamTab(MEMBERS.button, MEMBERS.body)
      await memberRow(secondUser, "the second account's member row", 10_000)
    })

    // -- added to both channels from the member page ------------------------------------------------
    await openSecondsMemberPage(teamID)
    const row = await expandSubteamRow(name)
    await (await shownInside(row.rect, BUTTON_ELEMENTS, 'Add to channels', "the subteam row's Add to channels")).click()
    const onAdd = (p: Params) =>
      p['teamID'] === teamID && Array.isArray(p['usernames']) && p['usernames'].length === 1 && p['usernames'][0] === secondUser
    await expectScreen("the second account's add to channels", 'teamAddToChannels', onAdd)
    for (const c of channels) {
      const pick = await waitFor('a host-made channel to add to', async () => elementWithLabelPart(TEXTS, `#${c}`, 'a host-made channel to add to', {forTap: true}), {
        interval: 250,
        timeout: 5_000,
      })
      await press(pick, 'a host-made channel to add to')
    }
    // each pick reads checked off its row; the subteam holds #general and the two host-made channels
    // alone, the add the call log shows went to those two alone, and the host reads the second account
    // in both after it
    for (const c of channels) {
      await filesRowNamed(`#${c}`, 'a picked channel row drawn checked', {testID: T.TEAMS_ADD_TO_CHANNELS_ROW_CHECKED, timeout: 5_000})
    }
    const subteamChannels = [...(await masked(async () => teamChannels(name))).keys()].sort()
    check(
      subteamChannels.length === channels.length + 1 && channels.every(c => subteamChannels.includes(c)),
      'the subteam holds channels other than #general and the two: not tapping'
    )
    await step('Both channels picked')
    await requireOnSubteam('the add to channels', 'teamAddToChannels', onAdd)
    let seq = await currentCallSeq()
    await tapHeaderAction('Add', "the add to channels' Add")
    await waitForUiCall('the channel adds to go out', seq, 'chat.1.local.bulkAddToManyConvs')
    // the add went to the two host-made channels alone (no #general, no other), read off the call log
    const sent = (await uiCallsSince(seq, 'chat.1.local.bulkAddToManyConvs')).map(c => [...(c.convs ?? [])].sort())
    const wantConvs = [...convIDs].sort()
    check(
      sent.length === 1 && sent[0]!.length === wantConvs.length && sent[0]!.every((c, i) => c === wantConvs[i]),
      'the channel add did not go to the two host-made channels alone'
    )
    for (const c of channels) {
      await expectHost('the second account in a picked channel', async () => channelMembers(name, c), m => m.includes(secondUser))
    }
    await step('The second account in both channels', {card: true})

    // -- removed from the first from its channel page -----------------------------------------------
    await backToTeamPage('the member page', teamID)
    await openTeamTab(CHANNELS.button, CHANNELS.body)
    const channelRow = await filesRowNamed(`#${channels[0]}`, "the first channel's row", {testID: T.TEAMS_CHANNEL_ROW})
    await press(channelRow.e, 'the channel row')
    const onChannel = (p: Params) => p['teamID'] === teamID && p['conversationIDKey'] === convIDs[0]
    await expectScreen("the first channel's page", 'teamChannel', onChannel)
    await el(T.TEAMS_CHANNEL_PAGE).waitForExist({timeout: 10_000})
    const inChannel = await filesRowNamed(secondUser, "the second account's row on the channel page", {testID: T.TEAMS_CHANNEL_MEMBER_ROW})
    const popup = await checkRowForPopup(inChannel.rect, "the second account's check on the channel page")
    await (await shownInside(popup, BUTTON_ELEMENTS, 'Remove from channel', "the selection popup's Remove from channel")).click()
    const onRemove = (p: Params) =>
      onChannel(p) && Array.isArray(p['members']) && p['members'].length === 1 && p['members'][0] === secondUser
    await expectScreen("the remove from channel confirm", 'teamReallyRemoveChannelMember', onRemove)
    await textShown(`Remove ${secondUser} from #${channels[0]}?`, 'the remove prompt for the second account and the channel')
    await step('The remove from channel confirm')
    await requireOnSubteam('the remove from channel', 'teamReallyRemoveChannelMember', onRemove)
    seq = await currentCallSeq()
    await tapButton('Remove from channel', "the confirm's Remove from channel")
    await waitForUiCall('the channel removal to go out', seq, 'chat.1.local.removeFromConversationLocal')
    // the same kind of read still has it in the other channel, and in the subteam
    await expectHost(
      'the second account out of the first channel',
      async () => channelMembers(name, channels[0]),
      m => !m.includes(secondUser) && m.includes(smokeUser)
    )
    check((await masked(async () => channelMembers(name, channels[1]))).includes(secondUser), 'the second account left the other channel too')
    check((await masked(async () => secondRoleIn(name))).second === 'writer', 'the second account is no longer a writer in the subteam')
    await step('The second account removed from the first channel')
  })

  it('the second account removed from the subteam from the selection popup and from its row menu', async function () {
    // worst case (s):
    // setup: subteam 600, host 315 (its id), add 255, opened 204 = 1374;
    // popup: row 31, the check and its popup 21, its button 6 and tap 1, screen 11, text 6,
    //   step 2, pin 1, calls 2, button 6, waited for 12, polled 285, step 2 = 386;
    // menu: add 255, polled 285, opened 204, the popup's absence 1, row 31, in row 2, menu 19, pin
    //   1, calls 2, item 22, waited for 12, polled 285, step 2 = 1121
    // = 1374 + 386 + 1121 = 2881
    this.timeout(2_900_000)
    const {secondUser} = loadE2EAccounts()
    const {name} = await makeOwnSubteam('kck', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    await masked(async () => addToSubteamFromCli(name, secondUser, 'writer'))
    const secondsRow = async () => memberRow(secondUser, "the second account's member row", 10_000)
    await openSubteamUntil("the subteam's members", name, teamID, MEMBERS, secondsRow)
    const onSubteam = (p: Params) => p['teamID'] === teamID

    // -- the selection popup's Remove from team, then Kick out ---------------------------------------
    const row = await memberRow(secondUser, "the second account's member row")
    const popup = await checkRowForPopup(row.rect, "the second account's check")
    await (await shownInside(popup, BUTTON_ELEMENTS, 'Remove from team', "the selection popup's Remove from team")).click()
    const onKick = (p: Params) =>
      onSubteam(p) && Array.isArray(p['members']) && p['members'].length === 1 && p['members'][0] === secondUser
    await expectScreen('the kick out confirm', 'teamReallyRemoveMember', onKick)
    await textShown(`Kick ${secondUser} out of ${name}?`, 'the kick out prompt for the second account and the subteam')
    await step('The kick out confirm')
    await requireOnSubteam('the kick out', 'teamReallyRemoveMember', onKick)
    let seq = await currentCallSeq()
    await tapButton('Kick out', "the confirm's Kick out")
    await waitForUiCall('the removal to go out', seq, 'keybase.1.teams.teamRemoveMember')
    await expectHost('the second account out of the subteam', async () => secondRoleIn(name), secondOut)
    await step('Removed from the selection popup', {card: true})

    // -- back in through the host, then the row menu's Remove from team -----------------------------
    await masked(async () => addToSubteamFromCli(name, secondUser, 'writer'))
    await expectHost('the second account back in the subteam', async () => secondRoleIn(name), r => r.second === 'writer')
    // a page opened afresh carries no selection, so the row draws its menu button
    await openSubteamUntil("the subteam's members with the second account back", name, teamID, MEMBERS, secondsRow)
    check(!(await onScreenID(T.TEAMS_SELECTION_POPUP)), 'a member is still selected on the reopened page')
    const again = await memberRow(secondUser, "the second account's member row")
    const menu = await elementInRow(again.rect, T.TEAMS_MEMBER_ROW_MENU)
    await openMenuFrom("the second account's row menu", async () => menu.click())
    await requireOnSubteam("the second account's row menu", 'team', onSubteam)
    seq = await currentCallSeq()
    // never Block, the item below it
    await chooseMenuItem('Remove from team')
    await waitForUiCall('the removal to go out', seq, 'keybase.1.teams.teamRemoveMember')
    await expectHost('the second account out of the subteam again', async () => secondRoleIn(name), secondOut)
    await step('Removed from the row menu')
  })

  it("an email invite to this run's address made through the wizard and cancelled from its row", async function () {
    // worst case (s): subteam 600, host 315 (its id), opened 204, pin 1, header 8, button 6, screen
    // 11, part 6 and its tap 1, screen 11, field 11, fill 26, step 2, clickUntil 10, screen 11, text 6,
    // step 2, pin 1, calls 2, button 6, waited for 12, page 21, polled 285, the invite's row 31, step
    // 2, in row 2, menu 19, pin 1, calls 2, item 22, waited for 12, polled 540 (30s of two CLI reads
    // of 255, overrun by one pair), the row gone 21 (20, one read 1), step 2 = 2212
    this.timeout(2_300_000)
    const {smokeUser} = loadE2EAccounts()
    // example.com never delivers (RFC 2606)
    const email = `e2e-${e2eRunId()}-inv@example.com`
    const {name} = await makeOwnSubteam('eml', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    await openSubteamUntil("the subteam's members", name, teamID, MEMBERS, async () =>
      memberRow(smokeUser, "the smoke account's member row", 10_000)
    )
    const onSubteam = (p: Params) => p['teamID'] === teamID

    await requireOnSubteam("the subteam's page", 'team', onSubteam)
    await revealTeamHeader()
    await tapHeaderAddInvite()
    await expectScreen("the subteam's add-members wizard", 'teamAddToTeamFromWhere', p => wizardOf(p).teamID === teamID)
    const byEmail = await waitFor(
      "the wizard's email list choice",
      async () => elementWithLabelPart(TEXTS, 'A list of email addresses', "the wizard's email list choice", {forTap: true}),
      {interval: 250, timeout: 5_000}
    )
    await byEmail.click()
    await expectScreen("the subteam's email list", 'teamAddToTeamEmail', p => wizardOf(p).teamID === teamID)
    await fillField(await onlyField('TextView', "the email list's field"), email, "the email list's field")
    await step("This run's address typed")
    // with the keyboard up the first tap below it only closes the keyboard
    await clickUntil(
      async () => buttonLabelled('Continue', "the email list's Continue"),
      async () => (await visibleScreen())?.name === 'teamAddToTeamConfirm',
      "the email list's Continue"
    )
    // the address alone, as an email invite: never a Keybase account it resolved to
    const onConfirm = (p: Params) => {
      const w = wizardOf(p)
      const m = w.addingMembers ?? []
      return (
        w.teamID === teamID && m.length === 1 && m[0]!.assertion.endsWith('@email') && m[0]!.assertion.includes(email) && !m[0]!.resolvedFrom
      )
    }
    await expectScreen("the wizard's confirm", 'teamAddToTeamConfirm', onConfirm)
    await textShown(email, 'the address to invite')
    await step('The email invite to confirm')
    await requireOnSubteam("the wizard's confirm", 'teamAddToTeamConfirm', onConfirm)
    invitedEmail = email
    let seq = await currentCallSeq()
    await tapButton('Invite 1 person & finish', "the confirm's Invite 1 person & finish")
    await waitForUiCall('the email invite to go out', seq, 'keybase.1.teams.teamAddMembersMultiRole')
    await expectTeamPage('the subteam page after the invite', teamID)
    await expectHost("the subteam's invites after the invite", async () => inviteNames(name), n => n.includes(email))
    const inviteRow = await filesRowNamed(email, "the invite's row", {testID: T.TEAMS_INVITE_ROW})
    await step('The invite listed', {card: true})

    const menu = await elementInRow(inviteRow.rect, T.TEAMS_INVITE_ROW_MENU)
    await openMenuFrom("the invite's menu", async () => menu.click())
    await requireOnSubteam("the invite's menu", 'team', onSubteam)
    seq = await currentCallSeq()
    await chooseMenuItem('Cancel invite')
    await waitForUiCall('the cancel to go out', seq, 'keybase.1.teams.teamRemoveMember')
    // the same read still has the smoke account in the subteam
    await expectHost(
      "the subteam's invites after Cancel invite",
      async () => ({invites: await inviteNames(name), roles: await secondRoleIn(name)}),
      r => !r.invites.includes(email) && r.roles.anchored
    )
    await waitFor(
      "the invite's row to go, with the smoke account's row still drawn",
      async () => {
        const rows = await drawnRows([T.TEAMS_INVITE_ROW, T.TEAMS_MEMBER_ROW])
        return drawn(rows, T.TEAMS_MEMBER_ROW, smokeUser) && !drawn(rows, T.TEAMS_INVITE_ROW, email) ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    invitedEmail = undefined
    await step('The invite cancelled')
  })

  it("a request to join from the second account's peer denied from its row", async function () {
    // worst case (s): subteam 600, host 315 (its id), peer 70, peer call 60, polled 285 (the
    // requests), opened 204, the row 11, step 2, in row 2, menu 19, pin 1, calls 2, item 22, waited
    // for 12, polled 540 (30s of two CLI reads of 255, overrun by one pair), the row gone 21 (20, one
    // read 1), step 2 = 2168
    this.timeout(2_200_000)
    const {secondUser, smokeUser} = loadE2EAccounts()
    const {name} = await makeOwnSubteam('req', madeNames)
    const teamID = await masked(async () => hostTeamID(name))
    requireThisRunSubteam(name)
    await masked(async () => {
      const peer = await ensurePeer('second', loadE2EEnv())
      await peer.cli(['team', 'request-access', name], 60_000)
    })
    await expectHost('the requests to join the subteam', async () => requesters(name), r => r.includes(secondUser))
    const requestRow = async () => filesRowNamed(secondUser, "the second account's request row", {testID: T.TEAMS_REQUEST_ROW, timeout: 10_000})
    await openSubteamUntil("the subteam's members with the request", name, teamID, MEMBERS, requestRow)
    const onSubteam = (p: Params) => p['teamID'] === teamID
    const row = await requestRow()
    await step('The request listed', {card: true})

    const menu = await elementInRow(row.rect, T.TEAMS_REQUEST_ROW_MENU)
    await openMenuFrom("the request's menu", async () => menu.click())
    await requireOnSubteam("the request's menu", 'team', onSubteam)
    const seq = await currentCallSeq()
    // the item reads its subtitle after its title
    await chooseMenuItem("Deny, They won't be notified")
    await waitForUiCall('the deny to go out', seq, 'keybase.1.teams.teamIgnoreRequest')
    // the subteam's members read alongside: the smoke account in it, the second account not let in
    await expectHost(
      'the request gone',
      async () => ({requests: await requesters(name), roles: await secondRoleIn(name)}),
      r => !r.requests.includes(secondUser) && secondOut(r.roles)
    )
    await waitFor(
      "the request's row to go, with the smoke account's row still drawn",
      async () => {
        const rows = await drawnRows([T.TEAMS_REQUEST_ROW, T.TEAMS_MEMBER_ROW])
        return drawn(rows, T.TEAMS_MEMBER_ROW, smokeUser) && !drawn(rows, T.TEAMS_REQUEST_ROW, secondUser) ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    await step('The request denied')
  })
})

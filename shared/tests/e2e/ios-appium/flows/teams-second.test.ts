// What the phone sends as the second account in subteams of the e2e team, in tests that each own a
// subteam: it joins one by an invite link pasted into "Join a team"; it leaves one from the team
// page's header menu; and it dismisses the invitation to block the account that added it, which a
// relaunch still shows dismissed.
//
// The invite link is a secret (it holds the invite's key): the host makes it for one use, for a day,
// as a reader; it stays in this worker's memory and in the run's secret-scan record
// (shared/gate/secret-scan.ts), and reaches the app only through the simulator's pasteboard and the
// field's own Paste. Nothing types it, opens it as a link, puts it in a step, an error or a selector,
// or reads the field's text back (only its length, inside the app). No step is taken while the field
// holds it (the gate's secret-on-screen mark, which also withholds a failure's screenshot, even one
// taken after a timeout), the pasteboard is overwritten once the field has it, and the afterEach
// empties the field and overwrites the pasteboard when a test stopped before. No retry: one would
// paste it again.
//
// The host stays on the smoke account: it makes the subteams and the link, adds the second account
// where a test starts from it being in, and reads back what the phone did; the phone is on the
// second account only inside asSecond. The flow's afterEach takes the second account out of each
// subteam, deletes it (after a timeout too; a deleted team's name is never free again, so each
// attempt takes a fresh one), reads on the second account's peer that it is in none of this run's
// subteams, and puts the app back on the smoke account.
import {randomBytes} from 'crypto'
import {loadE2EAccounts, loadE2EEnv} from '../../accounts/env'
import {parseStampedName, stampedTeamName} from '../../accounts/run-id'
import {createThrowawaySubteam, retryTransient} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {rememberInviteLink} from '../../shared/gate/secret-scan.ts'
import {ensurePeer, runKeybase} from '../../shared/peer-service'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {addToSubteamFromCli, deleteSubteamIfPresent, memberRoles, requireThisRunSubteam, subteamExists, teamID as hostTeamID} from '../../shared/teams.ts'
import {appAccount, asSecond, restoreToSmoke} from '../gate/accounts'
import {creditSurface} from '../gate/attempt'
import {requireSecondNotBlocked} from '../gate/blocks'
import {relaunchApp, setPasteboard} from '../gate/device'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import {emptySecretField, fieldLength, focusSecretField} from '../gate/secret-input'
import {clearSecretOnScreen, markSecretOnScreen} from '../gate/secret-screen.ts'
import {retriedNavigation, step} from '../gate/step'
import {closeMessageMenu, hideKeyboard, openConversation} from '../helpers/chat'
import {el} from '../helpers/elements'
import {BUTTONS, expectScreen, tapButton, waitSignedIn} from '../helpers/files'
import {jsEval, waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, labelledElement, openMenuFrom} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {
  masked,
  openTeamFromList,
  openTeamTab,
  openTeamsRoot,
  requireOnSubteam,
  revealTeamHeader,
  textShown,
} from '../helpers/teams'

type Params = Record<string, unknown>

const MEMBERS = {body: T.TEAMS_MEMBER_LIST, button: T.TEAMS_TAB_MEMBERS_BUTTON}

const PASTE_ITEM =
  '-ios predicate string:(type == "XCUIElementTypeMenuItem" OR type == "XCUIElementTypeButton") AND (name == "Paste" OR label == "Paste")'

// The screen up and, on the invite link's join screen, the team its invite is to and whether it holds
// a key: never the key or the link, which stay in the app. Bound: one read 1.
type JoinScreen = {hasKey: boolean; name?: string; teamID?: string}
const joinScreen = async () =>
  jsEval<JoinScreen>(`
    const s = kbModule('constants/router.tsx').getVisibleScreen()
    const p = (s && s.params) || {}
    const d = p.inviteDetails
    return {
      hasKey: typeof p.inviteKey === 'string' && p.inviteKey.length > 0,
      name: s ? s.name : undefined,
      teamID: d && typeof d.teamID === 'string' ? d.teamID : undefined,
    }`)

describe('teams second account', function () {
  // a retry would paste the invite link again
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      a retried CLI read (readBack: up to four reads of 60, 5s apart) 255;  polled  30s of
  //             CLI reads, overrun by one 285
  //   subteam   makeOwnSubteam 915 (the make 600, its id 315);  add  addToSubteamFromCli 255;  link
  //             makeInviteLink 255
  //   second    asSecond 250 (the switch 90, the restore 160)
  //   opened    openSubteamUntil: 60s of tries, overrun by one (team 109, tab 24, `ready`)
  //   team      openTeamsRoot 56;  header  revealTeamHeader 8
  //   screen    a screen waited for 11 (10, read 1), 21 with a 20s wait;  pin  requireOnSubteam 1
  //   button    tapButton 6;  text  textShown 6
  //   menu      openMenuFrom 19;  item  chooseMenuItem 22
  //   paste     setPasteboard 50, pasteInto 21 (the tap 1, six tries of 3s), its length 6 (5, one read
  //             1), the overwrite 50 = 127
  //   open      openConversation 100;  relaunch  relaunchApp 200;  signed in  90
  //   calls     one read 2;  waited for  12 (10, one read 2)
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
  // set before the invite link goes on the pasteboard, cleared once filler replaced it
  let pasteboardHoldsLink = false
  // set before the paste, cleared once the join dialog that holds it has gone, with the gate's
  // secret-on-screen mark of this label
  let linkInField = false
  const JOIN_FIELD = 'the invite link in the join field'

  const filler = () => `e2e-${e2eRunId()}-pasteboard`

  // Overwrites the simulator pasteboard while it may hold the invite link. Bound: 50.
  const overwritePasteboard = async () => {
    if (!pasteboardHoldsLink) return
    await setPasteboard(filler())
    pasteboardHoldsLink = false
  }

  // Empties the join dialog's field while it may hold the invite link, inside the app (no Appium
  // command carries its text), then clears the secret-on-screen mark; a field that would not empty
  // keeps the mark. Bound: exists 10, focus 6, the empty 11 = 27.
  const emptyJoinField = async () => {
    if (!linkInField) return
    if (await el(T.TEAMS_JOIN_TEAM_INPUT).waitForExist({timeout: 10_000}).then(() => true, () => false)) {
      await focusSecretField(T.TEAMS_JOIN_TEAM_INPUT)
      await emptySecretField(T.TEAMS_JOIN_TEAM_INPUT)
    }
    linkInField = false
    clearSecretOnScreen(JOIN_FIELD)
  }

  // Takes the second account out of a subteam of this run while it is in it, through the CLI.
  // Bound: its roles 255, the removal 255 = 510.
  const removeSecond = async (name: string) => {
    const {secondUser} = loadE2EAccounts()
    if (!(secondUser in (await memberRoles(name)))) return
    requireThisRunSubteam(name)
    await retryTransient(
      async () => runKeybase(['team', 'remove-member', name, `--user=${secondUser}`, '--force'], {timeoutMs: 60_000}),
      /not a member|not found/i
    )
  }

  // Bound: 1575 a name (exists 315, removeSecond 510, deleteSubteamIfPresent 750: an existence read
  // 315, the delete 90, 30s of reads overrun by one 315).
  const restoreMade = async () => {
    for (const name of [...madeNames]) {
      await masked(async () => {
        if (await subteamExists(name)) await removeSecond(name)
        await deleteSubteamIfPresent(name)
      })
      madeNames.delete(name)
    }
  }

  // The subteams of this run the second account is in, read on its own peer, and whether that read
  // lists the e2e team (the anchor: an empty read of the wrong account lists nothing). Bound: one
  // peer call 60.
  const secondMemberships = async (peer: Awaited<ReturnType<typeof ensurePeer>>) => {
    const {team} = loadE2EAccounts()
    const out = await peer.cli(['team', 'list-memberships', '-j'], 60_000)
    const names = ((JSON.parse(out) as {teams?: Array<{fq_name: string}> | null}).teams ?? []).map(t => t.fq_name)
    const runId = e2eRunId()
    const inRun = names.filter(n => {
      const part = n.startsWith(`${team}.`) ? n.slice(team.length + 1) : ''
      return !part.includes('.') && parseStampedName(part, 'team')?.runId === runId
    })
    return {anchored: names.includes(team), inRun}
  }

  // Bound: the peer 70, then 30s of reads, overrun by one 60 = 160.
  const secondInNoSubteam = async () =>
    masked(async () => {
      const peer = await ensurePeer('second', loadE2EEnv())
      await waitFor(
        "the second account's memberships to hold none of this run's subteams",
        async () => {
          const {anchored, inRun} = await secondMemberships(peer)
          return anchored && inRun.length === 0 ? true : undefined
        },
        {interval: 2_000, timeout: 30_000}
      )
    })

  // Worst case (s): the field 27, the pasteboard 50, the one name of a test 1575, the memberships
  // 160, close 5, keyboard 5, restoreToSmoke 160, escape 30 = 2012.
  afterEach(async function () {
    this.timeout(2_100_000)
    await withCleanup(emptyJoinField, [overwritePasteboard, restoreMade, secondInNoSubteam, closeMessageMenu, hideKeyboard, restoreToSmoke, escapeToTabs])
  })

  // A subteam of the e2e team made by the host for one test, with its name in madeNames before the
  // make, so a test timed out during it still has it deleted. `prefix` is up to 3 characters.
  // Bound: the make 600 (two CLI calls of up to four tries of 60 with 5s pauses, 255 each, then its
  // general channel listed 90), its id 315 = 915.
  const makeOwnSubteam = async (prefix: string) => {
    const label = `${prefix}${randomBytes(2).toString('hex')}`
    const name = `${loadE2EAccounts().team}.${stampedTeamName(label, e2eRunId())}`
    requireThisRunSubteam(name)
    madeNames.add(name)
    const {generalConvID} = await masked(async () => createThrowawaySubteam(label))
    return {generalConvID, name, teamID: await masked(async () => hostTeamID(name))}
  }

  // An invite link to a subteam of this run, made through the CLI for one use within a day, as a
  // reader, and put in the run's secret-scan record before anything else is done with it. A failure
  // says only what failed: the CLI's output can hold the link. Bound: four tries of 60 with 5s
  // pauses = 255.
  const makeInviteLink = async (name: string) => {
    requireThisRunSubteam(name)
    let out: string | undefined
    try {
      out = await retryTransient(async () =>
        runKeybase(['team', 'generate-invitelink', name, '--role', 'reader', '--max-uses', '1', '--duration', '1D'], {timeoutMs: 60_000})
      )
    } catch {
      // no cause: its message can quote the CLI's output
      throw new Error('the host could not make an invite link to the subteam')
    }
    const link = /Generated link: (\S+?)\.?\n/.exec(`${out ?? ''}\n`)?.[1]
    if (!link) throw new Error('the host made no invite link it could read')
    rememberInviteLink(link, e2eRunId())
    return link
  }

  // -- reads --------------------------------------------------------------------------------------

  // Polls a host read until `ok` takes it. Bound: 30s, overrun by one read.
  const expectHost = async <V,>(what: string, read: () => Promise<V>, ok: (v: V) => boolean) =>
    masked(async () =>
      waitFor(`the host to read ${what}`, async () => (ok(await read()) ? true : undefined), {interval: 1_000, timeout: 30_000})
    )

  // The second account's role in a subteam ('none' when it is not in it), and whether the same read
  // has the smoke account in it (the anchor for its absence). Bound: one CLI read 255.
  const rolesIn = async (name: string) => {
    const {secondUser, smokeUser} = loadE2EAccounts()
    const roles = await memberRoles(name)
    return {anchored: smokeUser in roles, second: roles[secondUser] ?? 'none'}
  }

  // The subteam's page opened from the Teams tab until `ready` passes on it: the app loads a team
  // afresh when its page opens, and its teams list hears of a membership the host gave on a reopen.
  // Bound: 60s of tries, overrun by one (team 109, tab 24, `ready`).
  const openSubteamUntil = async (what: string, name: string, teamID: string, ready: () => Promise<unknown>) =>
    retriedNavigation(
      what,
      async () => {
        await openTeamFromList(name, teamID)
        await openTeamTab(MEMBERS.button, MEMBERS.body)
        await ready()
      },
      {intervals: [2_000], timeout: 60_000}
    )

  // Long-presses the field with `testID` until its edit menu offers Paste, and taps it: what a person
  // does to paste. The pasteboard is set before. Bound: the tap 1, six tries of the hold 1.3 and 1.5
  // for the menu = 21.
  const pasteInto = async (testID: string) => {
    const field = await el(testID).getElement()
    await field.click()
    for (let i = 0; i < 6; i++) {
      await browser.execute('mobile: touchAndHold', {duration: 1.3, elementId: field.elementId})
      if (await browser.$(PASTE_ITEM).waitForExist({interval: 150, timeout: 1_500}).then(() => true, () => false)) {
        await browser.$(PASTE_ITEM).click()
        return
      }
    }
    throw new Error("the field's edit menu never offered Paste")
  }

  it('the second account joins a subteam by an invite link pasted into Join a team', async function () {
    // worst case (s): subteam 915, host 255 (its roles), link 255, second 250; in it: team 56,
    // button 6, screen 11, the field 10, paste 127, button 6, the join screen 21 (20, one read 1), the
    // field gone 1, text 6, step 2, pin 1, calls 2, button 6, waited for 12, the success's Close 21
    // (20, one read 1) and its tap 1, step 2; then polled 285, step 2 = 2253
    this.timeout(2_300_000)
    const {name, teamID} = await makeOwnSubteam('lnk')
    check((await masked(async () => rolesIn(name))).second === 'none', 'the second account is already in the new subteam')
    const link = await makeInviteLink(name)

    await asSecond(async () => {
      await openTeamsRoot()
      await tapButton('Join a team', "the Teams tab's Join a team")
      await expectScreen('Join a team', 'teamJoinTeamDialog')
      await el(T.TEAMS_JOIN_TEAM_INPUT).waitForExist({timeout: 10_000})
      // From here until the join screen replaces this dialog the field holds the link: no step.
      pasteboardHoldsLink = true
      await setPasteboard(link)
      linkInField = true
      markSecretOnScreen(JOIN_FIELD)
      await pasteInto(T.TEAMS_JOIN_TEAM_INPUT)
      // the field's length, read inside the app: its text never leaves it
      await waitFor('the pasted link in the field', async () => ((await fieldLength(T.TEAMS_JOIN_TEAM_INPUT)) === link.length ? true : undefined), {
        interval: 250,
        timeout: 5_000,
      })
      await overwritePasteboard()
      // Continue only asks the service what the token is: it answers with the invite's details, and
      // the app shows its join screen in this dialog's place
      await tapButton('Continue', "Join a team's Continue")
      const onInvite = (s: JoinScreen) => s.name === 'teamInviteLinkJoin' && s.teamID === teamID && s.hasKey
      await waitFor("the invite's join screen for the subteam", async () => (onInvite(await joinScreen()) ? true : undefined), {
        interval: 250,
        timeout: 20_000,
      })
      check(!(await el(T.TEAMS_JOIN_TEAM_INPUT).isExisting()), 'the join dialog that holds the link is still drawn')
      linkInField = false
      clearSecretOnScreen(JOIN_FIELD)
      await textShown(name, "the invite's team")
      await step('The invite to the subteam')

      check(onInvite(await joinScreen()), 'the join screen is not for an invite to the throwaway subteam: not tapping')
      const seq = await currentCallSeq()
      await tapButton('Join team', 'the join screen\'s Join team')
      await waitForUiCall('the join to go out', seq, 'keybase.1.teams.teamAcceptInviteOrRequestAccess')
      // the join screen turns to its success once the service has let the account in
      const close = await waitFor("the join's success", async () => labelledElement(BUTTONS, 'Close', "the join's Close"), {
        interval: 250,
        timeout: 20_000,
      })
      await close.click()
      creditSurface('pasteboard')
      await step('Joined from the pasted link')
    })
    await expectHost("the second account's role after the join", async () => rolesIn(name), r => r.second === 'reader')
    await step('The second account in the subteam', {card: true})
  })

  it('the second account leaves a subteam from its header menu', async function () {
    // worst case (s): subteam 915, add 255, polled 285, second 250; in it: opened 197 (team 109, tab
    // 24, the header 4, overrun by one try), pin 1, header 8, menu 19, item 22, screen 11, text 6,
    // step 2, pin 1, calls 2, button 6, waited for 12, screen 21; then polled 285, step 2 = 2300
    this.timeout(2_400_000)
    const {secondUser} = loadE2EAccounts()
    const {name, teamID} = await makeOwnSubteam('lve')
    await masked(async () => addToSubteamFromCli(name, secondUser, 'writer'))
    await expectHost('the second account in the subteam', async () => rolesIn(name), r => r.second === 'writer')
    const onSubteam = (p: Params) => p['teamID'] === teamID

    await asSecond(async () => {
      await openSubteamUntil("the subteam's page", name, teamID, async () =>
        el(T.TEAMS_HEADER_MENU_BUTTON).waitForExist({timeout: 3_000})
      )
      await requireOnSubteam("the subteam's page", 'team', onSubteam)
      await revealTeamHeader()
      await openMenuFrom("the team's menu", async () => el(T.TEAMS_HEADER_MENU_BUTTON).click())
      await chooseMenuItem('Leave team')
      await expectScreen('the leave confirm', 'teamReallyLeaveTeam', onSubteam)
      await textShown(`Leave ${name}?`, 'the leave prompt for the subteam')
      // its "Block this team" switch is never tapped
      await step('The leave confirm')
      await requireOnSubteam('the leave', 'teamReallyLeaveTeam', onSubteam)
      const seq = await currentCallSeq()
      await tapButton('Leave team', "the confirm's Leave team")
      await waitForUiCall('the leave to go out', seq, 'keybase.1.teams.teamLeave')
      await expectScreen("the Teams tab's root after the leave", 'teamsRoot', () => true, 20_000)
    })
    await expectHost('the second account out of the subteam', async () => rolesIn(name), r => r.anchored && r.second === 'none')
    await step('The second account left', {card: true})
  })

  it('the second account dismisses the invitation to block its adder, and a relaunch still shows it dismissed', async function () {
    // worst case (s): subteam 915, add 255, polled 285, second 250; in it: opened 160 (60s of tries,
    // overrun by one: open 100), the row 30, text 6, step 2, screen 11 (the pin), calls 2, its tap 1,
    // waited for 12, its count 2, the row gone 15, step 2, relaunch 200, signed in 90, the account 1,
    // open 100, the store 31 (30, one read 1), the row 1, step 2 = 2373
    this.timeout(2_500_000)
    const {secondUser, smokeUser} = loadE2EAccounts()
    const {generalConvID, name, teamID} = await makeOwnSubteam('ibk')
    // added without the chat message, so the second account has nothing of its own in the thread,
    // which would dismiss the invitation on its own
    await masked(async () => addToSubteamFromCli(name, secondUser, 'writer'))
    await expectHost('the second account in the subteam', async () => rolesIn(name), r => r.second === 'writer')
    const onConversation = (p: Params) => p['conversationIDKey'] === generalConvID
    // The app's block buttons store for the subteam, once it has read the service's state: the row is
    // drawn from it, so an absent row means something only after this says loaded. Bound: one read 1.
    const blockButtons = async () =>
      jsEval<{loaded: boolean; shown: boolean}>(`
        const s = kbModule('chat/blocking/block-buttons-state.tsx').useBlockButtonsState.getState()
        return {loaded: s.loaded, shown: s.blockButtonsMap.has(${JSON.stringify(teamID)})}`)

    await asSecond(async () => {
      // the second account's inbox has the subteam's conversation once it hears of the membership
      await retriedNavigation("the subteam's conversation", async () => openConversation(generalConvID), {intervals: [2_000], timeout: 60_000})
      await el(T.CHAT_BLOCK_BUTTONS).waitForExist({timeout: 30_000})
      await textShown(`${smokeUser} added you to this team.`, "the invitation's adder")
      await step('The invitation to block the adder')
      await expectScreen("the subteam's conversation", 'chatConversation', onConversation)
      const seq = await currentCallSeq()
      await el(T.CHAT_BLOCK_BUTTONS_DISMISS).click()
      await waitForUiCall('the dismiss to go out', seq, 'keybase.1.user.dismissBlockButtons')
      check((await uiCallsSince(seq, 'keybase.1.user.dismissBlockButtons')).length === 1, 'the dismiss went out more than once')
      await el(T.CHAT_BLOCK_BUTTONS).waitForExist({reverse: true, timeout: 15_000})
      await step('The invitation dismissed')

      // a relaunch reads the service's state afresh; the app comes back on the second account
      await relaunchApp()
      await waitSignedIn()
      check((await appAccount()).username === secondUser, 'the relaunched app is not on the second account')
      // the thread is open (its composer and list), the anchor for the row's absence
      await openConversation(generalConvID)
      await waitFor(
        "the app's block buttons state after the relaunch",
        async () => {
          const b = await blockButtons()
          return b.loaded ? b : undefined
        },
        {interval: 500, timeout: 30_000}
      ).then(b => check(!b.shown, 'the app still holds the invitation after a relaunch'))
      check(!(await el(T.CHAT_BLOCK_BUTTONS).isExisting()), 'the invitation is drawn after a relaunch')
      creditSurface('relaunch')
      await step('Still dismissed after a relaunch', {card: true})
    })
  })
})

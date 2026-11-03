// What the phone sends to change a subteam's settings, in tests that each own a subteam of the e2e
// team: its description from Edit team info; featuring it on the smoke account's profile; not
// allowing requests to join it, read again after a relaunch; its message deletion set to 30 days
// through the warning; a channel's message deletion set the same way from the chat info panel; a
// channel added to its default channels from the "Add channels" popup and removed from its pill; and
// a host-seeded emoji given an alias from its row's menu, then the alias and the emoji deleted.
//
// The e2e team itself is never changed: every write is on the test's subteam, and the screen up is
// checked to aim at it (its team id, a conversation of it, or a warning opened over one of them)
// before each writing tap. The host stays on the smoke account: it makes the subteams, their extra
// channel and the seeded emoji, reads back what the phone did, and, in the flow's afterEach, takes a
// featured subteam off the smoke account's profile (a public change) before it deletes the subteam
// (after a timeout too; a deleted team's name is never free again, so each attempt takes a fresh one).
import {stampedChannelName, stampedEmojiName} from '../../accounts/run-id'
import {CORPUS_DIR} from '../../fixtures/corpus/corpus'
import {withCleanup} from '../../shared/cleanup.ts'
import {convIDBytes} from '../../shared/conv-id.ts'
import {e2eMarker, e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {mainRead, makeSubteamChannel, requireThisRunSubteam, runChatApi, subteamExists, teamID as hostTeamID} from '../../shared/teams.ts'
import {creditSurface} from '../gate/attempt'
import {elementInRow, innermost} from '../gate/chat-lib.ts'
import {labelHas, sourceElements, sourceRect} from '../gate/page-source-lib.ts'
import {settingSelector, settingShown} from '../gate/persisted-lib.ts'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import type {CallMark} from '../gate/recorder-lib'
import {step} from '../gate/step'
import {
  closeMessageMenu,
  dragUntilOnScreen,
  expectPersists,
  hideKeyboard,
  openConversation,
  openInfoPanel,
} from '../helpers/chat'
import {el} from '../helpers/elements'
import {buttonLabelled, drag, filesRowNamed, fillField, pressTestID, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {jsEval, waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, elementWithLabelPartIn, NAMED_ELEMENT_TYPES, onScreen, openMenuFrom, press} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {
  backToTeamPage,
  drainMade,
  expectHost,
  expectTeamPage,
  makeOwnSubteam,
  makeOwnSubteamWithID,
  masked,
  onlyField,
  openSubteamUntil,
  requireOnSubteam,
  revealTeamHeader,
  textShown,
} from '../helpers/teams'

type Params = Record<string, unknown>

const SETTINGS = {body: T.TEAMS_SETTINGS_TAB, button: T.TEAMS_TAB_SETTINGS_BUTTON}
const EMOJI = {body: T.TEAMS_EMOJI_TAB, button: T.TEAMS_TAB_EMOJI_BUTTON}

// RetentionPolicyType in the protocol
const retain = 1
const inherit = 3
const thirtyDays = 30 * 24 * 60 * 60
type Policy = {typ: number; expire?: {age: number} | null} | null

// The routes shown, outermost first, modals included, each by its name and the team id or
// conversation it is about (no other param leaves the app). Bound: one read 1.
type ShownRoute = {conversationIDKey?: string; name: string; teamID?: string}
const routesShown = async () =>
  jsEval<Array<ShownRoute>>(`
    const str = v => (typeof v === 'string' ? v : undefined)
    return kbModule('constants/router.tsx').getVisiblePath(true).map(r => ({
      conversationIDKey: str(r.params && r.params.conversationIDKey),
      name: r.name,
      teamID: str(r.params && r.params.teamID),
    }))`)

describe('teams settings', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      a retried host read (readBack: up to four reads 5s apart): of the main service 315
  //             (four of 75, whoami 15 and the call 60), of the CLI 255 (four of 60);  polled  30s of
  //             reads, overrun by one read: of the CLI 285, of the main service 345
  //   subteam   makeOwnSubteamWithID 915 (the make 600, its id 315), makeOwnSubteam 600;  seed
  //             makeSubteamChannel 510
  //   opened    openSubteamUntil: 60s of tries, overrun by one (team 109, tab 24, `ready`)
  //   team      openTeamFromList 109;  page  expectTeamPage 21;  tab  openTeamTab 24;  header
  //             revealTeamHeader 8
  //   screen    a screen waited for 11 (10, read 1);  pin  requireOnSubteam 1, requireUnder 1
  //   button    tapButton 6;  text  textShown 6 (16 with a 15s wait);  part  a label part waited for 6
  //   field     onlyField 11;  fill  fillField 26 (the field 10, the typing 15, the read 1)
  //   row       a row by its name 31 (30, one drag 1);  in row  elementInRow 2
  //   menu      openMenuFrom 19 (15, overrun by one try: the tap 1, the sheet 3);  item
  //             chooseMenuItem 22 (15, overrun by one drag 1, the tap 1, the sheet gone 5)
  //   on screen dragUntilOnScreen 20;  switch  switchOn 21 (three tries: the pin 1, the tap 1, 5s)
  //   warning   confirmWarning 41 (screen 11, its switch 10 and tap 1, Confirm enabled 11, step 2,
  //             pin 1, its tap 1, the warning gone 4)
  //   open      openConversation 100;  panel  openInfoPanel 25
  //   relaunch  relaunchApp 200;  signed in  90
  //   back      backToTeamPage 39;  calls  one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach)

  // -- what the afterEach puts back ---------------------------------------------------------------

  // every subteam a test made, added before its make
  const madeNames = new Set<string>()
  // a subteam a test may have featured on the smoke account's profile, added before the tap
  const featured = new Set<string>()

  // Whether the smoke account features a subteam on its profile, through the host. Bound: its id 315,
  // the read 315 = 630.
  const isFeatured = async (name: string) => {
    const teamID = await hostTeamID(name)
    return (await mainRead<{isMemberShowcased: boolean}>('keybase.1.teams.getTeamAndMemberShowcase', {teamID})).isMemberShowcased
  }

  // Takes a subteam of this run off the smoke account's profile while it is featured there, through
  // the host, and reads that it is not. Bound: exists 315, featured 630, the set 75, 30s of reads
  // overrun by one 660 = 1680.
  const unfeature = async (name: string) => {
    if (!(await subteamExists(name)) || !(await isFeatured(name))) return
    requireThisRunSubteam(name)
    await mainRead('keybase.1.teams.setTeamMemberShowcase', {isShowcased: false, teamID: await hostTeamID(name)})
    await waitFor("the subteam off the profile after the host's restore", async () => ((await isFeatured(name)) ? undefined : true), {
      interval: 1_000,
      timeout: 30_000,
    })
  }

  // Bound: 1680 a featured name, then 750 a name (deleteSubteamIfPresent: an existence read 315, the
  // delete 90, 30s of reads overrun by one 315).
  const restoreMade = async () => {
    for (const name of [...featured]) {
      await masked(async () => unfeature(name))
      featured.delete(name)
    }
    await drainMade(madeNames)
  }

  // Worst case (s): close 19, keyboard 5, unfeature 1680, the one name of a test 750, escape 30 = 2484.
  afterEach(async function () {
    this.timeout(2_600_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, restoreMade, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  // The settings tab has its team's settings once its message deletion dropdown is drawn. Bound: 10s.
  const settingsLoaded = async () => el(T.TEAMS_RETENTION_DROPDOWN).waitForExist({timeout: 10_000})

  // Refuses, before a tap that writes, unless the screen up is `top` and a route shown under it (or
  // it) aims at the throwaway subteam (`ok` takes its team id or conversation). Bound: one read 1.
  const requireUnder = async (what: string, top: string, ok: (r: ShownRoute) => boolean) => {
    const shown = await routesShown()
    check(shown.at(-1)?.name === top && shown.some(ok), `${what} is not aimed at the throwaway subteam: not tapping`)
  }

  // Taps the switch drawn as `off` until the app draws it as `on`, running `pin` before each tap. A
  // disabled switch takes no tap (the feature switch waits for the app's teams list to have the
  // team), so a tap that changed nothing is tried again; one that took flips the id at once. Bound:
  // three tries of the pin 1, the tap 1, 5s = 21.
  const switchOn = async (what: string, base: string, pin: () => Promise<void>) => {
    for (let i = 0; i < 3; i++) {
      await pin()
      await el(T.settingTestID(base, false)).click()
      if (await el(T.settingTestID(base, true)).waitForExist({timeout: 5_000}).then(() => true, () => false)) return
    }
    throw new Error(`${what} never turned on`)
  }

  // Whether the message deletion dropdown reads `shows`. Bound: one read 1.
  const retentionShows = async (shows: string) =>
    labelHas((await el(T.TEAMS_RETENTION_DROPDOWN).getAttribute('label').catch(() => null)) ?? '', shows)

  // Opens the message deletion dropdown on screen, once it shows `shows` (the policy loads after the
  // dropdown draws), and picks `title`. Bound: on screen 20, its label 11 (10, one read 1), menu 19,
  // item 22 = 72.
  const pickRetention = async (shows: string, title: string) => {
    const dropdown = () => el(T.TEAMS_RETENTION_DROPDOWN)
    await dragUntilOnScreen('the message deletion dropdown', dropdown)
    await waitFor(`the message deletion dropdown to show ${shows}`, async () => ((await retentionShows(shows)) ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
    await openMenuFrom('the message deletion menu', async () => dropdown().click())
    await chooseMenuItem(title)
  }

  // On the retention warning for `entityType` setting 30 days: its "I understand..." switch, then
  // Confirm once `pin` passes. Bound: warning 41.
  const confirmWarning = async (entityType: string, pin: () => Promise<void>) => {
    await expectScreen(
      "the message deletion's warning",
      'retentionWarning',
      p => p['entityType'] === entityType && (p['policy'] as {title?: string} | undefined)?.title === '30 days'
    )
    await el(T.TEAMS_CONFIRM_WARNING_CHECK).waitForExist({timeout: 10_000})
    await pressTestID(T.TEAMS_CONFIRM_WARNING_CHECK, "the warning's check")
    const confirm = await waitFor(
      "the warning's Confirm to be enabled",
      async () => {
        const b = await buttonLabelled('Confirm', "the warning's Confirm")
        return (await b.isEnabled()) ? b : undefined
      },
      {interval: 250, timeout: 10_000}
    )
    await step('The warning agreed to')
    await pin()
    await confirm.click()
    await waitFor("the warning to close", async () => ((await routesShown()).some(r => r.name === 'retentionWarning') ? undefined : true), {
      interval: 500,
      timeout: 3_000,
    })
  }

  it("a subteam's description saved from Edit team info", async function () {
    // worst case (s): subteam 915, host 315 (the showcase), opened 204 (team 109, tab 24, the header
    // 11), pin 1, header 8, button 6, screen 11, field 11, fill 26, step 2, pin 1, calls 2, button 6,
    // waited for 12, polled 345, back 44, text 16 (15, read 1), step 2 = 1928
    this.timeout(2_000_000)
    const {name, teamID} = await makeOwnSubteamWithID('dsc', madeNames)
    const showcase = async () =>
      mainRead<{teamShowcase: {description?: string | null}}>('keybase.1.teams.getTeamAndMemberShowcase', {teamID})
    check(((await masked(showcase)).teamShowcase.description ?? '') === '', 'a new subteam has a description')
    // the description field takes sentence capitals and corrections: a capital first word, the stamp last
    const description = `About ${e2eMarker('desc')}`
    await openSubteamUntil("the subteam's page", name, teamID, {body: T.TEAMS_MEMBER_LIST, button: T.TEAMS_TAB_MEMBERS_BUTTON}, async () =>
      el(T.TEAMS_HEADER_MENU_BUTTON).waitForExist({timeout: 10_000})
    )
    const onSubteam = (p: Params) => p['teamID'] === teamID

    await requireOnSubteam("the subteam's page", 'team', onSubteam)
    await revealTeamHeader()
    await tapButton('Edit', "the header's Edit")
    await expectScreen("the subteam's Edit team info", 'teamEditTeamInfo', onSubteam)
    await fillField(await onlyField('TextView', 'the description field'), description, 'the description field')
    await step('The description typed')
    await requireOnSubteam('Edit team info', 'teamEditTeamInfo', onSubteam)
    const seq = await currentCallSeq()
    await tapButton('Save', "Edit team info's Save")
    await waitForUiCall('the description to go out', seq, 'keybase.1.teams.setTeamShowcase')
    await expectHost('the saved description', showcase, s => s.teamShowcase.description === description)
    // the screen closes itself once its save is done
    await backToTeamPage('Edit team info', teamID)
    await textShown(description, 'the description on the team page', 15_000)
    await step('The description saved', {card: true})
  })

  it('a subteam featured on the smoke account\'s profile from its settings', async function () {
    // worst case (s): subteam 915, featured 630, opened 230 (team 109, tab 24, loaded 10, overrun by
    // one try), on screen 20, calls 2, switch 21, waited for 12, polled 690 (30s of reads of 630,
    // overrun by one), step 2 = 2522
    this.timeout(2_600_000)
    const {name, teamID} = await makeOwnSubteamWithID('shw', madeNames)
    check(!(await masked(async () => isFeatured(name))), 'a new subteam is featured on the profile')
    await openSubteamUntil("the subteam's settings", name, teamID, SETTINGS, settingsLoaded)
    const onSubteam = (p: Params) => p['teamID'] === teamID

    await dragUntilOnScreen("the settings' feature switch", () => el(T.settingTestID(T.TEAMS_SETTINGS_FEATURE, false)))
    featured.add(name)
    const seq = await currentCallSeq()
    await switchOn('the feature switch', T.TEAMS_SETTINGS_FEATURE, async () =>
      requireOnSubteam("the subteam's settings", 'team', onSubteam)
    )
    await waitForUiCall('the feature to go out', seq, 'keybase.1.teams.setTeamMemberShowcase')
    await expectHost('the subteam featured on the profile', async () => isFeatured(name), f => f)
    await step('Featured on the profile', {card: true})
  })

  it("requests to join a subteam not allowed, and the switch still on after a relaunch", async function () {
    // worst case (s): subteam 915, host 315 (tars), opened 230, on screen 20, calls 2, switch 21,
    // waited for 12, polled 345, step 2, relaunch 200, signed in 90, opened 250 (team 109, tab 24, on
    // screen 20, the switch on 15, overrun by one try), step 2 = 2404
    this.timeout(2_500_000)
    const {name, teamID} = await makeOwnSubteamWithID('tar', madeNames)
    const tarsDisabled = async () => mainRead<boolean>('keybase.1.teams.getTarsDisabled', {teamID})
    check(!(await masked(tarsDisabled)), 'a new subteam does not allow requests')
    await openSubteamUntil("the subteam's settings", name, teamID, SETTINGS, settingsLoaded)
    const onSubteam = (p: Params) => p['teamID'] === teamID

    await dragUntilOnScreen("the settings' requests switch", () => el(T.settingTestID(T.TEAMS_SETTINGS_IGNORE_REQUESTS, false)))
    const seq = await currentCallSeq()
    await switchOn('the requests switch', T.TEAMS_SETTINGS_IGNORE_REQUESTS, async () =>
      requireOnSubteam("the subteam's settings", 'team', onSubteam)
    )
    await waitForUiCall('the setting to go out', seq, 'keybase.1.teams.setTarsDisabled')
    await expectHost('requests not allowed', tarsDisabled, d => d)
    await step("Requests to join not allowed")

    await expectPersists(
      "the subteam's requests switch",
      async () => {
        // the switch draws off until the team's settings load
        await openSubteamUntil("the subteam's settings after the relaunch", name, teamID, SETTINGS, async () => {
          await dragUntilOnScreen("the settings' requests switch", () =>
            browser.$(`${settingSelector(T.TEAMS_SETTINGS_IGNORE_REQUESTS)} AND visible == 1`)
          )
          await el(T.settingTestID(T.TEAMS_SETTINGS_IGNORE_REQUESTS, true)).waitForExist({timeout: 15_000})
        })
        return (await settingShown(T.TEAMS_SETTINGS_IGNORE_REQUESTS)) === 'on'
      },
      true
    )
    creditSurface('relaunch')
    await step('Still not allowed after a relaunch', {card: true})
  })

  it("a subteam's message deletion set to 30 days through the warning", async function () {
    // worst case (s): subteam 915, host 315 (the policy), opened 230, pick 72, warning 41 (its pin
    // 1), calls 2, waited for 12, polled 345, the dropdown's label 11 (10, one read 1), step 2 = 1945
    this.timeout(2_000_000)
    const {name, teamID} = await makeOwnSubteamWithID('ret', madeNames)
    const policy = async () => mainRead<Policy>('chat.1.local.getTeamRetentionLocal', {teamID})
    check(((await masked(policy))?.typ ?? retain) === retain, 'a new subteam deletes messages')
    await openSubteamUntil("the subteam's settings", name, teamID, SETTINGS, settingsLoaded)
    // a subteam with one channel is a small team

    await pickRetention('Never auto-delete', '30 days')
    let seq: CallMark | undefined
    await confirmWarning('small team', async () => {
      await requireUnder("the subteam's message deletion", 'retentionWarning', r => r.name === 'team' && r.teamID === teamID)
      seq = await currentCallSeq()
    })
    if (!seq) throw new Error('the warning was confirmed before its call-log mark was taken')
    await waitForUiCall('the policy to go out', seq, 'chat.1.local.setTeamRetentionLocal')
    await expectHost('the policy of 30 days', policy, p => p?.expire?.age === thirtyDays)
    await waitFor('the dropdown to show 30 days', async () => ((await retentionShows('30 days')) ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
    await step('Messages deleted after 30 days', {card: true})
  })

  it("a channel's message deletion set to 30 days from the chat info panel", async function () {
    // worst case (s): subteam 600, seed 510, the channel's policy 315, open 100, panel 25, pick 72,
    // warning 41 (its pin 1), calls 2, waited for 12, polled 345, step 2 = 2024
    this.timeout(2_100_000)
    const {name} = await makeOwnSubteam('cre', madeNames)
    const channel = stampedChannelName('ret', e2eRunId())
    const convID = await masked(async () => makeSubteamChannel(name, channel))
    const policy = async () => {
      const res = await mainRead<{conversations?: Array<{convRetention?: Policy}> | null}>('chat.1.local.getInboxAndUnboxLocal', {
        identifyBehavior: 6, // chatSkip
        query: {computeActiveList: false, convIDs: [convIDBytes(convID)], readOnly: true, unreadOnly: false},
      })
      return res.conversations?.[0]?.convRetention ?? null
    }
    check(((await masked(policy))?.typ ?? inherit) === inherit, 'a new channel does not follow its team')

    await openConversation(convID)
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    await pickRetention('Team default (Never)', '30 days')
    let seq: CallMark | undefined
    await confirmWarning('channel', async () => {
      await requireUnder("the channel's message deletion", 'retentionWarning', r => r.conversationIDKey === convID)
      seq = await currentCallSeq()
    })
    if (!seq) throw new Error('the warning was confirmed before its call-log mark was taken')
    await waitForUiCall('the policy to go out', seq, 'chat.1.local.setConvRetentionLocal')
    await expectHost("the channel's policy of 30 days", policy, p => p?.expire?.age === thirtyDays)
    await step("The channel's messages deleted after 30 days", {card: true})
  })

  it('a channel added to a subteam\'s default channels from the popup, and removed from its pill', async function () {
    // worst case (s): subteam 915, seed 510, host 315 (the defaults), opened 250 (team 109, tab 24,
    // on screen 20, overrun by one try), its press 2, the channel 12 (10 of reads and drags, overrun
    // by one 2) and its press 2, text 6, step 2, pin 1, calls 2, its press 2, waited for 12, polled
    // 345, the pill 6, the remove read 1, step 2, pin 1, calls 2, its tap 1, waited for 12, polled
    // 345, the pill gone 11 (10, one read 1), step 2 = 2766
    this.timeout(2_800_000)
    const {name, teamID} = await makeOwnSubteamWithID('dch', madeNames)
    const channel = stampedChannelName('dflt', e2eRunId())
    await masked(async () => makeSubteamChannel(name, channel))
    const defaults = async () =>
      ((await mainRead<{convs?: Array<{channel: string}> | null}>('chat.1.local.getDefaultTeamChannelsLocal', {teamID})).convs ?? []).map(
        c => c.channel
      )
    check(!(await masked(defaults)).includes(channel), 'a new channel is a default one')
    const addChannels = async () => elementWithLabelPartIn(NAMED_ELEMENT_TYPES, 'Add channels', "the default channels' Add channels", {forTap: true})
    // a team with more than one channel draws its default channels; the app sees the host's channel
    // once it loads the team afresh
    await openSubteamUntil("the subteam's default channels", name, teamID, SETTINGS, async () =>
      // not by `visible`: a team page reads invisible now and then. Its box merges its icon and text
      // (", Add channels"), and the text is not always in the tree on its own.
      dragUntilOnScreen('the default channels', () =>
        browser.$('-ios predicate string:label == "Add channels" OR label ENDSWITH ", Add channels"')
      )
    )
    const onSubteam = (p: Params) => p['teamID'] === teamID

    await press(await addChannels(), "the default channels' Add channels")
    // the popup hugs its rows up to the screen's height; a row below the screen's bottom is dragged up
    // until it shows
    const pick = await waitFor(
      'the channel in the popup',
      async () => {
        const found = await elementWithLabelPartIn(NAMED_ELEMENT_TYPES, `#${channel}`, 'the channel in the popup', {forTap: true}).catch(() => undefined)
        if (found && (await onScreen(found))) return found
        const {height} = await browser.getWindowRect()
        await drag(height - 80, height - 380)
        return undefined
      },
      {interval: 250, timeout: 10_000}
    )
    await press(pick, 'the channel in the popup')
    // the subteam has #general (hidden here) and this channel alone: one picked is this one
    const add = await textShown('Add (1)', "the popup's Add with one channel picked", 5_000, {forTap: true})
    await step('The channel picked')
    await requireOnSubteam("the subteam's default channels", 'team', onSubteam)
    let seq = await currentCallSeq()
    await press(add, "the popup's Add")
    await waitForUiCall('the default channels to go out', seq, 'chat.1.local.setDefaultTeamChannelsLocal')
    await expectHost('the channel among the default channels', defaults, d => d.includes(channel))
    await textShown(`#${channel}`, "the channel's pill")
    await step('A default channel added', {card: true})

    // #general's pill has no remove: the one remove drawn is this channel's
    const removes = await browser.$$(`~${T.TEAMS_DEFAULT_CHANNEL_REMOVE}`).getElements()
    check(removes.length === 1, `${removes.length} default channel removes drawn, not one`)
    await requireOnSubteam("the subteam's default channels", 'team', onSubteam)
    seq = await currentCallSeq()
    await removes[0]!.click()
    await waitForUiCall('the default channels to go out', seq, 'chat.1.local.setDefaultTeamChannelsLocal')
    await expectHost('the channel no longer a default one', defaults, d => !d.includes(channel))
    // both counted off one page source: none of the channel's, and #general's drawn in the same read
    const pills = async () => {
      const drawn = sourceElements(await browser.getPageSource()).filter(e => NAMED_ELEMENT_TYPES.includes(e.type) && e.attrs['visible'] === 'true')
      const count = (label: string) =>
        innermost(
          drawn
            .filter(e => (e.attrs['label'] ?? '').replace(/\u00a0/g, ' ') === label)
            .map(e => sourceRect(e.attrs))
        ).length
      return {general: count('#general'), mine: count(`#${channel}`)}
    }
    await waitFor(
      "the channel's pill to go, with #general's still drawn",
      async () => {
        const {general, mine} = await pills()
        return general >= 1 && mine === 0 ? true : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    await step('The default channel removed')
  })

  it("a host-seeded emoji given an alias from its row's menu, then the alias and the emoji deleted", async function () {
    // worst case (s):
    // setup: subteam 915, host 255 (the seed), polled 345, opened 224 (team 109, tab 24, the row 31,
    //   overrun by one try) = 1739;
    // alias: row 31, in row 2, menu 19, item 22, screen 11, field 11, fill 26, step 2, pin 1, calls 2,
    //   button 6, waited for 12, polled 345, page 21, row 31, step 2 = 544;
    // deletes, each: row 31, in row 2, menu 19, pin 1, calls 2, item 22, waited for 12, polled 345 =
    //   434, twice = 868; the row gone 11, step 2 = 13
    // = 1739 + 544 + 868 + 13 = 3164
    this.timeout(3_200_000)
    const runId = e2eRunId()
    const {generalConvID, name, teamID} = await makeOwnSubteamWithID('emo', madeNames)
    const seed = stampedEmojiName('s', runId)
    const alias = stampedEmojiName('b', runId)
    type UserEmojiRes = {emojis?: {emojis?: Array<{name: string; emojis?: Array<{alias: string}> | null}> | null}}
    // the aliases of the subteam's emoji, as the main service lists them for the smoke account
    const teamEmojis = async () => {
      const res = await mainRead<UserEmojiRes>('chat.1.local.userEmojis', {
        convID: null,
        opts: {getAliases: true, getCreationInfo: false, onlyInTeam: false},
      })
      return (res.emojis?.emojis ?? [])
        .filter(g => g.name === name)
        .flatMap(g => (g.emojis ?? []).map(e => e.alias))
        .sort()
    }
    const same = (want: Array<string>) => (got: Array<string>) => got.length === want.length && got.every((a, i) => a === [...want].sort()[i])
    requireThisRunSubteam(name)
    await masked(async () =>
      runChatApi('emojiadd', {alias: seed, channel: {members_type: 'team', name, topic_name: 'general'}, filename: `${CORPUS_DIR}/e2e-c.png`})
    )
    await expectHost('the seeded emoji', teamEmojis, same([seed]))
    const emojiRow = async (a: string, timeout = 30_000) => filesRowNamed(`:${a}:`, 'an emoji row', {testID: T.TEAMS_EMOJI_ROW, timeout})
    // the tab lists a team's emoji once it has loaded them afresh
    await openSubteamUntil("the subteam's emoji", name, teamID, EMOJI, async () => emojiRow(seed, 10_000))
    const onSubteam = (p: Params) => p['teamID'] === teamID

    // -- an alias from the seeded emoji's menu ------------------------------------------------------
    const seedRow = await emojiRow(seed)
    const seedMenu = await elementInRow(seedRow.rect, T.TEAMS_EMOJI_ROW_MENU)
    await openMenuFrom("the emoji's menu", async () => seedMenu.click())
    await chooseMenuItem('Add alias')
    const onGeneral = (p: Params) => p['conversationIDKey'] === generalConvID
    await expectScreen("the emoji's Add alias", 'teamAddEmojiAlias', onGeneral)
    await fillField(await onlyField('TextField', 'the alias field'), alias, 'the alias field')
    await step('The alias typed')
    await requireOnSubteam('Add alias', 'teamAddEmojiAlias', onGeneral)
    let seq = await currentCallSeq()
    await tapButton('Add an alias', "Add alias's Add an alias")
    await waitForUiCall('the alias to go out', seq, 'chat.1.local.addEmojiAlias')
    await expectHost('the alias', teamEmojis, same([seed, alias]))
    await expectTeamPage('the subteam page after the alias', teamID)
    await emojiRow(alias)
    await step('The alias added', {card: true})

    // -- the alias, then the emoji, deleted from their menus -----------------------------------------
    const deleteFromMenu = async (a: string, item: string, left: Array<string>) => {
      const row = await emojiRow(a)
      const menu = await elementInRow(row.rect, T.TEAMS_EMOJI_ROW_MENU)
      await openMenuFrom("an emoji's menu", async () => menu.click())
      await requireOnSubteam("the subteam's emoji", 'team', onSubteam)
      seq = await currentCallSeq()
      await chooseMenuItem(item)
      await waitForUiCall('the delete to go out', seq, 'chat.1.local.removeEmoji')
      await expectHost(`the emoji after ${item}`, teamEmojis, same(left))
    }
    await deleteFromMenu(alias, 'Delete alias', [seed])
    await deleteFromMenu(seed, 'Delete emoji', [])
    // the phone draws no emoji header: the tab's Add emoji, at its top, is its anchor
    await waitFor(
      "the seeded emoji's row to go, with the tab's Add emoji still drawn",
      async () => {
        const anchor = await buttonLabelled('Add emoji', "the tab's Add emoji").then(() => true, () => false)
        const rows = await browser.$$(`-ios predicate string:name == "${T.TEAMS_EMOJI_ROW}" AND visible == 1`).getElements()
        let seedDrawn = false
        for (const r of rows) {
          if (labelHas((await r.getAttribute('label').catch(() => null)) ?? '', `:${seed}:`)) seedDrawn = true
        }
        return anchor && !seedDrawn ? true : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    await step('The alias and the emoji deleted')
  })
})

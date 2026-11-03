// What the phone sends to manage a team's bots: the second account installed as a restricted bot in
// one channel of a team, from the team's Bots tab, then edited to read every channel, offered for
// another conversation from a message it posts, and uninstalled.
//
// Everything happens in a subteam of KB_E2E_TEAM that this test makes, stamped with the run id, and
// that the flow's afterEach deletes, after a timeout too (the bot goes with it). The second account
// is never in it other than as that bot. The host stays on the smoke account: it makes and deletes
// the subteam and reads back the second account's role and the channels it reads. The bot's message
// comes from the second account's peer service.
import {randomBytes} from 'crypto'
import {createThrowawaySubteam, deleteThrowawaySubteam, ensureChatData, type ChatData} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {convIDBytes} from '../../shared/conv-id.ts'
import {mainRpc} from '../../shared/main-rpc.ts'
import {sendWithRetry} from '../../shared/peer-actors'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {requireSecondNotBlocked} from '../gate/blocks'
import {openLink} from '../gate/device'
import {labelParts, sourceElements} from '../gate/page-source-lib'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {closeMessageMenu, hideKeyboard, openConversation, openMessageMenu, typeInSearchFilter, waitForRow} from '../helpers/chat'
import {expectScreen, visibleScreen} from '../gate/screens'
import {
  check,
  chooseMenuItem,
  elementWithLabelPartIn,
  menuHas,
  NAMED_ELEMENT_TYPES,
  openMenuFrom,
  tapButton,
} from '../helpers/menus'
import {expectHost, secondSender} from '../helpers/chat-host'
import {el, els, tapForTestID} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'

// TeamRole in the protocol
const restrictedBot = 6

describe('chat bots', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   subteam   createThrowawaySubteam 600 (two CLI calls of up to four tries of 60 with 5s pauses,
  //             255 each, then its channel listed 90)
  //   host      one host read 75 (whoami 15, the call 60);  polled  20, overrun by one read = 95
  //   page      the team page: the link 1, its screen 20;  bots tab  tapForTestID 16 (three taps of 5)
  //   button    one exact-label button found 5 and tapped 1 = 6;  named  a row by name, polled 15
  //   menu      openMenuFrom 15 + chooseMenuItem 20 = 35;  message menu  its item offered, 30 a try
  //   screen    a screen's route or marker 10;  gone  a modal gone 20;  label  the dropdown's 1
  //   picker    the dropdown tapped 1, the picker 10, All channels 6, a channel 6, Done 6, gone 5 = 34
  //   calls     the recorder's call log, waited for 10;  seq  2;  type  15
  //   peer      the peer found 45 and a failing call's diagnosis 25 = 70;  peer send  sendWithRetry
  //             90 (30, overrun by one send's 60)
  //   open      openConversation 100;  row  waitForRow 30;  escape  escapeToTabs 30
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // the bot's own message needs the second account unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  // -- host reads ---------------------------------------------------------------------------------

  const roleIn = async (convID: string) =>
    mainRpc<number>('chat.1.local.getTeamRoleInConversation', {convID: convIDBytes(convID), username: data.secondUser})
  // the channels a restricted bot reads, by conversation id; none means every channel
  const botConvs = async (convID: string) =>
    (
      await mainRpc<{convs?: Array<string> | null}>('chat.1.local.getBotMemberSettings', {
        convID: convIDBytes(convID),
        username: data.secondUser,
      })
    ).convs ?? []

  type SubteamList = Array<{id: string; name: {parts: Array<string> | null}}> | null
  const subteams = async () =>
    (await mainRpc<SubteamList>('keybase.1.teams.teamListSubteamsRecursive', {
      forceRepoll: true,
      parentTeamName: data.team,
      sessionID: 0,
    })) ?? []
  const subteamID = async (name: string) => (await subteams()).find(t => (t.name.parts ?? []).join('.') === name)?.id

  // -- what the afterEach puts back ---------------------------------------------------------------

  // the subteam a test made; the bot goes with it
  let subteam: string | undefined

  // Bound: host 75, the delete 105, its read polled 105 (30, overrun by one host read's 75) = 285.
  const deleteSubteam = async () => {
    if (subteam === undefined) return
    const name = subteam
    // an earlier run of this restore may have deleted it and failed after
    if ((await subteamID(name)) !== undefined) await deleteThrowawaySubteam(name)
    await waitFor('the host to read the subteam gone', async () => ((await subteamID(name)) === undefined ? true : undefined), {
      interval: 1_000,
      timeout: 30_000,
    })
    subteam = undefined
  }

  // Worst case (s): close 19, keyboard 5, the subteam 285, escape 30 = 339.
  afterEach(async function () {
    this.timeout(340_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, deleteSubteam, escapeToTabs])
  })

  // -- the phone ----------------------------------------------------------------------------------

  // Refuses, before any tap that writes, unless the screen up is `name` for the second account and
  // aims at the throwaway subteam: its team id, or its general channel. Bound: one route read 1.
  const requireOnSubteam = async (what: string, name: string, teamID: string, generalConvID: string) => {
    const s = await visibleScreen()
    const p = s?.params ?? {}
    check(
      s?.name === name && p['botUsername'] === data.secondUser && (p['teamID'] === teamID || p['conversationIDKey'] === generalConvID),
      `${what} is not aimed at the throwaway subteam: not tapping`
    )
  }

  // The team page of the subteam `teamID` names, on its Bots tab. Bound: page 21, bots tab 16.
  const openBotsTab = async (name: string, teamID: string) => {
    try {
      openLink(`keybase://team-page/${name}`)
    } catch (e) {
      if (isAttemptOver(e)) throw e
      // no cause: the command's own error spells out the link, which holds the team's name
      // eslint-disable-next-line preserve-caught-error
      throw new Error("the subteam's team page link did not open")
    }
    await waitFor(
      "the subteam's team page",
      async () => {
        const s = await visibleScreen()
        return s?.name === 'team' && s.params?.['teamID'] === teamID ? true : undefined
      },
      {interval: 250, timeout: 20_000}
    )
    await tapForTestID(T.TEAMS_TAB_BOTS_BUTTON, T.TEAMS_BOTS_TAB)
  }

  // The one bot row's menu in the subteam's Bots tab (the second account is its only bot), with the
  // row's name the second account's. Bound: the row 20, its name 5 (one page source).
  const botRowMenu = async () => {
    await waitFor('the bot row', async () => ((await els(T.TEAMS_BOT_ROW_MENU).length) === 1 ? true : undefined), {
      interval: 500,
      timeout: 20_000,
    })
    // the row reads "<name> • by @<name>": the name shows in the menu's row, once or twice
    const menu = el(T.TEAMS_BOT_ROW_MENU)
    const {y} = await menu.getLocation()
    const {height} = await menu.getSize()
    const mid = y + height / 2
    const named = sourceElements(await browser.getPageSource()).filter(e => {
      const label = (e.attrs['label'] ?? '').replace(/\u00a0/g, ' ')
      const top = Number(e.attrs['y'])
      const bottom = top + Number(e.attrs['height'])
      return (
        NAMED_ELEMENT_TYPES.includes(e.type) &&
        e.attrs['visible'] === 'true' &&
        top <= mid &&
        bottom >= mid &&
        label.split(/, | • by @| • /).some(part => part.trim() === data.secondUser)
      )
    })
    if (!named.length) throw new Error("the bot row does not show the second account's name")
    return menu
  }

  // The install screen's channels dropdown reads `want`: one part of its label (the team's name and
  // `want`; its arrow's glyph can follow as a part of its own) ends with it.
  const channelsRead = async (want: string) => {
    const label = (await el(T.CHAT_BOT_CHANNELS_BUTTON).getAttribute('label')) ?? ''
    return labelParts(label).some(part => part.endsWith(want))
  }
  const expectChannels = async (want: string) => {
    await el(T.CHAT_BOT_CHANNELS_BUTTON).waitForExist({timeout: 10_000})
    await waitFor(`the channels dropdown to read ${want}`, async () => ((await channelsRead(want)) ? true : undefined), {
      interval: 250,
      timeout: 5_000,
    })
  }

  // In the install screen: opens the channels picker, toggles All channels (on for a new install,
  // off for one in a channel), and with `channel` picks it too; then closes the picker. Bound: picker 34.
  const pickChannels = async (channel?: string) => {
    await el(T.CHAT_BOT_CHANNELS_BUTTON).click()
    await el(T.CHAT_BOT_CHANNEL_PICKER).waitForExist({timeout: 10_000})
    await (await elementWithLabelPartIn(NAMED_ELEMENT_TYPES, 'All channels', 'the All channels row')).click()
    if (channel) {
      // a channel row reads "#" and its name
      await (await elementWithLabelPartIn(NAMED_ELEMENT_TYPES, channel, `the #${channel} row`)).click()
    }
    await tapButton('Done', "the picker's Done")
    await el(T.CHAT_BOT_CHANNEL_PICKER).waitForExist({reverse: true, timeout: 5_000})
  }

  it('the second account installed as a restricted bot in one channel, edited to all channels, offered elsewhere, and uninstalled', async function () {
    // worst case (s): subteam 600, host 75 (its id), host 75 (no role) = 750;
    // install: page 21, bots tab 16, button 6, type 21 (typeInSearchFilter), keyboard 5, named 15, the
    //   tap 1, screen 10,
    //   the restricted label 10, button 6, the dropdown 15 (its marker 10, label 5), picker 34, the
    //   dropdown 15, step 2, the pin 1, seq 2, button 6, gone 20, calls 10, the row 25 (20, its name
    //   5), polled 95, host 75, step 2 = 413;
    // edit: the row 25, menu 35, screen 10, the pin 1, the edit button steady 20, the tap 1, the
    //   dropdown 15, picker 34, the dropdown 15, the pin 1, seq 2, button 6, gone 20, calls 10, polled
    //   95, step 2 = 292;
    // offer: peer 70, peer send 90, open 100, row 30, message menu 79 (30, overrun by one try: its
    //   open 15, its items read 15 and close 19), menu 15, seq 2, the item 20, screen 10, type 21
    //   (typeInSearchFilter), named 15, calls 10, step 2, escape 30 = 494;
    // uninstall: page 21, bots tab 16, the row 25, menu 35, screen 10, the pin 1, seq 2, button 6,
    //   calls 10, polled 95, the row gone 20, step 2 = 243
    // = 750 + 413 + 292 + 494 + 243 = 2192
    this.timeout(2_250_000)
    // a deleted team's name is not free again, so each attempt in a run takes its own
    const made = await createThrowawaySubteam(`bot${randomBytes(2).toString('hex')}`)
    subteam = made.name
    const {generalConvID, name} = made
    const teamID = await subteamID(name)
    if (!teamID) throw new Error('the host does not list the subteam this test made')
    check((await roleIn(generalConvID)) === 0, 'the second account has a role in a new subteam')

    // -- install, restricted to general ------------------------------------------------------------
    await openBotsTab(name, teamID)
    check((await els(T.TEAMS_BOT_ROW_MENU).length) === 0, "a new subteam's Bots tab lists a bot")
    await tapButton('Install bots', "the Bots tab's Install bots")
    await typeInSearchFilter(data.secondUser)
    // the first tap with the keyboard up only puts it away
    await hideKeyboard()
    const result = await waitFor(
      'the second account among the users found',
      async () => elementWithLabelPartIn(NAMED_ELEMENT_TYPES, data.secondUser, 'the second account among the results'),
      {interval: 500, timeout: 15_000}
    )
    await result.click()
    await expectScreen('the install screen of the second account', 'chatInstallBot', p => p['botUsername'] === data.secondUser)
    // a new install is a restricted bot unless changed: the dropdown reads it first, then its
    // description
    await browser
      .$('-ios predicate string:label == "Restricted bot (recommended)" OR label BEGINSWITH "Restricted bot (recommended), "')
      .waitForExist({timeout: 10_000, timeoutMsg: 'the install screen does not offer a restricted bot'})
    await tapButton('Review', "the install screen's Review")
    await expectChannels('(all channels)')
    await pickChannels('general')
    await expectChannels('(#general)')
    await step('The install screen: a restricted bot in #general')

    await requireOnSubteam('the install screen', 'chatInstallBot', teamID, generalConvID)
    let seq = await currentCallSeq()
    await tapButton('Install', "the install screen's Install")
    await el(T.CHAT_BOT_INSTALL).waitForExist({reverse: true, timeout: 20_000})
    await waitForUiCall('the install to go out', seq, 'chat.1.local.addBotMember')
    await botRowMenu()
    await expectHost("the second account's role as a restricted bot", async () => roleIn(generalConvID), r => r === restrictedBot)
    const convs = await botConvs(generalConvID)
    check(convs.length === 1 && convs[0] === generalConvID, 'the bot does not read #general alone')
    await step('Installed: the Bots tab lists the bot, and the host reads it restricted to #general')

    // -- edit to all channels ----------------------------------------------------------------------
    const menu = await botRowMenu()
    await openMenuFrom('the bot row menu', async () => menu.click())
    await chooseMenuItem('Edit settings')
    await el(T.CHAT_BOT_INSTALL).waitForExist({timeout: 10_000})
    await requireOnSubteam('the edit screen', 'chatInstallBot', teamID, generalConvID)
    // enabled once the bot's settings and the channels are in; a reload of either disables it again
    // for a moment, so the one tap waits until it has stayed enabled for a second
    const edit = el(T.CHAT_BOT_EDIT_BUTTON)
    let enabledSince = 0
    await waitFor(
      'the Edit settings button to stay enabled',
      async () => {
        const on = (await edit.isExisting()) && (await edit.isEnabled())
        if (!on) enabledSince = 0
        else if (!enabledSince) enabledSince = Date.now()
        return enabledSince && Date.now() - enabledSince >= 1_000 ? true : undefined
      },
      {interval: 250, timeout: 20_000}
    )
    await edit.click()
    await expectChannels('(#general)')
    await pickChannels()
    await expectChannels('(all channels)')
    await requireOnSubteam('the edit screen', 'chatInstallBot', teamID, generalConvID)
    seq = await currentCallSeq()
    await tapButton('Save', "the edit screen's Save")
    await el(T.CHAT_BOT_INSTALL).waitForExist({reverse: true, timeout: 20_000})
    await waitForUiCall('the edit to go out', seq, 'chat.1.local.setBotMemberSettings')
    await expectHost('the bot reading every channel', async () => botConvs(generalConvID), c => c.length === 0)
    await step('Edited: the host reads the bot on all channels')

    // -- a message the bot posts offers to install it elsewhere --------------------------------------
    const text = e2eMarker('bot')
    await sendWithRetry(await secondSender(), generalConvID, text)
    await openConversation(generalConvID)
    await waitForRow(text, 30_000)
    // the menu offers the install once the app has the bot among the team's members
    await waitFor(
      'the message menu to offer installing the bot',
      async () => {
        await openMessageMenu(text)
        const offered = await menuHas('Install bot in another team or chat')
        await closeMessageMenu()
        return offered ? true : undefined
      },
      {interval: 2_000, timeout: 30_000}
    )
    // menuHas read the sheet to its end; the pick starts from a sheet opened afresh
    await openMessageMenu(text)
    seq = await currentCallSeq()
    await chooseMenuItem('Install bot in another team or chat')
    await expectScreen('the place picker for the bot', 'chatInstallBotPick', p => p['botUsername'] === data.secondUser)
    await typeInSearchFilter(name)
    await waitFor(
      'the subteam among the places to install it',
      async () => elementWithLabelPartIn(NAMED_ELEMENT_TYPES, name, 'the subteam among the places'),
      {interval: 500, timeout: 15_000}
    )
    await waitForUiCall('the place search to go out', seq, 'chat.1.local.addBotConvSearch')
    await step('The bot offered for another team or chat')
    await escapeToTabs()

    // -- uninstall ---------------------------------------------------------------------------------
    await openBotsTab(name, teamID)
    const row = await botRowMenu()
    await openMenuFrom('the bot row menu', async () => row.click())
    await chooseMenuItem('Uninstall')
    await expectScreen('the uninstall confirm', 'chatConfirmRemoveBot', p => p['botUsername'] === data.secondUser)
    await requireOnSubteam('the uninstall confirm', 'chatConfirmRemoveBot', teamID, generalConvID)
    seq = await currentCallSeq()
    await tapButton('Uninstall', "the confirm's Uninstall")
    await waitForUiCall('the uninstall to go out', seq, 'chat.1.local.removeBotMember')
    await expectHost("the second account's role gone", async () => roleIn(generalConvID), r => r === 0)
    await waitFor('the bot row to go', async () => ((await els(T.TEAMS_BOT_ROW_MENU).length) === 0 ? true : undefined), {
      interval: 500,
      timeout: 20_000,
    })
    await step('Uninstalled: no bot in the Bots tab, and the host reads no role', {card: true})
  })
})

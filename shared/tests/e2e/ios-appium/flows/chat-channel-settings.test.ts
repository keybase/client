// A team channel's membership and settings, changed from the phone: joining a channel the smoke
// account left (from Browse all channels), adding the second account to one, the minimum role to
// post, the channel's mobile notification setting, and leaving a channel from its info panel.
//
// Each acts on a throwaway channel of KB_E2E_TEAM this run made. The host stays on the smoke account
// (the team owner): it makes, leaves and deletes the channels, and reads every change back through
// the CLI or the main service. What a test changes is put back by the flow's afterEach, after a
// timeout too, and read back: the minimum role, the notification setting, then the channel itself.
import {
  E2E_CHANNELS,
  channelMembersFromCli,
  ensureChatData,
  leaveChannelFromCli,
  minWriterRoleFromCli,
  setMinWriterRoleFromCli,
  type ChatData,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {convIDBytes} from '../../shared/conv-id.ts'
import {mainConversation, mainRpc} from '../../shared/main-rpc.ts'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {requireSecondNotBlocked} from '../gate/blocks'
import {notifyChoiceOf} from '../gate/chat-lib'
import {labelHas} from '../gate/page-source-lib'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {retriedNavigation, step} from '../gate/step'
import {
  appInboxLists,
  closeMessageMenu,
  dragUntilOnScreen,
  expectPersists,
  hideKeyboard,
  iconButton,
  inboxHasRow,
  type NotifyChoice,
  notifyRadioBox,
  notifyRadioChosen,
  openConversation,
  openInfoPanel,
  scrollInboxTo,
  searchFilter,
  tapControlIn,
  tapNotifyRadio,
  typeInSearchFilter,
  visibleConversation,
} from '../helpers/chat'
import {check, chooseMenuItem, elementWithLabelPartIn, openMenuFrom} from '../helpers/menus'
import {expectHost, throwawayChannels} from '../helpers/chat-host'
import {el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'

describe('chat channel settings', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  row  scrollInboxTo 120;  absent  inboxHasRow 120 (the same scroll)
  //   panel     openInfoPanel 25 (the header menu 15, a tab 10);  gear  openMenuFrom 15;  item
  //             chooseMenuItem 20;  on screen  dragUntilOnScreen 20;  keyboard  5
  //   cli       a host CLI read 60, polled 80 (20, overrun by one read)
  //   conv      the host's read of a conversation 75 (whoami 15, the call 60), polled 95
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   relaunch  relaunchApp 200;  signed in  90
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120;  leave  the host's
  //             leave 60;  role  setMinWriterRoleFromCli 135 (the set 60, its read polled 15 and
  //             overrun by one read 60)
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // adding the second account needs it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  // -- reads --------------------------------------------------------------------------------------

  const expectMembers = async (what: string, topicName: string, ok: (members: Array<string>) => boolean) =>
    expectHost(what, async () => channelMembersFromCli(topicName), ok)

  // DeviceType.mobile, as the service keys a conversation's notification settings
  const mobile = '1'
  const savedMobile = async (convID: string) => notifyChoiceOf((await mainConversation(convID)).notifications?.settings?.[mobile])
  const expectSavedMobile = async (what: string, convID: string, want: NotifyChoice) =>
    expectHost(what, async () => savedMobile(convID), c => c === want)

  // -- what the afterEach puts back ---------------------------------------------------------------
  // Each is set before the change it undoes and cleared once its restore reads back.

  // throwaway channels a test made
  const channels = throwawayChannels()
  // a channel whose minimum role a test set
  let roleSetIn: string | undefined
  // a channel whose mobile notification setting a test changed, and the setting it had
  let notifyBefore: {convID: string; choice: NotifyChoice} | undefined

  // the menu offers no "none": the host clears it, and reads it back
  const clearRole = async () => {
    if (roleSetIn === undefined) return
    if (!/\bnot set\b/i.test(await minWriterRoleFromCli(roleSetIn))) await setMinWriterRoleFromCli(roleSetIn, 'none')
    roleSetIn = undefined
  }

  // Puts the mobile pair back through the host: every setting the conversation has is sent again,
  // with the mobile pair as it was.
  const restoreNotify = async () => {
    if (notifyBefore === undefined) return
    const {choice, convID} = notifyBefore
    if ((await savedMobile(convID)) !== choice) {
      const now = (await mainConversation(convID)).notifications
      const kinds: Record<string, boolean> = {'0': choice === 'onAnyActivity', '1': choice !== 'never'}
      const all = {...now?.settings, [mobile]: {...now?.settings?.[mobile], ...kinds}}
      const settings = Object.entries(all).flatMap(([deviceType, k]) =>
        Object.entries(k).map(([kind, enabled]) => ({deviceType: Number(deviceType), enabled, kind: Number(kind)}))
      )
      await mainRpc('chat.1.local.setAppNotificationSettingsLocal', {channelWide: now?.channelWide ?? false, convID: convIDBytes(convID), settings})
      await expectSavedMobile('the restored mobile notification setting', convID, choice)
    }
    notifyBefore = undefined
  }

  // Nothing a test changed left behind, after a timeout too: the host's restores first, then the
  // phone's screens. Worst case (s): close 19, keyboard 5, the role 195 (a read 60, the clear 135),
  // the notification setting 320 (a read 75, the current settings 75, the set 75, its poll 95), a
  // channel 120 (each test makes one), escapeToTabs 30 = 689.
  afterEach(async function () {
    this.timeout(720_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, clearRole, restoreNotify, channels.deleteAll, escapeToTabs])
  })

  // Browse all channels lists the team's channels with Join beside those the account is not in. The
  // list draws membership from what the app last heard, so until the host's leave reaches the app
  // the row still says In: the list is closed and opened again until it offers Join.
  it('a channel the account left is joined again from Browse all channels', async function () {
    // worst case (s): channel 240, leave 60, cli 80, the tries 60, overrun by one try 216
    // (escapeToTabs 30, open 100, the panel 15, gear 15, item 20, type 21 (typeInSearchFilter),
    // keyboard 5, the rows 10) = 276, step 2, the seq 2, the tap 5 (tapControlIn), calls 10, cli 80,
    // step 2, open 100, step 2 = 859
    this.timeout(900_000)
    const {convID, topicName} = await channels.make('join', {withSecond: false})
    await leaveChannelFromCli(topicName)
    await expectMembers('the account gone from the channel', topicName, m => !m.includes(data.smokeUser))

    // The phone's channel row is one element ("#<channel>, <icon>, <members>, Join, <icon>"): a tap on it previews
    // the channel, and its Join button has no element of its own, so it is tapped at its measured
    // frame (tapControlIn).
    const rowLabel = `#${topicName}, `
    let row: WebdriverIO.Element | undefined
    await retriedNavigation(
      'Join offered for the channel',
      async () => {
        await escapeToTabs()
        await openConversation(data.convIDs[E2E_CHANNELS.scratch])
        await openInfoPanel()
        await openMenuFrom("the channel's menu", async () => el(T.CHAT_INFO_PANEL_MENU_BUTTON).click())
        await chooseMenuItem('Browse all channels')
        await typeInSearchFilter(topicName)
        await hideKeyboard()
        const rows: Array<WebdriverIO.Element> = []
        for (const r of await browser.$$('-ios predicate string:type == "XCUIElementTypeOther" AND visible == 1').getElements()) {
          const label = (await r.getAttribute('label').catch(() => null)) ?? ''
          // its parts: the name, icons (glyphs), the member count, the button's label, the "…" icon
          if (label.startsWith(rowLabel) && labelHas(label, 'Join')) rows.push(r)
        }
        if (rows.length !== 1) throw new Error(`${rows.length} rows of the channel offering Join, not one`)
        row = rows[0]
      },
      {intervals: [2_000], timeout: 60_000}
    )
    await step('Browse all channels offers Join')
    const seq = await currentCallSeq()
    await tapControlIn(row!, {prop: 'channelMeta.channelname', value: topicName}, 'Join')
    await waitForUiCall('the join to go out', seq, 'chat.1.local.joinConversationByIDLocal')
    await expectMembers('the account in the channel', topicName, m => m.includes(data.smokeUser))
    await step('Joined')

    // a member opens the channel to its composer (openConversation waits for it), not a preview
    await openConversation(convID)
    await step('The joined channel opens with its composer', {card: true})
  })

  it('the second account is added to a channel from Add people', async function () {
    // worst case (s): channel 240, cli 60, open 100, the panel 15, the button 10, its menu 15, item
    // 20, type 21 (typeInSearchFilter), keyboard 5, the row 10, the tap 1, Add 5, step 2, the seq 2,
    // the tap 1, the filter gone 10, calls 10, cli 80, step 2 = 609
    this.timeout(640_000)
    const {convID, topicName} = await channels.make('add', {withSecond: false})
    check(!(await channelMembersFromCli(topicName)).includes(data.secondUser), 'the new channel already has the second account')
    await openConversation(convID)
    await openInfoPanel()
    const addPeople = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add people..." AND visible == 1')
    await addPeople().waitForExist({timeout: 10_000})
    await openMenuFrom('the add people menu', async () => addPeople().click())
    await chooseMenuItem('To channel')
    await typeInSearchFilter(data.secondUser)
    await hideKeyboard()
    // the member row, one element reading "<name>, " (", Already in, " once a member), found by the
    // name as a part of its label: compared in memory, polled while the search's results draw
    const member = await waitFor(
      'the second account in the member list',
      async () =>
        elementWithLabelPartIn(['XCUIElementTypeOther'], data.secondUser, 'the second account in the member list'),
      {interval: 500, timeout: 10_000}
    )
    await member.click()
    const add = browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add" AND enabled == 1 AND visible == 1')
    await add.waitForExist({timeout: 5_000})
    await step('The second account picked')
    const seq = await currentCallSeq()
    await add.click()
    await searchFilter().waitForExist({reverse: true, timeout: 10_000})
    await waitForUiCall('the add to go out', seq, 'chat.1.local.bulkAddToConv')
    await expectMembers('the second account in the channel', topicName, m => m.includes(data.secondUser))
    await step('The second account added', {card: true})
  })

  it('the minimum role to post set to Admin from its dropdown', async function () {
    // worst case (s): channel 240, cli 60, open 100, panel 25, on screen 20, gear 15, the seq 2, item
    // 20, calls 10, cli 80, step 2 = 574
    this.timeout(620_000)
    const {convID, topicName} = await channels.make('minwrtr', {withSecond: false})
    check(/\bnot set\b/i.test(await minWriterRoleFromCli(topicName)), 'a new channel has a minimum role')
    await openConversation(convID)
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    const dropdown = () => el(T.CHAT_MIN_WRITER_ROLE_DROPDOWN)
    await dragUntilOnScreen('the minimum role dropdown', dropdown)
    await openMenuFrom('the minimum role menu', async () => dropdown().click())
    roleSetIn = topicName
    const seq = await currentCallSeq()
    await chooseMenuItem('Admin')
    await waitForUiCall('the role to go out', seq, 'chat.1.local.setConvMinWriterRoleLocal')
    await expectHost('the minimum role admin', async () => minWriterRoleFromCli(topicName), r => /\badmin\b/i.test(r))
    await step('Minimum role to post: Admin', {card: true})
  })

  // The phone's own group of the two: the service keeps a pair per device type, and the phone's
  // panel shows both.
  it('the mobile notification setting is saved and stays through a relaunch', async function () {
    // worst case (s): channel 240, conv 75, open 100, panel 25, on screen 20, the chosen one 10, the
    // seq 2, the tap 21, calls 10, conv 95, the chosen one 10, step 2, relaunch 200, signed in 90,
    // open 100, panel 25, on screen 20, the chosen one 10, its read 1, step 2, on screen 20, the tap
    // 21, conv 95, step 2 = 1196
    this.timeout(1_240_000)
    const {convID} = await channels.make('notify', {withSecond: false})
    const original = await savedMobile(convID)
    check(original !== 'onWhenAtMentioned', 'a new channel starts with the mobile setting this test picks')
    notifyBefore = {choice: original, convID}
    const want: NotifyChoice = 'onWhenAtMentioned'

    const openNotifications = async () => {
      await openConversation(convID)
      await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
      await dragUntilOnScreen('the mobile notification choices', () => notifyRadioBox('mobile', 'never'))
    }
    const shown = async (choice: NotifyChoice) =>
      waitFor(`the panel to show the mobile choice ${choice}`, async () => ((await notifyRadioChosen('mobile')) === choice ? true : undefined), {
        interval: 250,
        timeout: 10_000,
      })

    await openNotifications()
    await shown(original)
    const seq = await currentCallSeq()
    await tapNotifyRadio('mobile', want)
    await waitForUiCall('the setting to go out', seq, 'chat.1.local.setAppNotificationSettingsLocal')
    await expectSavedMobile('the mobile setting saved', convID, want)
    await shown(want)
    await step('Mobile notifications: only when @mentioned')

    await expectPersists(
      'the mobile notification choice',
      async () => {
        await openNotifications()
        await shown(want)
        return notifyRadioChosen('mobile')
      },
      want
    )
    creditSurface('relaunch')
    await step('After a relaunch the panel still shows it', {card: true})

    // through the panel, as a person puts it back
    await dragUntilOnScreen('the mobile notification choices', () => notifyRadioBox('mobile', original))
    await tapNotifyRadio('mobile', original)
    await expectSavedMobile('the mobile setting put back', convID, original)
    await step('Put back from the panel')
  })

  it('Leave channel from the info panel goes back to the inbox, without the channel', async function () {
    // worst case (s): channel 240, cli 60, open 100, panel 25, on screen 20, step 2, the seq 2, the
    // tap 1, calls 10, the inbox 10, the screen 1, cli 80, row 120, absent 120, the layout 10, step 2
    // = 803
    this.timeout(820_000)
    const {convID, topicName} = await channels.make('leave', {withSecond: false})
    check((await channelMembersFromCli(topicName)).includes(data.smokeUser), 'the account is not in the new channel')
    await openConversation(convID)
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    const leave = () => iconButton('Leave channel')
    await dragUntilOnScreen('Leave channel', leave)
    await step('Leave channel in the info panel')
    const seq = await currentCallSeq()
    await leave().click()
    await waitForUiCall('the leave to go out', seq, 'chat.1.local.leaveConversationLocal')
    await el(T.CHAT_INBOX_LIST).waitForExist({timeout: 10_000})
    check((await visibleConversation()) !== convID, 'the left channel is still the screen shown')
    await expectMembers('the account gone from the channel', topicName, m => !m.includes(data.smokeUser))
    // e2e-scratch, a channel of the same team, shows the team's channels drawn
    await scrollInboxTo(`#${E2E_CHANNELS.scratch}`)
    check(!(await inboxHasRow(`#${topicName}`)), 'the left channel is still in the inbox')
    await waitFor("the app's inbox layout to drop the channel", async () => (!(await appInboxLists(convID)) ? true : undefined), {
      timeout: 10_000,
    })
    await step('Back in the inbox, without the channel', {screenshot: false})
  })
})

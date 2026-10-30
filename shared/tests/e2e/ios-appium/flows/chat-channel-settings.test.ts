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
  createThrowawayChannel,
  deleteThrowawayChannel,
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
import {callsSince, currentCallSeq} from '../gate/recorder'
import {retriedNavigation, step} from '../gate/step'
import {
  check,
  chooseMenuItem,
  closeMessageMenu,
  dragUntilOnScreen,
  expectPersists,
  hideKeyboard,
  inboxHasRow,
  labelledElement,
  notifyRadioBox,
  notifyRadioChosen,
  openConversation,
  openInfoPanel,
  openMenuFrom,
  scrollInboxTo,
  signedInAs,
  tapNotifyRadio,
  visibleConversation,
  type NotifyChoice,
} from '../helpers/chat'
import {el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'

describe('chat channel settings', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  row  scrollInboxTo 90;  absent  inboxHasRow 90 (the same scroll)
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
    this.timeout(20 * 60_000) // a first run seeds; later runs only check
    data = await ensureChatData()
    // adding the second account needs it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  // -- reads --------------------------------------------------------------------------------------

  const callsOf = async (seq: number, method: string) => (await callsSince(seq)).calls.filter(c => c.method === method)
  const waitForCall = async (what: string, seq: number, method: string) =>
    waitFor(what, async () => ((await callsOf(seq, method)).length > 0 ? true : undefined), {interval: 250, timeout: 10_000})

  const expectMembers = async (what: string, topicName: string, ok: (members: Array<string>) => boolean) =>
    waitFor(`the host to read ${what}`, async () => (ok(await channelMembersFromCli(topicName)) ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })

  const waitSignedIn = async () =>
    waitFor(
      'the relaunched app to sign in',
      async () => {
        const s = await signedInAs().catch(() => undefined)
        return s?.loggedIn && !s.switching ? true : undefined
      },
      {interval: 1_000, timeout: 90_000}
    )

  // DeviceType.mobile, as the service keys a conversation's notification settings
  const mobile = '1'
  const savedMobile = async (convID: string) => notifyChoiceOf((await mainConversation(convID)).notifications?.settings?.[mobile])
  const expectSavedMobile = async (what: string, convID: string, want: NotifyChoice) =>
    waitFor(`the host to read ${what}`, async () => ((await savedMobile(convID)) === want ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })

  // A text field whose placeholder reads "Search <n> <noun>" (the channel and member pickers' filters).
  const countedSearch = (noun: string) =>
    browser.$(
      `-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue BEGINSWITH "Search " AND (placeholderValue ENDSWITH " ${noun}" OR placeholderValue ENDSWITH " ${noun}s") AND visible == 1`
    )

  // -- what the afterEach puts back ---------------------------------------------------------------
  // Each is set before the change it undoes and cleared once its restore reads back.

  // throwaway channels a test made
  const channels = new Set<string>()
  // a channel whose minimum role a test set
  let roleSetIn: string | undefined
  // a channel whose mobile notification setting a test changed, and the setting it had
  let notifyBefore: {convID: string; choice: NotifyChoice} | undefined

  const newChannel = async (label: string) => {
    const made = await createThrowawayChannel(label, {withSecond: false})
    channels.add(made.topicName)
    return made
  }

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

  const deleteChannels = async () => {
    for (const topicName of [...channels]) {
      await deleteThrowawayChannel(topicName)
      channels.delete(topicName)
    }
  }

  // Nothing a test changed left behind, after a timeout too: the host's restores first, then the
  // phone's screens. Worst case (s): close 5, keyboard 5, the role 195 (a read 60, the clear 135),
  // the notification setting 320 (a read 75, the current settings 75, the set 75, its poll 95), a
  // channel 120 (each test makes one), escapeToTabs 30 = 675.
  afterEach(async function () {
    this.timeout(720_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, clearRole, restoreNotify, deleteChannels, escapeToTabs])
  })

  // Browse all channels lists the team's channels with Join beside those the account is not in. The
  // list draws membership from what the app last heard, so until the host's leave reaches the app
  // the row still says In: the list is closed and opened again until it offers Join.
  it('a channel the account left is joined again from Browse all channels', async function () {
    // worst case (s): channel 240, leave 60, cli 80, the tries 60, overrun by one try 215
    // (escapeToTabs 30, open 100, the panel 15, gear 15, item 20, the filter 10, type 15, keyboard 5,
    // the rows 5) = 275, step 2, the seq 2, the tap 1, calls 10, cli 80, step 2, open 100, step 2 = 854
    this.timeout(900_000)
    const {convID, topicName} = await newChannel('join')
    await leaveChannelFromCli(topicName)
    await expectMembers('the account gone from the channel', topicName, m => !m.includes(data.smokeUser))

    const channelText = `#${topicName}`
    let join: WebdriverIO.Element | undefined
    await retriedNavigation(
      'Join offered for the channel',
      async () => {
        await escapeToTabs()
        await openConversation(data.convIDs[E2E_CHANNELS.scratch])
        await openInfoPanel()
        await openMenuFrom("the channel's menu", async () => el(T.CHAT_INFO_PANEL_MENU_BUTTON).click())
        await chooseMenuItem('Browse all channels')
        await countedSearch('channel').waitForExist({timeout: 10_000})
        await countedSearch('channel').addValue(topicName)
        await hideKeyboard()
        // the channel's row, and the one Join button level with it
        const row = await labelledElement('-ios predicate string:type == "XCUIElementTypeStaticText" AND visible == 1', channelText, "the channel's row")
        const {y} = await row.getLocation()
        const {height} = await row.getSize()
        const level: Array<WebdriverIO.Element> = []
        for (const b of await browser.$$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Join" AND visible == 1').getElements()) {
          const at = await b.getLocation()
          const size = await b.getSize()
          const mid = at.y + size.height / 2
          if (mid >= y - 20 && mid <= y + height + 20) level.push(b)
        }
        if (level.length !== 1) throw new Error(`${level.length} Join buttons beside the channel, not one`)
        join = level[0]
      },
      {intervals: [2_000], timeout: 60_000}
    )
    await step('Browse all channels offers Join')
    const seq = await currentCallSeq()
    await join!.click()
    await waitForCall('the join to go out', seq, 'chat.1.local.joinConversationByIDLocal')
    await expectMembers('the account in the channel', topicName, m => m.includes(data.smokeUser))
    await step('Joined')

    // a member opens the channel to its composer (openConversation waits for it), not a preview
    await openConversation(convID)
    await step('The joined channel opens with its composer', {card: true})
  })

  it('the second account is added to a channel from Add people', async function () {
    // worst case (s): channel 240, cli 60, open 100, the panel 15, the button 10, its menu 15, item
    // 20, the filter 10, type 15, keyboard 5, the row 5, the tap 1, Add 5, step 2, the seq 2, the tap
    // 1, the filter gone 10, calls 10, cli 80, step 2 = 608
    this.timeout(640_000)
    const {convID, topicName} = await newChannel('add')
    check(!(await channelMembersFromCli(topicName)).includes(data.secondUser), 'the new channel already has the second account')
    await openConversation(convID)
    await openInfoPanel()
    const addPeople = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add people..." AND visible == 1')
    await addPeople().waitForExist({timeout: 10_000})
    await openMenuFrom('the add people menu', async () => addPeople().click())
    await chooseMenuItem('To channel')
    const filter = countedSearch('member')
    await filter.waitForExist({timeout: 10_000})
    await filter.addValue(data.secondUser)
    await hideKeyboard()
    // the member row, by the name it shows: compared in memory
    const member = await labelledElement('-ios predicate string:type == "XCUIElementTypeStaticText" AND visible == 1', data.secondUser, 'the second account in the member list')
    await member.click()
    const add = browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add" AND enabled == 1 AND visible == 1')
    await add.waitForExist({timeout: 5_000})
    await step('The second account picked')
    const seq = await currentCallSeq()
    await add.click()
    await filter.waitForExist({reverse: true, timeout: 10_000})
    await waitForCall('the add to go out', seq, 'chat.1.local.bulkAddToConv')
    await expectMembers('the second account in the channel', topicName, m => m.includes(data.secondUser))
    await step('The second account added', {card: true})
  })

  it('the minimum role to post set to Admin from its dropdown', async function () {
    // worst case (s): channel 240, cli 60, open 100, panel 25, on screen 20, gear 15, the seq 2, item
    // 20, calls 10, cli 80, step 2 = 574
    this.timeout(620_000)
    const {convID, topicName} = await newChannel('minwrtr')
    check(/\bnot set\b/i.test(await minWriterRoleFromCli(topicName)), 'a new channel has a minimum role')
    await openConversation(convID)
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    const dropdown = () => el(T.CHAT_MIN_WRITER_ROLE_DROPDOWN)
    await dragUntilOnScreen('the minimum role dropdown', dropdown)
    await openMenuFrom('the minimum role menu', async () => dropdown().click())
    roleSetIn = topicName
    const seq = await currentCallSeq()
    await chooseMenuItem('Admin')
    await waitForCall('the role to go out', seq, 'chat.1.local.setConvMinWriterRoleLocal')
    await waitFor('the host to read the minimum role admin', async () => (/\badmin\b/i.test(await minWriterRoleFromCli(topicName)) ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })
    await step('Minimum role to post: Admin', {card: true})
  })

  // The phone's own group of the two: the service keeps a pair per device type, and the phone's
  // panel shows both.
  it('the mobile notification setting is saved and stays through a relaunch', async function () {
    // worst case (s): channel 240, conv 75, open 100, panel 25, on screen 20, the chosen one 10, the
    // seq 2, the tap 15, calls 10, conv 95, the chosen one 10, step 2, relaunch 200, signed in 90,
    // open 100, panel 25, on screen 20, the chosen one 10, its read 1, step 2, on screen 20, the tap
    // 15, conv 95, step 2 = 1184
    this.timeout(1_240_000)
    const {convID} = await newChannel('notify')
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
    await waitForCall('the setting to go out', seq, 'chat.1.local.setAppNotificationSettingsLocal')
    await expectSavedMobile('the mobile setting saved', convID, want)
    await shown(want)
    await step('Mobile notifications: only when @mentioned')

    await expectPersists(
      'the mobile notification choice',
      async () => {
        await waitSignedIn()
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
    // tap 1, calls 10, the inbox 10, the screen 1, cli 80, row 90, absent 90, step 2 = 733
    this.timeout(780_000)
    const {convID, topicName} = await newChannel('leave')
    check((await channelMembersFromCli(topicName)).includes(data.smokeUser), 'the account is not in the new channel')
    await openConversation(convID)
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    const leave = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Leave channel"')
    await dragUntilOnScreen('Leave channel', leave)
    await step('Leave channel in the info panel')
    const seq = await currentCallSeq()
    await leave().click()
    await waitForCall('the leave to go out', seq, 'chat.1.local.leaveConversationLocal')
    await el(T.CHAT_INBOX_LIST).waitForExist({timeout: 10_000})
    check((await visibleConversation()) !== convID, 'the left channel is still the screen shown')
    await expectMembers('the account gone from the channel', topicName, m => !m.includes(data.smokeUser))
    // e2e-scratch, a channel of the same team, shows the team's channels drawn
    await scrollInboxTo(`#${E2E_CHANNELS.scratch}`)
    check(!(await inboxHasRow(`#${topicName}`)), 'the left channel is still in the inbox')
    await step('Back in the inbox, without the channel', {card: true})
  })
})

// Chat's screens and modes as the phone draws them, each opened from the UI it lives behind and
// checked by what it shows, then closed again: the info panel's tabs, the emoji picker, a message's
// menu for each kind of message, the bot search and a member's bot page, the forward picker, the new
// chat team builder, the clear history warning, the @, # and / suggestion lists, the GIF preview and
// the inbox at its end.
//
// Nothing is sent from a screen here: the warnings are cancelled and the pickers closed. Each acts in
// the seeded channels, the DM with the second account, or a throwaway channel of KB_E2E_TEAM this
// run made (the clear history warning, whose wrong button would clear a channel for everyone). The
// host stays on the smoke account; another account's message comes from the second account's peer
// service. Every body is stamped with the run id. What a test leaves (the composer of e2e-scratch, a
// throwaway channel) is put back by the flow's afterEach, after a timeout too.
import {
  E2E_CHANNELS,
  MEDIA_FIXTURES,
  ensureChatData,
  readFromCli,
  sendToThrowawayFromCli,
  type ChatData,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {convIDBytes} from '../../shared/conv-id.ts'
import {mainRpc} from '../../shared/main-rpc.ts'
import {sendWithRetry} from '../../shared/peer-actors'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {requireSecondNotBlocked} from '../gate/blocks'
import {step} from '../gate/step'
import {
  clearComposer,
  closeInfoPanel,
  closeMessageMenu,
  composerText,
  dragUntilOnScreen,
  galleryListing,
  giphyGalleryShown,
  hideKeyboard,
  openConversation,
  openInfoPanel,
  openMessageMenu,
  ordinalsWithText,
  resetComposer,
  scrollInboxTo,
  scrollInboxToEnd,
  scrollRowIntoView,
  sendMessage,
  storedAttachment,
  suggestionRows,
  typeInComposer,
  typeInSearchFilter,
  visibleConversation,
  waitForComposerText,
  waitForRow,
} from '../helpers/chat'
import {expectScreen, visibleScreen} from '../gate/screens'
import {
  BUTTON_ELEMENTS,
  check,
  chooseMenuItem,
  elementWithLabelPartIn,
  menuLabels,
  menuOffers,
  NAMED_ELEMENT_TYPES,
  tapButton,
} from '../helpers/menus'
import {expectCli, secondSender, textBodies, throwawayChannels} from '../helpers/chat-host'
import {byText, el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs, goBackUntilGone, navigateToChat} from '../helpers/navigate'

// TeamRole in the protocol: a bot or a restricted bot
const BOT_ROLES: ReadonlyArray<number> = [5, 6]

// how long a clear history that went out takes to empty the thread (chat-messages waits as long)
const CLEAR_BOUND_MS = 20_000

const MEDIA_IMAGE = MEDIA_FIXTURES.find(f => f.file.endsWith('.png'))!.title

describe('chat views', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  sent  sendMessage 25;  row  waitForRow 30;  keyboard  5
  //   panel     openInfoPanel with a tab 25 (the header menu 15, the tab 10);  tab  another tab 10
  //   menu      openMessageMenu 15;  item  chooseMenuItem 20;  items  the menu's items read 5;  close  5
  //   screen    a screen's route or marker 10;  back  goBackUntilGone 10, gone 5 = 15
  //   button    one exact-label button found 5 and tapped 1 = 6;  named  a row by name, polled 15
  //   image     e2e-media's seeded image: its row 30, ready 20, scrolled into view 30 = 80;  in row
  //             the image found in its row 5
  //   host      one host read 75 (whoami 15, the call 60);  cli  a host read polled 80 (20, overrun
  //             by one read's 60);  host send  one host send 60
  //   peer      the peer found 45 and a failing call's diagnosis 25 = 70;  peer send  sendWithRetry
  //             90 (30, overrun by one send's 60)
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120
  //   type      15;  list  the suggestion list 10;  composer  5;  inbox  scrollInboxTo 120
  //   clear     clearComposer 21 (clearFieldByKeys 16, the composer read empty 5)
  //   escape    escapeToTabs 30;  step  2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // another account's message needs the second account unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  const scratch = () => data.convIDs[E2E_CHANNELS.scratch]
  const media = () => data.convIDs[E2E_CHANNELS.media]

  // -- what the afterEach puts back ---------------------------------------------------------------
  // Each is set before the change it undoes and cleared once its restore is done, so the restore
  // runs only when needed and a second run of it does nothing.

  // set once a test typed in e2e-scratch's composer or put it in a mode
  let scratchComposerUsed = false
  // throwaway channels a test made
  const channels = throwawayChannels()

  // e2e-scratch's composer empty, with no reply or edit under way. Bound: open 100, resetComposer
  // 46 = 146.
  const resetScratch = async () => {
    if (!scratchComposerUsed) return
    await openConversation(scratch())
    await resetComposer()
    scratchComposerUsed = false
  }

  // Nothing a test opened or changed left behind, after a timeout too. The host's deletes go first.
  // Worst case (s): close 19, keyboard 5, a channel 120, scratch 146, escape 30 = 320.
  afterEach(async function () {
    this.timeout(330_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, channels.deleteAll, resetScratch, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  // e2e-media's seeded image, loaded, ready and wholly in view; its ordinal and message id.
  // Bound: image 80.
  const mediaImageInView = async () => {
    const ordinal = await waitForRow(MEDIA_IMAGE, 30_000)
    const id = await waitFor(
      'the seeded image to be ready',
      async () => {
        const a = await storedAttachment(ordinal)
        return a && a.id > 0 && a.hasPreview && !a.transferState ? a.id : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    await scrollRowIntoView(ordinal)
    return {id, ordinal}
  }

  // The open message menu offers each of `want` and none of `not`, read to the sheet's end. Bound:
  // items 15.
  const expectMenu = async (what: string, want: ReadonlyArray<string>, not: ReadonlyArray<string>) => {
    const items = await menuLabels()
    for (const item of want) check(menuOffers(items, item), `${what}'s menu does not offer ${item}`)
    for (const item of not) check(!menuOffers(items, item), `${what}'s menu offers ${item}`)
  }

  // -- the info panel -----------------------------------------------------------------------------

  it("the info panel's tabs each show their own list", async function () {
    // worst case (s): open 100, panel 25, named 15, step 2; tab 10, the Media sub-tab 10, its listing
    // polled 20, step 2; tab 10, Add a bot 10, the Featured header 10, step 2; tab 10, the mute
    // switch 10, step 2; back 15 = 253
    this.timeout(280_000)
    await openConversation(media())
    await openInfoPanel(T.CHAT_INFO_PANEL_MEMBERS_TAB)
    // the members tab lists the second account, by its name in memory
    await waitFor(
      'the second account among the members',
      async () => elementWithLabelPartIn(NAMED_ELEMENT_TYPES, data.secondUser, "the second account's member row"),
      {interval: 500, timeout: 15_000}
    )
    await step('Info panel: Members lists the channel members')

    await el(T.CHAT_INFO_PANEL_ATTACHMENTS_TAB).waitForExist({timeout: 10_000})
    await el(T.CHAT_INFO_PANEL_ATTACHMENTS_TAB).click()
    await el(T.CHAT_INFO_PANEL_MEDIA).waitForExist({timeout: 10_000})
    await el(T.CHAT_INFO_PANEL_MEDIA).click()
    await waitFor(
      'Media to list the seeded image and video',
      async () => {
        const {media: shown} = await galleryListing()
        return shown.some(m => !m.video) && shown.some(m => m.video) ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    await step('Info panel: Attachments lists the channel media')

    await el(T.CHAT_INFO_PANEL_BOTS_TAB).waitForExist({timeout: 10_000})
    await el(T.CHAT_INFO_PANEL_BOTS_TAB).click()
    await browser
      .$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add a bot" AND visible == 1')
      .waitForExist({timeout: 10_000, timeoutMsg: 'the Bots tab does not offer Add a bot'})
    await browser
      .$('-ios predicate string:type == "XCUIElementTypeStaticText" AND label == "Featured" AND visible == 1')
      .waitForExist({timeout: 10_000, timeoutMsg: 'the Bots tab lists no featured bots'})
    await step('Info panel: Bots offers Add a bot and the featured bots')

    await el(T.CHAT_INFO_PANEL_SETTINGS_TAB).waitForExist({timeout: 10_000})
    await el(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
    await el(T.CHAT_INFO_PANEL_MUTE).waitForExist({timeout: 10_000})
    await step('Info panel: Settings shows the mute switch', {card: true})
    await closeInfoPanel()
  })

  // -- the composer's pickers ---------------------------------------------------------------------

  it('the emoji picker opens from the composer and closes back to it', async function () {
    // worst case (s): open 100, the button 5 and its tap 1, the picker 10, screen 10, step 2, keyboard
    // 5, back 15, composer 5, step 2 = 155
    this.timeout(180_000)
    await openConversation(scratch())
    await el(T.CHAT_EMOJI_BUTTON).waitForExist({timeout: 5_000})
    await el(T.CHAT_EMOJI_BUTTON).click()
    await el(T.CHAT_EMOJI_PICKER).waitForExist({timeout: 10_000})
    await expectScreen('the emoji picker screen', 'chatChooseEmoji')
    await step('The emoji picker')
    // the picker's search takes the keyboard, which covers the back
    await hideKeyboard()
    await goBackUntilGone(T.CHAT_EMOJI_PICKER)
    await el(T.CHAT_EMOJI_PICKER).waitForExist({reverse: true, timeout: 5_000})
    await el(T.CHAT_INPUT).waitForExist({timeout: 5_000})
    check((await visibleConversation()) === scratch(), 'the emoji picker did not close back to e2e-scratch')
    await step('Back in the conversation, the composer showing', {card: true})
  })

  // Types `text` into the empty composer, waits for the list to offer exactly one row `pick` takes,
  // then empties the composer and waits for the list to go. Bound: type 15, list 10, the row 10,
  // step 2, clear 21, gone 5 = 63.
  const expectSuggestion = async (text: string, what: string, pick: (words: Array<string>) => boolean) => {
    await typeInComposer(text)
    await el(T.CHAT_SUGGESTION_LIST).waitForExist({timeout: 10_000})
    await waitFor(
      `the suggestion row of ${what}`,
      async () => {
        const rows = (await suggestionRows()).filter(r => pick(r.words))
        if (rows.length > 1) throw new Error(`${rows.length} suggestion rows are ${what}`)
        return rows.length === 1 ? true : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    await step(`The suggestion list offers ${what}`)
    await clearComposer()
    await el(T.CHAT_SUGGESTION_LIST).waitForExist({reverse: true, timeout: 5_000})
  }

  it('the @, # and / suggestion lists each offer what was typed', async function () {
    // worst case (s): open 100, clear 21, three suggestion lists of 63, step 2 = 312
    this.timeout(330_000)
    await openConversation(scratch())
    scratchComposerUsed = true
    await clearComposer()
    const name = data.secondUser
    await expectSuggestion(`@${name.slice(0, 3)}`, 'the second account', words => words[0] === name || words[0] === `@${name}`)
    await expectSuggestion(`#${E2E_CHANNELS.short.slice(0, 6)}`, `#${E2E_CHANNELS.short}`, words =>
      words.some(w => w.replace(/^#/, '') === E2E_CHANNELS.short)
    )
    await expectSuggestion('/gi', 'the /giphy command', words => words.some(w => w.replace(/^\//, '') === 'giphy'))
    check((await composerText()) === '', 'the composer is not empty after the suggestion lists')
    await step('Each list closed with the composer emptied', {card: true})
  })

  // The phone's GIF picker is a web view of the service's gallery page: no GIF in it carries a testID.
  it('/giphy shows the GIF preview, and emptying the composer closes it', async function () {
    // worst case (s): open 100, clear 21, type 15, composer 5, the preview 30, step 2, clear 21, the
    // preview gone 15, step 2 = 211
    this.timeout(230_000)
    await openConversation(scratch())
    scratchComposerUsed = true
    await clearComposer()
    await typeInComposer('/giphy cat')
    await waitForComposerText('/giphy cat')
    await waitFor('the GIF preview', async () => ((await giphyGalleryShown()) ? true : undefined), {interval: 500, timeout: 30_000})
    await step('The GIF preview for /giphy')
    await clearComposer()
    await waitFor('the GIF preview to close', async () => ((await giphyGalleryShown()) ? undefined : true), {interval: 500, timeout: 15_000})
    await step('The composer emptied: no GIF preview', {card: true})
  })

  // -- a message's menu and its pickers -----------------------------------------------------------

  it("a message's menu offers what its kind allows: the account's own text, another's, an image", async function () {
    // worst case (s): open 100, sent 25, keyboard 5, menu 15, items 15, step 2, close 19; peer 70,
    // peer send 90, row 30, menu 15, items 15, step 2, close 19; open 100, image 80, menu 15, items 15,
    // step 2, close 19 = 653
    this.timeout(680_000)
    await openConversation(scratch())
    scratchComposerUsed = true
    const own = e2eMarker('views-own')
    await sendMessage(own)
    await hideKeyboard()
    await openMessageMenu(own)
    await expectMenu('the own message', ['Reply', 'Edit', 'Delete for everyone', 'Copy text', 'Pin message', 'Mark as unread'], ['Reply privately'])
    await step("The menu of the account's own message")
    await closeMessageMenu()

    const theirs = e2eMarker('views-theirs')
    await sendWithRetry(await secondSender(), scratch(), theirs)
    await waitForRow(theirs, 30_000)
    await openMessageMenu(theirs)
    await expectMenu("the second account's message", ['Reply', 'Reply privately', 'Copy text'], ['Edit'])
    await step("The menu of another account's message")
    await closeMessageMenu()

    await openConversation(media())
    await mediaImageInView()
    await openMessageMenu(MEDIA_IMAGE)
    await expectMenu('the image', ['Forward', 'Save', 'Share', 'All media'], ['Copy text'])
    await step("The menu of an image", {card: true})
    await closeMessageMenu()
  })

  it("the forward picker opens from an image's menu and closes without forwarding", async function () {
    // worst case (s): open 100, image 80, menu 15, item 20, the picker 10, screen 10, step 2, back 15,
    // the conversation 1, step 2 = 255
    this.timeout(280_000)
    await openConversation(media())
    await mediaImageInView()
    await openMessageMenu(MEDIA_IMAGE)
    await chooseMenuItem('Forward')
    await el(T.CHAT_FORWARD_SEARCH).waitForExist({timeout: 10_000})
    await expectScreen('the forward picker', 'chatForwardMsgPick')
    await step('The forward picker', {screenshot: false})
    await goBackUntilGone(T.CHAT_FORWARD_SEARCH)
    await el(T.CHAT_FORWARD_SEARCH).waitForExist({reverse: true, timeout: 5_000})
    check((await visibleConversation()) === media(), 'closing the forward picker did not go back to e2e-media')
    await step('Closed: back in the thread', {card: true})
  })

  // The second account is a member of the team, so its bot page offers no install: what the phone
  // shows a member, read back by its role on the host.
  it('the bot search finds the second account, and its bot page offers a member no install', async function () {
    // worst case (s): open 100, panel 25, Add a bot 10 and button 6, screen 10, type 21
    // (typeInSearchFilter), keyboard 5, named 15, step 2, the tap 1, screen 10, the install screen 10,
    // the buttons read 1, host 75, step 2, escape 30 = 323
    this.timeout(350_000)
    await openConversation(scratch())
    await openInfoPanel(T.CHAT_INFO_PANEL_BOTS_TAB)
    await browser
      .$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add a bot" AND visible == 1')
      .waitForExist({timeout: 10_000, timeoutMsg: 'the Bots tab does not offer Add a bot'})
    await tapButton('Add a bot', "the Bots tab's Add a bot")
    await expectScreen('the bot search', 'chatSearchBots')
    await typeInSearchFilter(data.secondUser)
    // the first tap with the keyboard up only puts it away
    await hideKeyboard()
    const result = await waitFor(
      'the second account among the users found',
      async () => elementWithLabelPartIn(NAMED_ELEMENT_TYPES, data.secondUser, 'the second account among the results'),
      {interval: 500, timeout: 15_000}
    )
    await step('The bot search finds the second account')
    await result.click()
    await expectScreen("the second account's bot page", 'chatInstallBot', p => p['botUsername'] === data.secondUser)
    await el(T.CHAT_BOT_INSTALL).waitForExist({timeout: 10_000})
    for (const label of ['Review', 'Install', 'Edit settings', 'Uninstall']) {
      check(!(await browser.$(`${BUTTON_ELEMENTS} AND label == ${JSON.stringify(label)}`).isExisting()), `a member's bot page offers ${label}`)
    }
    const role = await mainRpc<number>('chat.1.local.getTeamRoleInConversation', {convID: convIDBytes(scratch()), username: data.secondUser})
    check(role > 0 && !BOT_ROLES.includes(role), 'the host does not read the second account as a member, not a bot')
    await step("A member's bot page: no install offered", {card: true})
    await escapeToTabs()
  })

  // -- the inbox's modals -------------------------------------------------------------------------

  it('New chat opens the team builder, and it closes back to the inbox', async function () {
    // worst case (s): escape 30, the tab 5, the button 5 and its tap 1, screen 10, the self row 10,
    // step 2, escape 30, the inbox 10, step 2 = 105
    this.timeout(130_000)
    await escapeToTabs()
    await navigateToChat()
    await el(T.CHAT_NEW_CHAT_BUTTON).waitForExist({timeout: 5_000})
    await el(T.CHAT_NEW_CHAT_BUTTON).click()
    await expectScreen('the new chat team builder', 'chatNewChat')
    // the phone's builder offers the self conversation first
    await byText('Write secure notes to yourself').waitForExist({timeout: 10_000, timeoutMsg: 'the team builder does not offer the self row'})
    await step('The new chat team builder', {screenshot: false})
    await escapeToTabs()
    await el(T.CHAT_INBOX_LIST).waitForExist({timeout: 10_000})
    check((await visibleScreen())?.name !== 'chatNewChat', 'the team builder is still up')
    await step('Closed: back at the inbox', {screenshot: false})
  })

  it("Clear entire conversation's warning cancels, and the channel keeps its messages", async function () {
    // worst case (s): channel 240, host send 60, cli 80, open 100, row 30, panel 25, the button on
    // screen 20 and its tap 1, the warning 10, the conversation 1, screen 10, step 2, button 6, the
    // warning gone 10, the conversation 1, back 15, the conversation 1, held 81 (the clear's 20,
    // overrun by one host read 60 and the thread's 1), step 2 = 695
    this.timeout(720_000)
    const {convID, topicName} = await channels.make('views', {withSecond: false})
    const text = e2eMarker('views-hist')
    await sendToThrowawayFromCli(topicName, text)
    await expectCli({topicName}, 'the message', ms => textBodies(ms).includes(text))
    await openConversation(convID)
    await waitForRow(text, 30_000)

    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    const clear = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Clear entire conversation"')
    await dragUntilOnScreen('"Clear entire conversation"', clear)
    await clear().click()
    const confirm = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Yes, clear for everyone" AND visible == 1')
    await confirm().waitForExist({timeout: 10_000})
    check((await visibleConversation()) === convID, 'the clear history warning is not over the throwaway channel')
    await expectScreen('the clear history warning', 'chatDeleteHistoryWarning')
    await step('The clear history warning')

    await tapButton('Cancel', "the warning's Cancel")
    const cancelledAt = Date.now()
    await confirm().waitForExist({reverse: true, timeout: 10_000})
    check((await visibleScreen())?.name !== 'chatDeleteHistoryWarning', 'the clear history warning is still up')
    // the Cancel goes back to the info panel: the thread is the one to read
    await closeInfoPanel()
    check((await visibleConversation()) === convID, 'back from the info panel is not the throwaway channel')
    // a clear that went out lands within its bound (the rows gone 20s), so the stamped message must
    // still be there, on the host and in the thread, through all of it
    for (;;) {
      check(textBodies(await readFromCli({topicName})).includes(text), 'the host no longer reads the message: the history was cleared')
      check((await ordinalsWithText(text)).length === 1, 'the thread no longer shows the message: the history was cleared')
      if (Date.now() >= cancelledAt + CLEAR_BOUND_MS) break
      await new Promise(resolve => setTimeout(resolve, 1_000))
    }
    await step('Cancelled: the host still reads the message', {card: true})
  })

  // -- the inbox at its end -----------------------------------------------------------------------

  it('the inbox scrolled to its end', async function () {
    // worst case (s): inbox 120 (the self row), inbox 120 (to the end), step 2 = 242
    this.timeout(260_000)
    // the self conversation's row shows the inbox loaded
    await scrollInboxTo(data.smokeUser)
    const drawn = await scrollInboxToEnd()
    check(drawn > 0, 'the inbox draws nothing at its end')
    await step('The inbox at its end', {screenshot: false})
  })
})

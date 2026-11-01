// The phone composer, read off the input, the inbox, the thread and the host's CLI: drafts survive
// leaving and an app relaunch, a send takes the text and the draft with it, an edit is never a
// draft, the reply bar cancels, the suggestion lists pick by tap, leaving with a list open sends no
// typing, an emoji from the picker lands with its space, a hardware Enter sends and Shift-Enter
// breaks the line, and a read-only channel hides every way to post, mid-edit too.
//
// The host stays on the smoke account, the channel owner: it seeds, makes and deletes the throwaway
// channels and sets their minimum writer role. The app is smoke's, but for the read-only parts,
// which run as the second account (asSecond). Every body is stamped with the run id.
import type {LoggedCall} from '../../shared/call-log.ts'
import {
  E2E_CHANNELS,
  createThrowawayChannel,
  deleteThrowawayChannel,
  ensureChatData,
  minWriterRoleFromCli,
  readonlyMarker,
  setMinWriterRoleFromCli,
  type ChatData,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {asSecond, restoreToSmoke} from '../gate/accounts'
import {creditSurface} from '../gate/attempt'
import {inboxRowMatches} from '../gate/chat-lib'
import {relaunchApp} from '../gate/device'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {callsSince, currentCallSeq, waitForUiCall} from '../gate/recorder'
import {requireSecondNotBlocked} from '../gate/blocks'
import {manualEdge, step} from '../gate/step'
import {
  clearComposer,
  closeMessageMenu,
  closeSearch,
  composerText,
  editCancel,
  hideKeyboard,
  isKeyboardUp,
  openConversation,
  openMessageMenu,
  openThreadSearch,
  ordinalsWithText,
  replyPreview,
  resetComposer,
  scrollInboxTo,
  searchOpen,
  sendMessage,
  showsText,
  storedMessage,
  suggestionRows,
  typeInComposer,
  typeIntoFocused,
  unreadCount,
  visibleConversation,
  waitForComposerText,
  waitForRow,
  waitSignedIn,
} from '../helpers/chat'
import {check, chooseMenuItem, menuLabels, menuOffers} from '../helpers/menus'
import {expectCli, textBodies} from '../helpers/chat-host'
import {el, els} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'

describe('chat composer', function () {
  // no retries: a retry would let an intermittent race pass
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  reset  resetComposer 46 (edit bar 5, reply bar 5, clear 21,
  //             the taps and reads);  clear  clearComposer 21 (clearFieldByKeys 16, the read 5)
  //   read      openDirectRead 110 (open 100, the DM read as read 10)
  //   draft     the DM's inbox row read 142 (the DM read 1, scrollInboxTo 120, its label polled 10,
  //             overrun 10, the DM read 1)
  //   type      typeInComposer 15;  composer  waitForComposerText 5 (10 where given);  sent  sendMessage 25
  //   edit      startEdit 50 (keyboard 5, menu 35, edit bar 5, composer 5);  cancel  11
  //   menu      openMessageMenu 15 + chooseMenuItem 20 = 35;  close  closeMessageMenu 19
  //   search    openThreadSearch 20, closeSearch 5;  keyboard  5;  row  waitForRow 15
  //   relaunch  relaunchApp 200 (two checkpoints and the new runtime's 120), signed in 90
  //   cli       a host read polled 80 (20, overrun by one read's 60)
  //   calls     the recorder's call log, one read 2
  //   second    asSecond 425 (the switch 150, restoreToSmoke 275)
  //   channel   createThrowawayChannel 240 (four chat api calls);  role  setMinWriterRoleFromCli 135
  //             (the confirmed set 60, its read polled 15, overrun by one read's 60);  role read 60;
  //             delete  deleteThrowawayChannel 120
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // the second account's messages and switches need it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  const openDirect = async () => openConversation(data.direct.convID)
  const openScratch = async () => openConversation(data.convIDs[E2E_CHANNELS.scratch])

  // Waits for the composer to read `text`, saying only `what`: for a text holding an account name.
  const composerReads = async (what: string, text: string, timeout = 5_000) =>
    waitFor(`the composer to read ${what}`, async () => ((await composerText()) === text ? true : undefined), {
      interval: 200,
      timeout,
    })

  // A body or draft that the DM's inbox row is read for: a label of at most 6 characters keeps it
  // to 23 characters (30 with " edited"), so the row's one-line snippet shows it whole.
  const rowBody = (label: string) => {
    if (label.length > 6) throw new Error(`the row body label "${label}" is over 6 characters`)
    return e2eMarker(label)
  }

  // The row hides a draft while the DM is unread (small-team/index.tsx), so every draft read starts
  // from a read DM: the phone's unread count for it, the one its row reads, is 0.
  const directIsRead = async () => (await unreadCount(data.direct.convID)) === 0
  const requireDirectRead = async () => check(await directIsRead(), 'the DM is unread, so its inbox row hides any draft')
  // Opens the DM and waits for the phone to read it as read: each draft test starts here.
  const openDirectRead = async () => {
    await openDirect()
    await waitFor('the DM to read as read', async () => ((await directIsRead()) ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
  }

  // The DM's inbox row, which shows a saved draft as "Draft: <text>" while the conversation is not
  // open. Its label reads "<name>, <time>, <snippet>"; the inbox is scrolled to it, then its label is
  // read afresh until `ok` takes it, the DM reading as read before and after. Neither the name nor
  // the label goes in an error.
  const expectDirectRow = async (what: string, ok: (label: string) => boolean) => {
    await requireDirectRead()
    await scrollInboxTo(data.secondUser)
    await waitFor(
      `the DM's inbox row to show ${what}`,
      async () => {
        const labels: Array<string> = []
        for (const row of await els(T.CHAT_INBOX_ROW).getElements()) {
          const label = await row.getAttribute('label').catch(() => null)
          if (label !== null && inboxRowMatches(label, data.secondUser)) labels.push(label)
        }
        if (labels.length > 1) throw new Error(`${labels.length} inbox rows are the DM's`)
        return labels.length === 1 && ok(labels[0]!) ? true : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    await requireDirectRead()
  }
  const expectDirectDraft = async (draft: string) =>
    expectDirectRow(`the draft "${draft}"`, label => label.includes('Draft') && label.includes(draft))
  // No draft, and the snippet showing `lastBody`: the newest message's body, so a row read before a
  // wrong draft save lands, or before the row caught up at all, cannot pass.
  const expectNoDirectDraft = async (lastBody: string) =>
    expectDirectRow(`no draft and the snippet "${lastBody}"`, label => !label.includes('Draft') && label.includes(lastBody))

  // Starts editing the message showing `text` from its menu.
  const startEdit = async (text: string) => {
    await hideKeyboard()
    await openMessageMenu(text)
    await chooseMenuItem('Edit')
    await editCancel().waitForExist({timeout: 5_000})
    await waitForComposerText(text)
  }

  const cancelEdit = async () => {
    await editCancel().click()
    await editCancel().waitForExist({reverse: true, timeout: 5_000})
  }

  // The message sent as `text` still reads exactly that in the app. Found by its text: a row sent
  // this session is renumbered when the thread loads again.
  const expectStoredText = async (text: string) => {
    const found = await ordinalsWithText(text)
    check(found.length === 1, `${found.length} messages contain "${text}"`)
    const m = await storedMessage(found[0]!)
    check(m?.text === text, `the message reads "${m?.text}", not "${text}"`)
  }

  // The host's read of a conversation's text bodies, polled until `ok` takes them.
  const expectCliBodies = async (
    where: {topicName: string} | {tlfName: string},
    what: string,
    ok: (bodies: Array<string>) => boolean
  ) =>
    expectCli(where, what, ms => ok(textBodies(ms)))
  const directOnHost = () => ({tlfName: data.direct.tlfName})
  const unchanged = (text: string, change: string) => (bodies: Array<string>) =>
    bodies.includes(text) && !bodies.includes(`${text}${change}`)

  // The composers of the DM and of e2e-scratch end every test empty, with no edit or reply open, so
  // nothing carries into the next test or run. Mocha runs this after the describes' own afterEach
  // (so on the smoke account again) and before the gate's, after a timeout too. Worst case (s):
  // keyboard 5, two opens 200, two resets 92, the list gone 5 = 302.
  afterEach(async function () {
    this.timeout(320_000)
    await withCleanup(hideKeyboard, [
      async () => {
        await openDirect()
        await resetComposer()
      },
      async () => {
        await openScratch()
        await resetComposer()
        await el(T.CHAT_SUGGESTION_LIST).waitForExist({reverse: true, timeout: 5_000})
      },
    ])
  })

  describe('drafts', () => {
    it('a draft survives a conversation switch and an app relaunch', async function () {
      // worst case (s): read 110, reset 46, type 15, step 2, open 100, draft 142, step 2, open 100,
      // composer 5, open 100, draft 142, relaunch 200, signed in 90, draft 142, step 2, open 100,
      // composer 5, step 2 = 1305; the margin covers a slow relaunch
      this.timeout(1500_000)
      await openDirectRead()
      await resetComposer()
      const draft = rowBody('cdraft')
      await typeInComposer(draft)
      await step('A draft typed in the DM')

      await openScratch()
      await expectDirectDraft(draft)
      await step("The DM's inbox row shows the draft", {screenshot: false})
      await openDirect()
      await waitForComposerText(draft)

      // leave again so the draft goes to the service, then relaunch the app
      await openScratch()
      await expectDirectDraft(draft)
      await relaunchApp()
      await waitSignedIn()
      await expectDirectDraft(draft)
      creditSurface('relaunch')
      await step("After a relaunch the DM's inbox row still shows the draft", {screenshot: false})
      await openDirect()
      await waitForComposerText(draft)
      await step('The DM opens with the draft in the composer', {card: true})
    })

    it('a send clears the composer and the saved draft', async function () {
      // worst case (s): read 110, reset 46, type 15, open 100, draft 142, step 2, open 100, composer 5,
      // the tap 1, row 15, composer 5, cli 80, step 2, open 100, draft 142, open 100, composer 5,
      // step 2 = 972
      this.timeout(980_000)
      await openDirectRead()
      await resetComposer()
      const text = rowBody('csend')
      await typeInComposer(text)
      await openScratch()
      await expectDirectDraft(text)
      await step("The DM's inbox row shows the saved draft", {screenshot: false})

      await openDirect()
      await waitForComposerText(text)
      await el(T.CHAT_SEND_BUTTON).click()
      await waitForRow(text)
      await waitForComposerText('')
      await expectCliBodies(directOnHost(), 'the sent message in the DM', bodies => bodies.includes(text))
      await step('The draft sent: the row shows and the composer is empty')

      await openScratch()
      await expectNoDirectDraft(text)
      await openDirect()
      await waitForComposerText('')
      await step('The DM has no draft, its row showing the sent message, its composer empty', {card: true})
    })

    it('typing straight after a send is not erased', async function () {
      // worst case (s): read 110, reset 46, type 15, the tap 1, the typing 5, row 15, the pause 1,
      // composer 5, cli 80, step 2 = 280
      this.timeout(300_000)
      await openDirectRead()
      await resetComposer()
      const text = e2eMarker('composer-quick')
      await typeInComposer(text)
      await el(T.CHAT_SEND_BUTTON).click()
      await el(T.CHAT_INPUT).addValue('next')
      await waitForRow(text)
      // the sent row has landed and the list has settled; what was typed after the send is all there
      await browser.pause(500)
      await waitForComposerText('next')
      await expectCliBodies(directOnHost(), 'the sent message in the DM', bodies => bodies.includes(text))
      await step('The message sent and what was typed after it still in the composer', {card: true})
    })
  })

  describe('editing', () => {
    it('Edit from the menu puts the message in the composer, and Cancel ends it', async function () {
      // worst case (s): read 110, reset 46, sent 25, edit 50, step 2, cancel 11, composer 5, cli 80,
      // step 2 = 331
      this.timeout(340_000)
      await openDirectRead()
      await resetComposer()
      const text = e2eMarker('composer-edit')
      await sendMessage(text)
      await startEdit(text)
      await step('Editing: the message is in the composer')

      await cancelEdit()
      await waitForComposerText('')
      await expectStoredText(text)
      await expectCliBodies(directOnHost(), 'the message unchanged', bodies => bodies.includes(text))
      await step('Cancelled: the composer is empty, the message unchanged', {card: true})
    })

    it('leaving mid-edit discards the edit and saves no draft', async function () {
      // worst case (s): read 110, reset 46, sent 25, edit 50, the typing 5, composer 5, the pause 1,
      // step 2, open 100, draft 142, open 100, composer 5, cli 80, step 2 = 673
      this.timeout(680_000)
      await openDirectRead()
      await resetComposer()
      const text = rowBody('cleave')
      await sendMessage(text)
      await startEdit(text)
      await el(T.CHAT_INPUT).addValue(' changed')
      await waitForComposerText(`${text} changed`)
      // well past the draft save's throttle, so a save of the edit text would have gone out
      await browser.pause(500)
      await step('Editing, the edit text changed')

      await openScratch()
      await expectNoDirectDraft(text)
      await openDirect()
      check(!(await editCancel().isExisting()), 'the edit is still open')
      await waitForComposerText('')
      await expectStoredText(text)
      await expectCliBodies(directOnHost(), 'the message unchanged', unchanged(text, ' changed'))
      await step('Back in the DM: no edit, no draft, the message unchanged', {card: true})
    })

    it('leaving mid-edit keeps the draft from before the edit', async function () {
      // worst case (s): read 110, reset 46, sent 25, type 15, edit 50, the typing 5, composer 5, the
      // pause 1, step 2, open 100, draft 142, open 100, composer 5, cli 80, step 2 = 688
      this.timeout(700_000)
      await openDirectRead()
      await resetComposer()
      const text = e2eMarker('composer-leave-draft')
      await sendMessage(text)
      const draft = rowBody('cpre')
      await typeInComposer(draft)
      await startEdit(text)
      await el(T.CHAT_INPUT).addValue(' changed')
      await waitForComposerText(`${text} changed`)
      await browser.pause(500)
      await step('Editing over a draft')

      await openScratch()
      await expectDirectDraft(draft)
      await openDirect()
      check(!(await editCancel().isExisting()), 'the edit is still open')
      await waitForComposerText(draft)
      await expectStoredText(text)
      await expectCliBodies(directOnHost(), 'the message unchanged', unchanged(text, ' changed'))
      await step('Back in the DM: the draft from before the edit, the message unchanged', {card: true})
    })

    it('cancelling an edit puts the draft from before it back', async function () {
      // worst case (s): read 110, reset 46, sent 25, type 15, edit 50, the typing 5, the pause 1,
      // cancel 11, composer 5, step 2, open 100, draft 142, open 100, composer 5, cli 80, step 2 = 699
      this.timeout(710_000)
      await openDirectRead()
      await resetComposer()
      const text = e2eMarker('composer-cancel')
      await sendMessage(text)
      const draft = rowBody('cprec')
      await typeInComposer(draft)
      await startEdit(text)
      await el(T.CHAT_INPUT).addValue(' changed')
      await browser.pause(500)

      await cancelEdit()
      await waitForComposerText(draft)
      await step('Cancelled: the draft from before the edit is back')

      await openScratch()
      await expectDirectDraft(draft)
      await openDirect()
      await waitForComposerText(draft)
      await expectStoredText(text)
      await expectCliBodies(directOnHost(), 'the message unchanged', unchanged(text, ' changed'))
      await step('The draft saved, the message unchanged', {card: true})
    })

    it('Edit from the menu raises the keyboard once the menu is gone', async function () {
      // worst case (s): read 110, reset 46, sent 25, edit 50, keyboard 5, the keys 2, composer 5,
      // step 2 = 245
      this.timeout(250_000)
      await openDirectRead()
      await resetComposer()
      const text = e2eMarker('composer-edit-focus')
      await sendMessage(text)
      await startEdit(text)
      await waitFor('the composer to take the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {
        timeout: 5_000,
      })
      // the keys go to the focused composer, into the edit
      await typeIntoFocused('the composer', ' x')
      await waitForComposerText(`${text} x`)
      await step('Editing with the keyboard up, the keys went into the edit', {card: true})
    })

    // On a phone thread search takes the composer's place, and closing it attaches a new input.
    it("an edit's text comes back after thread search, sending posts the edit, and no draft is saved", async function () {
      // worst case (s): read 110, reset 46, sent 25, edit 50, the typing 5, composer 5, the pause 1,
      // search 20, the composer gone 5, close 5, composer 5, step 2, the tap 1, the edit bar 5,
      // composer 5, the row 15, cli 80, step 2, open 100, draft 142, step 2 = 636
      this.timeout(640_000)
      await openDirectRead()
      await resetComposer()
      const text = rowBody('cedsr')
      const edited = `${text} edited`
      await sendMessage(text)
      await startEdit(text)
      await el(T.CHAT_INPUT).addValue(' edited')
      await waitForComposerText(edited)
      await browser.pause(500)

      await openThreadSearch()
      await el(T.CHAT_INPUT).waitForExist({reverse: true, timeout: 5_000})
      await closeSearch()
      check(!(await searchOpen()), 'thread search is still open')
      await waitForComposerText(edited)
      check(await editCancel().isExisting(), 'the edit ended across thread search')
      await step('After thread search the edit is still open with its text')

      await el(T.CHAT_SEND_BUTTON).click()
      await editCancel().waitForExist({reverse: true, timeout: 5_000})
      await waitForComposerText('')
      await waitFor(
        'the message to read the edited text',
        async () => {
          const found = await ordinalsWithText(edited)
          const m = found.length === 1 ? await storedMessage(found[0]!) : undefined
          return m?.text === edited ? true : undefined
        },
        {timeout: 15_000}
      )
      await expectCliBodies(directOnHost(), 'the edited body', bodies => bodies.includes(edited) && !bodies.includes(text))
      await step('The edit posted: the row and the host read the edited text', {card: true})
      await openScratch()
      await expectNoDirectDraft(edited)
      await step('No draft saved for the edit, the row showing the edited text', {screenshot: false})
    })
  })

  describe('reply and suggestions', () => {
    it('the reply bar shows, and its close button cancels it', async function () {
      // worst case (s): open 100, reset 46, sent 25, keyboard 5, menu 35, the bar 5, its text 2,
      // step 2, the tap 1, the bar gone 5, step 2 = 228
      this.timeout(230_000)
      await openScratch()
      await resetComposer()
      const text = e2eMarker('composer-reply')
      await sendMessage(text)
      await hideKeyboard()
      await openMessageMenu(text)
      await chooseMenuItem('Reply')
      await replyPreview().waitForExist({timeout: 5_000})
      check(await showsText(T.CHAT_REPLY_PREVIEW, text), 'the reply bar does not quote the message')
      await step('Replying: the reply bar quotes the message')
      await el(T.CHAT_REPLY_CANCEL).click()
      await replyPreview().waitForExist({reverse: true, timeout: 5_000})
      await step('The reply bar closed', {card: true})
    })

    // Types `text` into the empty composer of e2e-scratch and waits for the one row `pick` takes,
    // saying only `what` (a user row holds an account name).
    const openListAndFind = async (text: string, what: string, pick: (words: Array<string>) => boolean) => {
      await openScratch()
      await resetComposer()
      await typeInComposer(text)
      await el(T.CHAT_SUGGESTION_LIST).waitForExist({timeout: 10_000})
      return waitFor(
        `the suggestion row of ${what}`,
        async () => {
          const rows = (await suggestionRows()).filter(r => pick(r.words))
          if (rows.length > 1) throw new Error(`${rows.length} suggestion rows are ${what}`)
          return rows[0]?.e
        },
        {timeout: 10_000}
      )
    }

    it("@mention list: tapping the second account's row puts its name in the composer", async function () {
      // worst case (s): open 100, reset 46, type 15, the list 10, the row 10, step 2, the tap 1, the
      // list gone 5, composer 5, step 2 = 196
      this.timeout(200_000)
      const name = data.secondUser
      const row = await openListAndFind(`@${name.slice(0, 3)}`, 'the second account', words => words[0] === name)
      await step('The @mention list shows the second account')
      await row.click()
      await el(T.CHAT_SUGGESTION_LIST).waitForExist({reverse: true, timeout: 5_000})
      await composerReads("the second account's @mention", `@${name} `)
      await step('The picked @mention is in the composer', {card: true})
    })

    it('emoji list: tapping the tada row puts that emoji in the composer', async function () {
      // worst case (s): open 100, reset 46, type 15, the list 10, the row 10, step 2, the tap 1, the
      // list gone 5, composer 5, step 2 = 196
      this.timeout(200_000)
      const row = await openListAndFind(':tada', 'tada', words => words.includes('tada'))
      await step('The emoji list shows tada')
      await row.click()
      await el(T.CHAT_SUGGESTION_LIST).waitForExist({reverse: true, timeout: 5_000})
      await waitForComposerText(':tada: ')
      await step('The picked emoji is in the composer', {card: true})
    })

    // The phone shows no pick in the composer before a tap (only a desktop arrow key previews one; the
    // phone's hardware keys reach the composer as Enter and Shift-Enter alone), so leaving with the
    // list open keeps what was typed. Typing there sends typing, and nothing after the leave does:
    // read off the recorder's call log, the positive control first. In the DM, whose inbox row shows
    // the saved draft's text (a channel row shows only a draft icon).
    it('leaving with the @mention list open sends no typing after the leave and keeps the text as the draft', async function () {
      // worst case (s): calls 2, read 110, reset 46, type 15, the list 10, the typing sent 12, the
      // pause 2, calls 2, step 2, open 100, the load 10, the pause 2, calls 2, draft 142, step 2 = 459
      this.timeout(470_000)
      const typed = `@${data.secondUser.slice(0, 3)}`
      const typingOn = (calls: ReadonlyArray<LoggedCall>) =>
        calls.filter(c => !c.paused && c.method === 'chat.1.local.updateTyping' && c.typing === true)
      const before = await currentCallSeq()
      await openDirectRead()
      await resetComposer()
      await typeInComposer(typed)
      await el(T.CHAT_SUGGESTION_LIST).waitForExist({timeout: 10_000})
      await waitFor('the typing to go out', async () => (typingOn(await callsSince(before)).length > 0 ? true : undefined), {
        interval: 500,
        timeout: 10_000,
      })
      // past the typing throttle (1s), so the typing from before the leave has all gone out
      await browser.pause(1_500)
      const atLeave = await currentCallSeq()
      await step('The @mention list open over the typed text')

      await openScratch()
      // the scratch open's thread load, so the window after the leave is shown to log calls
      await waitForUiCall('the scratch thread to load', atLeave, 'chat.1.local.getThreadNonblock')
      await browser.pause(1_500)
      const after = typingOn(await callsSince(atLeave))
      check(after.length === 0, `${after.length} typing updates said typing after the leave`)
      // the typed text holds part of an account name, so the wait names only what it is
      await expectDirectRow('the typed @ text as its draft', label => label.includes('Draft') && label.includes(typed))
      await step("The DM's inbox row shows the typed text as its draft", {screenshot: false})
    })

    it('an emoji from the picker goes in after the text with one space after it', async function () {
      // worst case (s): open 100, reset 46, type 15, keyboard 5, the button 1, the picker 5, the
      // search 1, keyboard 5, the keys 4, the emoji 5, step 2, the tap 1, the picker gone 5,
      // composer 5, step 2 = 202
      this.timeout(220_000)
      await openScratch()
      await resetComposer()
      await typeInComposer('hello ')
      await hideKeyboard()
      await el(T.CHAT_EMOJI_BUTTON).click()
      await el(T.CHAT_EMOJI_PICKER).waitForExist({timeout: 5_000})
      // the search box is a button until tapped, and the field it opens is not in the accessibility
      // tree, so the keys go to whatever has focus
      await browser.$('-ios predicate string:label BEGINSWITH "Search" AND visible == 1').click()
      await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
      // one key per action: WDA refuses an action that presses the same key twice
      for (const key of 'tada') await browser.keys(key)
      // with or without the emoji-presentation selector
      const tada = browser.$(
        `-ios predicate string:(label BEGINSWITH "\u{1F389}\u{FE0F}" OR label == "\u{1F389}") AND visible == 1 AND NOT (label CONTAINS ", ")`
      )
      await tada.waitForExist({timeout: 5_000})
      await step('The emoji picker found tada')
      await tada.click()
      await el(T.CHAT_EMOJI_PICKER).waitForExist({reverse: true, timeout: 5_000})
      await waitForComposerText('hello :tada: ')
      await step('The emoji went in after the text with one space', {card: true})
    })
  })

  // Hardware keys reach the app through UIKit's key presses (AppDelegate.pressesBegan). On this host's
  // simulators Appium's `mobile: keys` never gets there (Shift-Enter only latches the soft keyboard's
  // shift, and no newline lands), so a person presses them (ledger ruling: a harness limit).
  describe('hardware keyboard', () => {
    it('Enter sends and Shift-Enter inserts a newline', async function () {
      // worst case (s): open 100, reset 46, type 15, composer 5, step 2, the edge 2, clear 21 = 191
      this.timeout(210_000)
      await openScratch()
      await resetComposer()
      await typeInComposer('ab')
      await waitForComposerText('ab')
      await step('The composer focused with text, where a hardware Shift-Enter and Enter go')
      await manualEdge('hardware-keyboard-enter')
      await clearComposer()
    })
  })

  const postingButtons = [
    T.CHAT_EMOJI_BUTTON,
    T.CHAT_MENTION_BUTTON,
    T.CHAT_CAMERA_BUTTON,
    T.CHAT_AUDIO_BUTTON,
    T.CHAT_MORE_BUTTON,
  ] as const

  // The second account is a writer; e2e-readonly takes posts from admins only (seeded so).
  describe('read-only channel', () => {
    // Back on the smoke account with no menu open, after a timeout too (asSecond's own restore runs
    // in the body). Worst case (s): close 19, keyboard 5, the restore 275 = 299.
    afterEach(async function () {
      this.timeout(310_000)
      await withCleanup(closeMessageMenu, [hideKeyboard, restoreToSmoke])
    })

    it('as a writer: every way to post is hidden, typing takes nothing, and the menu offers no reply', async function () {
      // worst case (s): role read 60, second 425, open 100, reset 46, the buttons 5, type 15, the
      // send button 5, clear 21, step 2, open 100, row 15, the buttons 5, the typing 15, the pause 1,
      // the reads 2, keyboard 5, step 2, menu 15, the items 15, step 2, close 19 = 875
      this.timeout(900_000)
      const role = await minWriterRoleFromCli(E2E_CHANNELS.readonly)
      check(/\badmin\b/i.test(role), `e2e-readonly's minimum writer role is not admin: ${role}`)
      await asSecond(async () => {
        // where the second account can post, every button shows
        await openScratch()
        await resetComposer()
        for (const id of postingButtons) {
          check(await el(id).isExisting(), `${id} does not show where the account can post`)
        }
        await typeInComposer('x')
        await el(T.CHAT_SEND_BUTTON).waitForExist({timeout: 5_000})
        await clearComposer()
        await step('As the second account in e2e-scratch every posting button shows')

        await openConversation(data.convIDs[E2E_CHANNELS.readonly])
        await waitForRow(readonlyMarker(1))
        for (const id of [...postingButtons, T.CHAT_SEND_BUTTON]) {
          check(!(await el(id).isExisting()), `${id} shows in a channel the account cannot post to`)
        }
        // the input is disabled there, so the tap or the keys may be refused: what counts is what lands
        const refused = (e: unknown) => {
          if (isAttemptOver(e)) throw e
        }
        await el(T.CHAT_INPUT).click().catch(refused)
        await el(T.CHAT_INPUT).addValue('e2e-readonly-typed').catch(refused)
        await browser.pause(500)
        check((await composerText()) === '', 'typing in a read-only channel put text in the composer')
        check(!(await el(T.CHAT_SEND_BUTTON).isExisting()), 'typing in a read-only channel offers a send button')
        await hideKeyboard()
        await step('In e2e-readonly no posting button shows and typing takes nothing')

        // another's message, which a writer could reply to (Edit is never offered on it, so it is
        // checked on the account's own message mid-edit, below)
        await openMessageMenu(readonlyMarker(1))
        const items = await menuLabels()
        check(menuOffers(items, 'Copy text'), 'the message menu did not open fully')
        check(!menuOffers(items, 'Reply'), 'the message menu offers Reply')
        await step('The message menu offers no Reply', {card: true})
        await closeMessageMenu()
      })
    })
  })

  // The channel turns read-only for the second account (a writer) while it edits: the owner, the host
  // CLI, raises the channel's minimum writer role. Cancelling the edit then empties the composer and
  // leaves the draft set aside for the edit as it was; it loads again once the account can post. The
  // owner clearing the role altogether makes the channel writable again as it shows.
  describe('read-only mid-edit', () => {
    // channel labels (see createThrowawayChannel), one per test
    const editLabel = 'iroedit'
    const clearLabel = 'iroclr'
    // the throwaway channels a test made, for the afterEach to restore and delete
    let created: Array<string> = []

    // Clears each channel's role, then deletes it from the host, then puts the app back on smoke,
    // each whether the one before threw; after a timeout too. Worst case (s), one channel: role 135,
    // delete 120, close 19, keyboard 5, the restore 275 = 554.
    afterEach(async function () {
      this.timeout(560_000)
      const channels = created
      created = []
      await withCleanup(
        async () => {
          for (const topicName of channels) await setMinWriterRoleFromCli(topicName, 'none')
        },
        [
          async () => {
            for (const topicName of channels) await deleteThrowawayChannel(topicName)
          },
          closeMessageMenu,
          hideKeyboard,
          restoreToSmoke,
        ]
      )
    })

    it('cancelling the edit empties the composer and leaves the draft, which comes back once it can post', async function () {
      // worst case (s): channel 240, second 425, open 100, the emoji button 10, sent 25, type 15, the
      // pause 1, edit 50, the typing 5, composer 5, step 2, role 135, the button gone 20, step 2,
      // keyboard 5, the edit bar 5, cancel 11, composer 5, cli 80, menu 15, the items 15, close 19,
      // step 2, role 135, the button 20, composer 10, step 2 = 1364
      this.timeout(1375_000)
      const {convID, topicName} = await createThrowawayChannel(editLabel)
      created.push(topicName)
      await asSecond(async () => {
        await openConversation(convID)
        await el(T.CHAT_EMOJI_BUTTON).waitForExist({timeout: 10_000})

        const text = e2eMarker('composer-roedit')
        await sendMessage(text)
        const draft = e2eMarker('composer-roedit-draft')
        await typeInComposer(draft)
        // past the draft save's throttle, so the draft is saved before the edit sets it aside
        await browser.pause(500)
        await startEdit(text)
        await el(T.CHAT_INPUT).addValue(' changed')
        await waitForComposerText(`${text} changed`)
        await step('As the second account, editing its own message over a draft')

        await setMinWriterRoleFromCli(topicName, 'admin')
        await el(T.CHAT_EMOJI_BUTTON).waitForExist({reverse: true, timeout: 20_000})
        await step('The owner made the channel read-only mid-edit')
        await hideKeyboard()
        await editCancel().waitForExist({timeout: 5_000})
        await cancelEdit()
        await waitForComposerText('')
        await expectStoredText(text)
        await expectCliBodies({topicName}, 'the message unchanged', unchanged(text, ' changed'))
        // the account's own message, which a writer could edit: read-only offers neither Edit nor Reply
        await openMessageMenu(text)
        const items = await menuLabels()
        check(menuOffers(items, 'Copy text'), 'the message menu did not open fully')
        check(!menuOffers(items, 'Edit'), 'the message menu offers Edit in a channel the account cannot post to')
        check(!menuOffers(items, 'Reply'), 'the message menu offers Reply in a channel the account cannot post to')
        await closeMessageMenu()
        await step('Cancelled: the composer is empty, the message unchanged, its menu offers no Edit')

        await setMinWriterRoleFromCli(topicName, 'writer')
        await el(T.CHAT_EMOJI_BUTTON).waitForExist({timeout: 20_000})
        await waitForComposerText(draft, 10_000)
        await step('Writable again: the draft from before the edit is back', {card: true})
      })
    })

    it('the owner clearing the minimum writer role makes the composer writable again, without a reopen', async function () {
      // worst case (s): channel 240, second 425, open 100, the emoji button 10, role 135, the button
      // gone 20, step 2, role 135, the button 20, the read 1, step 2, sent 25, cli 80, step 2 = 1197
      this.timeout(1210_000)
      const {convID, topicName} = await createThrowawayChannel(clearLabel)
      created.push(topicName)
      await asSecond(async () => {
        await openConversation(convID)
        await el(T.CHAT_EMOJI_BUTTON).waitForExist({timeout: 10_000})

        await setMinWriterRoleFromCli(topicName, 'admin')
        await el(T.CHAT_EMOJI_BUTTON).waitForExist({reverse: true, timeout: 20_000})
        await step('The owner made the channel read-only')
        await setMinWriterRoleFromCli(topicName, 'none')
        await el(T.CHAT_EMOJI_BUTTON).waitForExist({timeout: 20_000})
        check((await visibleConversation()) === convID, 'the channel is no longer the one showing')
        await step('The owner cleared the role: the posting buttons are back in place')

        const text = e2eMarker('composer-roclear')
        await sendMessage(text)
        await expectCliBodies({topicName}, 'the message sent once writable', bodies => bodies.includes(text))
        await step('A message sent once the channel is writable again', {card: true})
      })
    })
  })
})

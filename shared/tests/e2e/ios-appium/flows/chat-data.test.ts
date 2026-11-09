// What the phone thread shows as its data changes, read off the thread store, the screen, the
// recorder's call log and the host: the DM opens from its inbox row and a send settles at the end;
// a delete shows deleting (through thread reloads too) and then takes the row away; a reaction from
// the menu's quick row comes and goes; mark unread sets the orange line, the inbox's unread count
// and the server's read pointer; reply privately opens the DM
// quoting the message; incoming messages reach the thread and the inbox; all of it keeps working
// across an account switch, the thread left behind by one sends nothing for the next account, a
// conversation never joined stays open, and so does a channel the account leaves on another device.
//
// The host stays on the smoke account, the channel owner: it seeds, reads back, and makes and
// deletes the throwaway channel. Every incoming message, and the leave, comes from the second
// account's peer service. Every body is stamped with the run id.
import type {LoggedCall} from '../../shared/call-log.ts'
import {
  E2E_CHANNELS,
  createThrowawayChannel,
  deleteThrowawayChannel,
  ensureChatData,
  type ChatData,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {mainConversation} from '../../shared/main-rpc.ts'
import {sendWithRetry} from '../../shared/peer-actors'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {asSecond, restoreToSmoke} from '../gate/accounts'
import {inboxRowMatches} from '../gate/chat-lib'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {callsSince, currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import {requireSecondNotBlocked} from '../gate/blocks'
import {tapBack} from '../gate/screens'
import {manualEdge, step} from '../gate/step'
import {
  accountChangedSeq,
  appInboxLists,
  clearComposer,
  closeMessageMenu,
  type DeletePhase,
  deletePhase,
  expectAtEnd,
  heldWaitingKeys,
  hideKeyboard,
  isKeyboardUp,
  messageIDAt,
  openConversation,
  openFromInbox,
  openMessageMenu,
  orangeLineOrdinals,
  ordinalsWithText,
  resetComposer,
  scrollInboxTo,
  sendMessage,
  signedInAs,
  startAppAccountSwitch,
  stopAccountChangeWatch,
  storedMessage,
  typeInComposer,
  typeIntoFocused,
  unreadCount,
  visibleConversation,
  waitForComposerText,
  waitForRow,
  watchAccountChange,
} from '../helpers/chat'
import {check, chooseMenuItem} from '../helpers/menus'
import {expectCli, secondSender, textBodies} from '../helpers/chat-host'
import {el, els} from '../helpers/elements'
import {openUrl, waitFor} from '../helpers/lifecycle'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'

describe('chat data', function () {
  // no retries: a retry would let an intermittent race pass
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  inbox  openFromInbox 415 (three taps of scrollInboxTo 120, each
  //             waited 5, and the thread 35);  row  scrollInboxTo 120 + its label polled 10 = 130
  //   sent      sendMessage 25;  type  typeInComposer 15;  composer  waitForComposerText 5 (10 given)
  //   clear     clearComposer 21 (clearFieldByKeys 16, the composer read empty 5)
  //   row       waitForRow 15 (20 where given);  end  expectAtEnd 21;  stable  10
  //   menu      openMessageMenu 15 + chooseMenuItem 20 = 35;  close  5;  keyboard  5
  //   peer      the peer found, on a test's first send, 45, and a failing send's diagnosis 25 = 70;
  //             send  one peer send 60;  leave  one peer leave 60
  //   cli       a host read polled 80 (20, overrun by one read's 60);  conv  the host's read of a
  //             conversation polled 95 (20, overrun by one read: whoami 15 and the call 60)
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   second    asSecond 425 (the switch 150, restoreToSmoke 275);  restore  restoreToSmoke 275
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // the second account's messages and switches need it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  const sendIncoming = async (convID: string, text: string) => (await secondSender()).send(convID, text)

  const openScratch = async () => openConversation(data.convIDs[E2E_CHANNELS.scratch])
  const openDirect = async () => openConversation(data.direct.convID)

  const scratchOnHost = () => ({topicName: E2E_CHANNELS.scratch})
  const directOnHost = () => ({tlfName: data.direct.tlfName})

  // Checks the message at `ordinal` is from the second account, saying so without the name.
  const expectFromSecond = async (ordinal: number) => {
    const m = await storedMessage(ordinal)
    check(m?.author === data.secondUser, 'the message did not come from the second account')
  }

  // Back on the smoke account with no menu open and no watch left in the app, after a timeout too.
  // Mocha runs this after the describes' own afterEach. Worst case (s): close 19, keyboard 5, the
  // watch 2, restore 275 = 301.
  afterEach(async function () {
    this.timeout(310_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, stopAccountChangeWatch, restoreToSmoke])
  })

  describe('basics', () => {
    it('the DM opens from its inbox row, each send settles at the end, and back returns to the inbox', async function () {
      // worst case (s): inbox 415, the composer 1, step 2, three times (sent 25, end 21) = 138, type 15,
      // the typing 5, composer 5, the tap 1, row 15, end 21, cli 80, step 2, the back 1, the inbox 10,
      // the screen 1, step 2 = 714
      this.timeout(740_000)
      const convID = await openFromInbox(data.secondUser)
      check(convID === data.direct.convID, 'the inbox row opened another conversation than the DM')
      check(await el(T.CHAT_INPUT).isExisting(), 'the DM opened without its composer')
      await step('The DM opened from its inbox row')

      const sent: Array<string> = []
      for (const label of ['data-basic-a', 'data-basic-b', 'data-basic-c']) {
        const text = e2eMarker(label)
        await sendMessage(text)
        await expectAtEnd(`after sending ${label}, the thread`)
        sent.push(text)
      }
      // three lines: the soft keyboard's return breaks the line, Send posts it
      const first = e2eMarker('data-basic-lines')
      const lines = `${first}\nsecond line\nthird line`
      await typeInComposer(first)
      await el(T.CHAT_INPUT).addValue('\nsecond line\nthird line')
      await waitForComposerText(lines)
      await el(T.CHAT_SEND_BUTTON).click()
      await waitForRow(first)
      await expectAtEnd('after sending three lines, the thread')
      await expectCli(directOnHost(), 'the sends in the DM', ms => {
        const bodies = textBodies(ms)
        return sent.every(t => bodies.includes(t)) && bodies.includes(lines)
      })
      await step('Each send, the three-line one too, settled at the end')

      check(await tapBack(), 'the DM has no back button')
      await el(T.CHAT_INBOX_LIST).waitForExist({timeout: 10_000, timeoutMsg: 'back did not return to the inbox'})
      check((await visibleConversation()) === null, 'a conversation is still the visible screen after back')
      await step('Back in the inbox', {screenshot: false})
    })
  })

  describe('delete', () => {
    it('deleting a message shows it deleting, then the row goes, and the host no longer has it', async function () {
      // worst case (s): open 100, sent 25, cli 80, keyboard 5, menu 15, step 2, the menu item 20, the
      // row gone 10, the pause 1, the read 1, cli 80, step 2 = 341
      this.timeout(360_000)
      await openScratch()
      const text = e2eMarker('data-delete')
      const ordinal = await sendMessage(text)
      await expectCli(scratchOnHost(), 'the message', ms => textBodies(ms).includes(text))
      await hideKeyboard()
      await openMessageMenu(text)
      await step('The message menu of a sent message')

      // every phase the row goes through, from before the delete is chosen until a while after it is gone
      const phases: Array<DeletePhase> = []
      let watching = true
      const watcher = (async () => {
        while (watching) {
          const p = await deletePhase(ordinal)
          if (phases.at(-1) !== p) phases.push(p)
        }
      })()
      try {
        await chooseMenuItem('Delete for everyone')
        await waitFor('the row to go', () => (phases.at(-1) === 'gone' ? true : undefined), {interval: 100, timeout: 10_000})
        await browser.pause(1_000)
      } finally {
        watching = false
        await watcher
      }
      check(JSON.stringify(phases) === JSON.stringify(['row', 'row+deleting', 'gone']), `the row went ${phases.join(' -> ')}`)
      check(!(await ordinalsWithText(text)).length, 'the deleted message is back in the thread')
      await expectCli(scratchOnHost(), 'the message gone', ms => !textBodies(ms).includes(text))
      await step('The row is gone, and the host no longer has the message', {card: true})
    })

    // A delete waiting to go out keeps its row, showing deleting, through any thread load. The phone's
    // delete lands within the thread's 500ms load throttle on a live service, so no load can come back
    // while the row shows deleting (seen live in every attempt); a person checks it with the network
    // off (ledger ruling).
    it('a delete keeps showing deleting through thread reloads until it lands', async function () {
      // worst case (s): open 100, sent 25, keyboard 5, menu 15, step 2, the edge 2, close 19 = 168
      this.timeout(180_000)
      await openScratch()
      const text = e2eMarker('data-delete-reload')
      await sendMessage(text)
      await hideKeyboard()
      await openMessageMenu(text)
      await step('A message menu open on a message sent, where Delete for everyone goes')
      await manualEdge('delete-through-reloads')
      await closeMessageMenu()
    })
  })

  describe('reactions', () => {
    const thumbsUp = ':+1:'
    const quickThumbsUp = () =>
      browser.$(`-ios predicate string:name == ${JSON.stringify(T.CHAT_QUICK_REACTION_PREFIX + thumbsUp)} AND visible == 1`)

    // Reacts with a thumbs-up from the message's menu, where the quick reactions sit on top, or takes
    // it back when it is there.
    const toggleThumbsUp = async (text: string) => {
      await hideKeyboard()
      await openMessageMenu(text)
      await quickThumbsUp().waitForExist({timeout: 5_000, timeoutMsg: 'the message menu has no thumbs-up quick reaction'})
      await quickThumbsUp().click()
      await quickThumbsUp().waitForExist({reverse: true, timeout: 5_000})
    }
    const thumbsUpFromMe = async (ordinal: number) => {
      const m = await storedMessage(ordinal)
      return !!m?.reactions.some(r => r.emoji === thumbsUp && r.users.includes(data.smokeUser))
    }
    // Waits for the host to read the message showing `text` with, or without, the account's thumbs-up:
    // the message itself must be there either way.
    const expectHostThumbsUp = async (text: string, on: boolean) =>
      expectCli(scratchOnHost(), `the thumbs-up ${on ? 'on' : 'gone from'} the message`, ms => {
        const m = ms.find(x => x.content.type === 'text' && x.content.text?.body === text)
        return !!m && Object.keys(m.reactions?.reactions?.[thumbsUp]?.users ?? {}).includes(data.smokeUser) === on
      })

    // The messages a test reacted to, for the afterEach to take a thumbs-up a test left off.
    let reacted: Array<string> = []

    // Takes off any thumbs-up a test left (a timed-out body stops before its own removal), each
    // message found afresh by its text; a message without one is left alone. Worst case (s): open
    // 100, then per message (the find 1, the read 1, the toggle 30, the store 10) 42.
    afterEach(async function () {
      this.timeout(180_000)
      const texts = reacted
      reacted = []
      if (!texts.length) return
      await openScratch()
      for (const text of texts) {
        const found = await ordinalsWithText(text)
        if (found.length !== 1 || !(await thumbsUpFromMe(found[0]!))) continue
        await toggleThumbsUp(text)
        await waitFor('the reaction to go', async () => ((await thumbsUpFromMe(found[0]!)) ? undefined : true), {timeout: 10_000})
      }
    })

    it('a reaction adds from the message menu and removes the same way', async function () {
      // worst case (s): open 100, sent 25, the toggle 30 (keyboard 5, menu 15, the reaction 5, the
      // menu gone 5), the store 10, cli 80, step 2, the toggle 30, the store 10, cli 80, step 2 = 369
      this.timeout(390_000)
      await openScratch()
      const text = e2eMarker('data-reaction')
      const ordinal = await sendMessage(text)
      reacted.push(text)
      await toggleThumbsUp(text)
      await waitFor('the reaction', async () => ((await thumbsUpFromMe(ordinal)) ? true : undefined), {timeout: 10_000})
      await expectHostThumbsUp(text, true)
      await step('A thumbs-up from the quick row, on the message and on the host')
      await toggleThumbsUp(text)
      await waitFor('the reaction to go', async () => ((await thumbsUpFromMe(ordinal)) ? undefined : true), {timeout: 10_000})
      await expectHostThumbsUp(text, false)
      await step('The thumbs-up taken back the same way', {card: true})
    })

    it('a reaction on the newest message keeps the thread at its end', async function () {
      // worst case (s): open 100, sent 25, keyboard 5, end 21, the toggle 30, the store 10, end 21,
      // step 2 = 214
      this.timeout(240_000)
      await openScratch()
      const text = e2eMarker('data-reaction-end')
      const ordinal = await sendMessage(text)
      await hideKeyboard()
      await expectAtEnd()
      reacted.push(text)
      await toggleThumbsUp(text)
      await waitFor('the reaction', async () => ((await thumbsUpFromMe(ordinal)) ? true : undefined), {timeout: 10_000})
      await expectAtEnd('after the reaction, the thread')
      await step('The reaction drawn, the thread still at its end; the afterEach takes it off', {card: true})
    })
  })

  // Waits for the server's read pointer for the DM, as the host reads it (the DM's readerInfo is the
  // server's), to satisfy `ok`.
  const directReadOnHost = async (what: string, ok: (r: {maxMsgid: number; readMsgid: number}) => boolean) =>
    waitFor(
      `the host to read the DM's read pointer ${what}`,
      async () => {
        const {readerInfo} = await mainConversation(data.direct.convID)
        return ok(readerInfo) ? true : undefined
      },
      {interval: 1_000, timeout: 20_000}
    )

  describe('mark unread', () => {
    // The DM read again, after a timeout too: an unread DM hides its draft in the inbox, which the
    // composer flows read. Worst case (s): keyboard 5, open 100, the read 10 = 115.
    afterEach(async function () {
      this.timeout(130_000)
      await withCleanup(hideKeyboard, [
        async () => {
          await openDirect()
          await waitFor('the DM to read as read', async () => ((await unreadCount(data.direct.convID)) === 0 ? true : undefined), {
            interval: 500,
            timeout: 10_000,
          })
        },
      ])
    })

    it('mark unread sets the orange line above the message, the conversation unread, and the server read pointer', async function () {
      // worst case (s): open 100, two sends 50, the ids 20, keyboard 5, conv 95, calls 2, menu 35, the
      // line 20, calls 10, conv 95, step 2, escapeToTabs 30, chat 10, the count 10, step 2, open 100,
      // the line 20, the read 10, conv 95, step 2 = 713
      this.timeout(740_000)
      await openDirect()
      const first = e2eMarker('data-unread-a')
      const firstOrdinal = await sendMessage(first)
      const secondOrdinal = await sendMessage(e2eMarker('data-unread-b'))
      const firstID = await messageIDAt(firstOrdinal)
      const secondID = await messageIDAt(secondOrdinal)
      await hideKeyboard()
      // the read pointer the mark moves back: past both sends (maxMsgid also counts edits and
      // reactions, so the sends' ids are the anchor)
      await directReadOnHost('past the sends', r => r.readMsgid >= secondID)

      const before = await currentCallSeq()
      await openMessageMenu(first)
      await chooseMenuItem('Mark as unread')
      await waitFor('the orange line above the message', async () => {
        const lines = await orangeLineOrdinals()
        return lines.length === 1 && lines[0] === firstOrdinal ? true : undefined
      })
      await waitForUiCall('the mark unread to go out', before, 'chat.1.local.markAsReadLocal')
      await directReadOnHost('behind the message', r => r.readMsgid > 0 && r.readMsgid < firstID)
      await step('Marked unread: the orange line above the message, the server read pointer behind it')

      await escapeToTabs()
      await navigateToChat()
      await waitFor('the conversation to count unread', async () => ((await unreadCount(data.direct.convID)) > 0 ? true : undefined), {
        timeout: 10_000,
      })
      await step('The inbox counts the DM unread', {screenshot: false})

      // opening it again reads it; the line stays where it was for this visit
      await openDirect()
      await waitFor('the orange line again', async () => {
        const lines = await orangeLineOrdinals()
        return lines.length === 1 ? true : undefined
      })
      await waitFor('the conversation to be read', async () => ((await unreadCount(data.direct.convID)) === 0 ? true : undefined), {
        timeout: 10_000,
      })
      await directReadOnHost('caught up again', r => r.readMsgid >= secondID)
      await step('Opened again: read, the line still where it was', {card: true})
    })
  })

  describe('reply privately', () => {
    // The quote goes into the DM's composer, which saves it as its draft; after a timeout too.
    // Worst case (s): keyboard 5, open 100, resetComposer 46 = 151.
    afterEach(async function () {
      this.timeout(170_000)
      await withCleanup(hideKeyboard, [
        async () => {
          await openDirect()
          await resetComposer()
        },
      ])
    })

    it('reply privately opens the DM with the message quoted, and the reply posts there', async function () {
      // worst case (s): open 100, peer 70, send 60, row 20, the read 1, keyboard 5, calls 2, menu 35,
      // the DM 15, composer 10, calls 10, step 2, keyboard 3, the tap 1, keyboard 5, the typing 5,
      // composer 5, the tap 1, row 15, composer 5, cli 80, step 2 = 452
      this.timeout(460_000)
      await openScratch()
      const text = e2eMarker('data-private')
      await sendIncoming(data.convIDs[E2E_CHANNELS.scratch], text)
      const ordinal = await waitForRow(text, 20_000)
      await expectFromSecond(ordinal)
      await hideKeyboard()

      const before = await currentCallSeq()
      await openMessageMenu(text)
      await chooseMenuItem('Reply privately')
      await waitFor('the DM', async () => ((await visibleConversation()) === data.direct.convID ? true : undefined), {
        timeout: 15_000,
      })
      const quote = `> ${text}\n`
      await waitForComposerText(quote, 10_000)
      await waitForUiCall('the DM to be found for the reply', before, 'chat.1.local.newConversationLocal')
      await step('Reply privately opened the DM with the message quoted')

      // The reply goes on the line under the quote. The composer sometimes has the keyboard already
      // (its cursor after the quote) and sometimes not; then it is tapped where a person taps, on its
      // empty last line, which puts the cursor at the end. (An element addValue taps the field's
      // middle first, which put the cursor inside the quote.)
      const reply = e2eMarker('data-private-reply')
      const keyboard = async (timeout: number) =>
        waitFor('the composer to have the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout}).catch(
          (e: unknown) => {
            if (isAttemptOver(e)) throw e
            return false
          }
        )
      if (!(await keyboard(3_000))) {
        const input = await el(T.CHAT_INPUT).getElement()
        const {height} = await input.getSize()
        await browser.execute('mobile: tap', {elementId: input.elementId, x: 12, y: Math.max(1, Math.round(height - 6))})
        if (!(await keyboard(5_000))) throw new Error('the composer did not take the keyboard')
      }
      await typeIntoFocused('the composer', reply)
      await waitForComposerText(`${quote}${reply}`)
      await el(T.CHAT_SEND_BUTTON).click()
      await waitForRow(reply)
      await waitForComposerText('')
      await expectCli(directOnHost(), 'the private reply', ms => textBodies(ms).includes(`${quote}${reply}`))
      await step('The private reply posted in the DM with its quote', {card: true})
    })
  })

  describe('incoming', () => {
    it('an incoming message reaches the open thread and the inbox snippet', async function () {
      // worst case (s): open 100, peer 70, send 60, row 20, the reads 2, step 2, keyboard 5, row 130,
      // step 2 = 391
      this.timeout(410_000)
      await openDirect()
      // a short body, so the inbox row's one-line snippet shows it whole
      const text = e2eMarker('dinc')
      await sendIncoming(data.direct.convID, text)
      const ordinal = await waitForRow(text, 20_000)
      check((await ordinalsWithText(text)).length === 1, 'the incoming message shows more than once')
      await expectFromSecond(ordinal)
      await step('The incoming message in the open DM')

      await hideKeyboard()
      await scrollInboxTo(data.secondUser)
      // the row reads "<name>, <time>, <snippet>"; neither the name nor the label goes in an error
      await waitFor(
        "the DM's inbox row to show the incoming message",
        async () => {
          const labels: Array<string> = []
          for (const row of await els(T.CHAT_INBOX_ROW).getElements()) {
            const label = await row.getAttribute('label').catch(() => null)
            if (label !== null && inboxRowMatches(label, data.secondUser)) labels.push(label)
          }
          if (labels.length > 1) throw new Error(`${labels.length} inbox rows are the DM's`)
          return labels[0]?.includes(text) ? true : undefined
        },
        {interval: 500, timeout: 10_000}
      )
      await step("The DM's inbox row shows the incoming message", {screenshot: false})
    })
  })

  // The composer's calls, any of which would be the old thread speaking for the next account.
  const composerCall = (c: LoggedCall) => /^chat\.1\.local\.(updateUnsentText|updateTyping|post\w*)$/.test(c.method)

  describe('account switch', () => {
    // Back on smoke with an empty e2e-scratch composer: the typing saved a draft there for smoke.
    // After a timeout too. Worst case (s): the watch 2, restore 275, open 100, clear 21 = 398.
    afterEach(async function () {
      this.timeout(420_000)
      await withCleanup(stopAccountChangeWatch, [
        restoreToSmoke,
        async () => {
          await openScratch()
          await clearComposer()
        },
      ])
    })

    // The thread open when the account changes belongs to the account that left. Typing in its
    // composer right through the switch sends nothing for the next account (no typing, no draft save,
    // no post), and nothing on screen is left waiting on a call it never made. The switch goes through
    // the app's own switch, started while the keys are still being typed; the recorder notes the call
    // seq at the moment the account changes.
    it('typing through an account switch sends nothing for the next account and leaves nothing waiting', async function () {
      // worst case (s): open 100, type 15, the pause 1, calls 2, the watch 1, the draft save 10, the
      // switch 2, the typing 30, calls 2, signed in 60, the pause 5, the reads 4, step 2 = 234 (the
      // afterEach restores smoke)
      this.timeout(260_000)
      await openScratch()
      await typeInComposer(e2eMarker('data-switch-draft'))
      // the draft saves for the account that typed it
      await browser.pause(1_000)
      const before = await currentCallSeq()
      await watchAccountChange()
      // awaited below, once the switch has started: the keys keep coming in while it runs
      const typing = el(T.CHAT_INPUT)
        .addValue('x'.repeat(80))
        .catch(() => {})
      // switch once the composer is saving drafts of the keys coming in
      await waitFor(
        'a draft save of the keys being typed',
        async () => ((await uiCallsSince(before, 'chat.1.local.updateUnsentText')).length > 0 ? true : undefined),
        {interval: 50, timeout: 10_000}
      )
      await startAppAccountSwitch(data.secondUser)
      await typing
      // the account changed before the last key went in, so keys were typed through the change:
      // without that, nothing after it could have come from the old composer anyway
      check((await accountChangedSeq()) !== null, 'the typing ended before the account changed')
      await waitFor(
        'the switch to the second account',
        async () => {
          const a = await signedInAs().catch(() => undefined)
          return a && a.loggedIn && !a.switching && a.username === data.secondUser ? true : undefined
        },
        {interval: 500, timeout: 60_000}
      )
      // outlast the composer's 200ms draft save and 1s typing throttle, and a load or two
      await browser.pause(5_000)
      const changed = await accountChangedSeq()
      if (changed === null) throw new Error('the account change was never seen')
      // the UI's calls: the switch's own dispatch went out paused
      const calls = (await callsSince(before)).filter(c => !c.paused)
      const composerBefore = calls.filter(c => c.seq <= changed && composerCall(c))
      const after = calls.filter(c => c.seq > changed)
      console.log(`the composer's calls before the account changed: ${composerBefore.map(c => c.method).join(', ')}`)
      check(composerBefore.length > 0, 'the composer sent nothing while typing before the switch')
      check(after.length > 0, 'no call logged after the account changed')
      const stray = after.filter(composerCall).map(c => c.method)
      check(!stray.length, `the old composer's calls after the account changed: ${stray.join(', ')}`)
      const held = await heldWaitingKeys()
      check(!held.length, `waiting keys still held 5s after the switch: ${held.join(', ')}`)
      await step('Switched mid-typing: the old composer sent nothing after the change, and nothing waits', {card: true})
    })

    it('a thread opened after switching accounts and back gets new messages for the account signed in', async function () {
      // worst case (s): open 100, second 425 (open 100, the screen 2, peer 70, send 60, row 20, step 2
      // inside it: 254), open 100, row 20, send 60, row 20, the read 1, step 2 = 982
      this.timeout(1_000_000)
      await openScratch()
      const scratch = data.convIDs[E2E_CHANNELS.scratch]

      // as the second account: the thread builds for it and hears a message sent from its other device
      const whileSecond = e2eMarker('data-switch-second')
      await asSecond(async () => {
        await openScratch()
        // a conversation opened right after the switch stays open (nothing selects one on its own)
        const shown = new Set<string | null>()
        for (const until = Date.now() + 1_500; Date.now() < until; ) shown.add(await visibleConversation())
        check(shown.size === 1 && shown.has(scratch), `the screen showed ${[...shown].join(', ')} in the 1.5s after opening`)
        await sendIncoming(scratch, whileSecond)
        await waitForRow(whileSecond, 20_000)
        await step("As the second account, e2e-scratch shows the account's message from its other device")
      })

      // back as the smoke user: the thread builds again, with that message in it once
      await openScratch()
      await waitForRow(whileSecond, 20_000)
      const incoming = e2eMarker('data-switch-back')
      await sendIncoming(scratch, incoming)
      await waitForRow(incoming, 20_000)
      check((await ordinalsWithText(incoming)).length === 1, 'the incoming message shows more than once')
      await step('Back as smoke, the thread has both messages, the new one once', {card: true})
    })
  })

  // A conversation opened from a link that the account has never joined (the closed subteam's
  // channel: the smoke user administers the subteam but is not in it) stays up: the phone's open
  // thread never moves on its own. What the app asked of the service meanwhile is read off the
  // recorder's call log, for the record.
  describe('a conversation never joined', () => {
    it('a conversation never joined, opened from a link, does not bounce', async function () {
      // worst case (s): keyboard 5, escapeToTabs 30, chat 10, calls 2, the open 20, the 6s watch 7,
      // calls 2, step 2 = 78
      this.timeout(100_000)
      await hideKeyboard()
      await escapeToTabs()
      await navigateToChat()
      const before = await currentCallSeq()
      openUrl(`keybase://convid/${data.closedConvID}`)
      await waitFor('the conversation to open', async () => ((await visibleConversation()) === data.closedConvID ? true : undefined), {
        timeout: 20_000,
      })
      const shown = new Set<string | null>()
      for (const until = Date.now() + 6_000; Date.now() < until; ) shown.add(await visibleConversation())
      const methods = [...new Set((await callsSince(before)).map(c => c.method))]
      console.log(`never joined: the app called ${methods.join(', ')}`)
      check(
        shown.size === 1 && shown.has(data.closedConvID),
        `the screen showed ${[...shown].join(', ')} in the 6s after opening the conversation`
      )
      await step('The never-joined conversation is still the one showing after 6s', {card: true})
    })
  })

  // A phone has no selection to move: its open thread stays where the user put it, even when the
  // account leaves that channel on another device (the notification that moves a desktop's selection
  // to the newest conversation). The app signs in as the second account, whose peer leaves; the
  // channel is made for the run and deleted by the host (the owner).
  describe('selection', () => {
    // the throwaway channels a test made, for the afterEach to delete
    let created: Array<string> = []

    // Deletes the channels from the host, then puts the app back on smoke, each whether the one
    // before threw; after a timeout too. Worst case (s), one channel: delete 120, restore 275 = 395.
    afterEach(async function () {
      this.timeout(410_000)
      const channels = created
      created = []
      await withCleanup(
        async () => {
          for (const topicName of channels) await deleteThrowawayChannel(topicName)
        },
        [restoreToSmoke]
      )
    })

    it("a phone's open thread stays open when the account leaves the channel on another device", async function () {
      // worst case (s): channel 240, peer 70, the first send 90 (retried 30, then one send 60), second
      // 425, its body (open 100, the inbox 15, step 2, leave 60, the 5s watch 6, step 2) 185 = 1010
      this.timeout(1_030_000)
      const {convID, topicName} = await createThrowawayChannel('dsel')
      created.push(topicName)
      // the peer's inbox may not list a channel this new yet: its first send waits until it does
      await sendWithRetry(await secondSender(), convID, e2eMarker('data-selection-hello'))
      await asSecond(async () => {
        await openConversation(convID)
        await waitFor('the inbox to list the channel', async () => ((await appInboxLists(convID)) ? true : undefined), {timeout: 15_000})
        await step('As the second account, the throwaway channel open')
        await (await secondSender()).leave(convID)
        const shown = new Set<string | null>()
        let left = false
        for (const until = Date.now() + 5_000; Date.now() < until; ) {
          shown.add(await visibleConversation())
          left ||= !(await appInboxLists(convID))
        }
        // the app heard about the leave, so the thread staying put is its choice
        check(left, 'the inbox still lists the channel 5s after leaving it')
        check(
          shown.size === 1 && shown.has(convID),
          `the screen showed ${[...shown].join(', ')} in the 5s after leaving the channel elsewhere`
        )
        await step('Left on another device: the inbox dropped the channel, the thread stays open', {card: true})
      })
    })
  })
})

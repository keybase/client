// What the phone thread shows as its data changes, read off the thread store, the screen, the
// recorder's call log and the host: the DM opens from its inbox row and a send settles at the end;
// a delete shows deleting (through thread reloads too) and then takes the row away; a reaction from
// the menu's quick row comes and goes; mark unread sets the orange line, the inbox's unread count
// and the server's read pointer (and does nothing on a first message); reply privately opens the DM
// quoting the message; incoming messages reach the thread and the inbox; all of it keeps working
// across an account switch, the thread left behind by one sends nothing for the next account, a
// conversation never joined stays open, and so does a channel the account leaves on another device.
//
// The host stays on the smoke account, the channel owner: it seeds, reads back, and makes and
// deletes the throwaway channel. Every incoming message, and the leave, comes from the second
// account's peer service. Every body is stamped with the run id.
import {loadE2EEnv} from '../../accounts/env'
import type {LoggedCall} from '../../shared/call-log.ts'
import {
  E2E_CHANNELS,
  createThrowawayChannel,
  deleteThrowawayChannel,
  ensureChatData,
  readFromCli,
  type ChatData,
  type CliMessage,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {mainConversation} from '../../shared/main-rpc.ts'
import {peerSender, sendWithRetry, type IncomingSender} from '../../shared/peer-actors'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {asSecond, restoreToSmoke} from '../gate/accounts'
import {inboxRowMatches} from '../gate/chat-lib'
import {callsSince, currentCallSeq, withHarnessRpcs} from '../gate/recorder'
import {tapBack} from '../gate/screens'
import {step} from '../gate/step'
import {
  accountChangedSeq,
  check,
  chooseDeleteBehindAReload,
  chooseMenuItem,
  clearComposer,
  closeMessageMenu,
  deletePhase,
  deleteWatch,
  dragThread,
  expectAtEnd,
  heldWaitingKeys,
  hideKeyboard,
  jsEval,
  openConversation,
  openFromInbox,
  openMessageMenu,
  ordinalsWithText,
  orangeLineOrdinals,
  rowText,
  scrollInboxTo,
  sendMessage,
  signedInAs,
  startAppAccountSwitch,
  stopAccountChangeWatch,
  stopDeleteWatch,
  storedMessage,
  typeInComposer,
  unreadCount,
  visibleConversation,
  waitForComposerText,
  waitForRow,
  waitForThreadStable,
  watchAccountChange,
  watchDeleteThroughReloads,
  type DeletePhase,
} from '../helpers/chat'
import {el, els} from '../helpers/elements'
import {openUrl, waitFor} from '../helpers/lifecycle'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'

describe('chat data', function () {
  // no retries: a retry would let an intermittent race pass
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  inbox  openFromInbox 325 (three taps of scrollInboxTo 90, each
  //             waited 5, and the thread 35);  row  scrollInboxTo 90 + its label polled 10 = 100
  //   sent      sendMessage 25;  type  typeInComposer 15;  composer  waitForComposerText 5 (10 given)
  //   row       waitForRow 15 (20 where given);  end  expectAtEnd 21;  stable  10
  //   menu      openMessageMenu 15 + chooseMenuItem 20 = 35;  close  5;  keyboard  5
  //   peer      the peer found, on a test's first send, 45, and a failing send's diagnosis 25 = 70;
  //             send  one peer send 60;  leave  one peer leave 60
  //   cli       a host read polled 80 (20, overrun by one read's 60);  conv  the host's read of a
  //             conversation polled 95 (20, overrun by one read: whoami 15 and the call 60)
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   second    asSecond 250 (the switch 90, the restore 160);  restore  restoreToSmoke 160
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    this.timeout(20 * 60_000) // a first run seeds; later runs only check
    data = await ensureChatData()
  })

  // The second account's peer service, found by the first test that needs it: one that is missing
  // fails only those tests, with the reason.
  let peer: Promise<IncomingSender> | undefined
  const sender = async () => (peer ??= peerSender(loadE2EEnv()))
  const sendIncoming = async (convID: string, text: string) => (await sender()).send(convID, text)

  const openScratch = async () => openConversation(data.convIDs[E2E_CHANNELS.scratch])
  const openDirect = async () => openConversation(data.direct.convID)

  // Calls of `method` in the recorder's call log since `seq`.
  const callsOf = async (seq: number, method: string) => (await callsSince(seq)).calls.filter(c => c.method === method)
  const waitForCall = async (what: string, seq: number, method: string) =>
    waitFor(what, async () => ((await callsOf(seq, method)).length > 0 ? true : undefined), {interval: 250, timeout: 10_000})

  // The host's read of a conversation's messages, polled until `ok` takes them.
  const expectCli = async (where: {topicName: string} | {tlfName: string}, what: string, ok: (ms: Array<CliMessage>) => boolean) =>
    waitFor(`the host to read ${what}`, async () => (ok(await readFromCli(where)) ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })
  const textBodies = (ms: Array<CliMessage>) => ms.filter(m => m.content.type === 'text').map(m => m.content.text?.body ?? '')
  const scratchOnHost = () => ({topicName: E2E_CHANNELS.scratch})
  const directOnHost = () => ({tlfName: data.direct.tlfName})

  // Checks the message at `ordinal` is from the second account, saying so without the name.
  const expectFromSecond = async (ordinal: number) => {
    const m = await storedMessage(ordinal)
    check(m?.author === data.secondUser, 'the message did not come from the second account')
  }

  // Back on the smoke account with no menu open and no watch left in the app, after a timeout too.
  // Mocha runs this after the describes' own afterEach. Worst case (s): close 5, keyboard 5, the two
  // watches 4, restore 160 = 174.
  afterEach(async function () {
    this.timeout(190_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, stopDeleteWatch, stopAccountChangeWatch, restoreToSmoke])
  })

  describe('basics', () => {
    it('the DM opens from its inbox row, each send settles at the end, and back returns to the inbox', async function () {
      // worst case (s): inbox 325, the composer 1, step 2, three times (sent 25, end 21) = 138, type 15,
      // the typing 5, composer 5, the tap 1, row 15, end 21, cli 80, step 2, the back 1, the inbox 10,
      // the screen 1, step 2 = 624
      this.timeout(650_000)
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
      await step('Back in the inbox', {card: true})
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

    // A thread load while the delete waits to go out still carries the row unchanged (the service never
    // puts a queued delete in a load). Offline the wait is long; here the thread is told it is stale
    // right ahead of the delete and every 100ms after while it is in flight (see
    // chooseDeleteBehindAReload and watchDeleteThroughReloads), so reloads come back before the delete
    // lands. Whether one did is timing: an attempt in which none did proves nothing and is made again,
    // up to four. Each attempt's delete goes out once, read off the recorder's call log.
    it('a delete keeps showing deleting through thread reloads until it lands', async function () {
      // worst case (s): open 100, then four times (sent 25, keyboard 5, menu 15, the pause 1, calls 2,
      // the watch 1, the delete and its call 11, the row gone 15, close 5, the watch done 16, calls 2)
      // = 392, step 2 = 494
      this.timeout(520_000)
      await openScratch()
      const attempts: Array<string> = []
      let proven = false
      for (let attempt = 1; attempt <= 4 && !proven; attempt++) {
        const text = e2eMarker('data-delete-reload')
        const ordinal = await sendMessage(text)
        await hideKeyboard()
        await openMessageMenu(text)
        // the thread throttles its loads to one per 500ms, so the first reload must not follow another
        await browser.pause(600)
        const before = await currentCallSeq()
        await watchDeleteThroughReloads(ordinal)
        // the delete is chosen from an eval, so the recorder leaves it out: the tap is the test above's
        await withHarnessRpcs('the delete behind a reload', async () => {
          await chooseDeleteBehindAReload()
          await waitForCall('the delete to go out', before, 'chat.1.local.postDeleteNonblock')
        })
        await waitFor('the row to go', async () => ((await deletePhase(ordinal)) === 'gone' ? true : undefined), {
          interval: 100,
          timeout: 15_000,
        })
        await closeMessageMenu()
        const watch = await waitFor(
          'the delete watch to finish',
          async () => {
            const w = await deleteWatch()
            return w?.done ? w : undefined
          },
          {interval: 250, timeout: 16_000}
        )
        const deletes = await callsOf(before, 'chat.1.local.postDeleteNonblock')
        check(deletes.length === 1, `the delete went out ${deletes.length} times`)
        const heard = watch.log.map(e => e.what)
        // the delete can start before the watcher's first look, so the row may be first seen deleting
        const phases = heard.filter(h => h !== 'pass')
        check(
          JSON.stringify(phases.slice(phases.indexOf('row+deleting'))) === JSON.stringify(['row+deleting', 'gone']),
          `the row went ${phases.join(' -> ')}`
        )
        const deleting = heard.slice(heard.indexOf('row+deleting') + 1, heard.indexOf('gone'))
        attempts.push(`${watch.stale} stale notifications; heard ${heard.join(' ')}`)
        proven = deleting.includes('pass')
      }
      console.log(`delete through reloads: ${attempts.join('; ')}`)
      check(proven, `no thread load landed while a row showed deleting in ${attempts.length} attempts: ${attempts.join('; ')}`)
      await step('A thread pass landed while the row showed deleting, and the row went once the delete landed', {card: true})
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
      waitFor(
        `the host to read the thumbs-up ${on ? 'on' : 'gone from'} the message`,
        async () => {
          const m = (await readFromCli(scratchOnHost())).find(x => x.content.type === 'text' && x.content.text?.body === text)
          if (!m) return undefined
          const users = Object.keys(m.reactions?.reactions?.[thumbsUp]?.users ?? {})
          return users.includes(data.smokeUser) === on ? true : undefined
        },
        {interval: 1_000, timeout: 20_000}
      )

    it('a reaction adds from the message menu and removes the same way', async function () {
      // worst case (s): open 100, sent 25, the toggle 30 (keyboard 5, menu 15, the reaction 5, the
      // menu gone 5), the store 10, cli 80, step 2, the toggle 30, the store 10, cli 80, step 2 = 369
      this.timeout(390_000)
      await openScratch()
      const text = e2eMarker('data-reaction')
      const ordinal = await sendMessage(text)
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
      // step 2, the read 1, the toggle 30, the store 10 = 255
      this.timeout(280_000)
      await openScratch()
      const text = e2eMarker('data-reaction-end')
      const ordinal = await sendMessage(text)
      await hideKeyboard()
      await expectAtEnd()
      await toggleThumbsUp(text)
      try {
        await waitFor('the reaction', async () => ((await thumbsUpFromMe(ordinal)) ? true : undefined), {timeout: 10_000})
        await expectAtEnd('after the reaction, the thread')
        await step('The reaction drawn, the thread still at its end', {card: true})
      } finally {
        if (await thumbsUpFromMe(ordinal)) {
          await toggleThumbsUp(text)
          await waitFor('the reaction to go', async () => ((await thumbsUpFromMe(ordinal)) ? undefined : true), {
            timeout: 10_000,
          })
        }
      }
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

  // A sent message's id, once the service has given it one.
  const messageID = async (ordinal: number) =>
    waitFor(
      'the message id',
      async () => {
        const id = (await storedMessage(ordinal))?.id
        return id ? id : undefined
      },
      {interval: 250, timeout: 10_000}
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
      const firstID = await messageID(firstOrdinal)
      const secondID = await messageID(secondOrdinal)
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
      await waitForCall('the mark unread to go out', before, 'chat.1.local.markAsReadLocal')
      await directReadOnHost('behind the message', r => r.readMsgid > 0 && r.readMsgid < firstID)
      await step('Marked unread: the orange line above the message, the server read pointer behind it')

      await escapeToTabs()
      await navigateToChat()
      await waitFor('the conversation to count unread', async () => ((await unreadCount(data.direct.convID)) > 0 ? true : undefined), {
        timeout: 10_000,
      })
      await step('The inbox counts the DM unread')

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

    // Nothing is older than a conversation's first message, so marking it unread has no read position
    // to move to: the app looks around the message for one (a thread load), finds none, and marks
    // nothing, so no line is drawn for a mark that never happened.
    it('mark unread on the first message of a conversation marks nothing and draws no orange line', async function () {
      // worst case (s): open 100, the oldest in view 180, step 2, calls 2, the row text 1, menu 35, the
      // load 10, the pause 3, calls 2, the lines 3, step 2 = 340
      this.timeout(360_000)
      await openDirect()
      // drag to the top until nothing older is left to load and the oldest row is in view
      const top = await waitFor(
        'the oldest message in view',
        async () => {
          const t = await waitForThreadStable()
          if (!t.moreToLoadBack && t.rows[0]?.ordinal === t.ordinals[0] && t.rows[0]!.top >= t.listTop - 1) return t
          await dragThread(600)
          return undefined
        },
        {interval: 0, timeout: 180_000}
      )
      await step('The first message of the DM in view')
      const oldest = top.ordinals[0]!
      const before = await currentCallSeq()
      await openMessageMenu(await rowText(oldest))
      await chooseMenuItem('Mark as unread')
      await waitForCall('the load around the message', before, 'chat.1.local.getThreadNonblock')
      // well past the load's answer, so a mark would have gone out
      await browser.pause(3_000)
      const marks = await callsOf(before, 'chat.1.local.markAsReadLocal')
      check(!marks.length, `${marks.length} marks went out for the first message`)
      // a line would be drawn within a frame of the answer; give it well past that
      for (const until = Date.now() + 2_000; Date.now() < until; ) {
        const lines = await orangeLineOrdinals()
        check(!lines.length, `the orange line after marking the first message unread: above ${lines.join(', ')}`)
      }
      await step('Nothing marked and no orange line', {card: true})
    })
  })

  describe('reply privately', () => {
    // The quote goes into the DM's composer, which saves it as its draft; after a timeout too.
    // Worst case (s): keyboard 5, open 100, the tap 1, clear 5 = 111.
    afterEach(async function () {
      this.timeout(130_000)
      await withCleanup(hideKeyboard, [
        async () => {
          await openDirect()
          if (await el(T.CHAT_REPLY_CANCEL).isExisting()) await el(T.CHAT_REPLY_CANCEL).click()
          await clearComposer()
        },
      ])
    })

    it('reply privately opens the DM with the message quoted, and the reply posts there', async function () {
      // worst case (s): open 100, peer 70, send 60, row 20, the read 1, keyboard 5, calls 2, menu 35,
      // the DM 15, composer 10, calls 10, step 2, the typing 5, composer 5, the tap 1, row 15,
      // composer 5, cli 80, step 2 = 443
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
      await waitForCall('the DM to be found for the reply', before, 'chat.1.local.newConversationLocal')
      await step('Reply privately opened the DM with the message quoted')

      const reply = e2eMarker('data-private-reply')
      await el(T.CHAT_INPUT).addValue(reply)
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
      // worst case (s): open 100, peer 70, send 60, row 20, the reads 2, step 2, keyboard 5, row 100,
      // step 2 = 361
      this.timeout(380_000)
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
      await step("The DM's inbox row shows the incoming message", {card: true})
    })
  })

  // The composer's calls, any of which would be the old thread speaking for the next account.
  const composerCall = (c: LoggedCall) => /^chat\.1\.local\.(updateUnsentText|updateTyping|post\w*)$/.test(c.method)

  describe('account switch', () => {
    // Back on smoke with an empty e2e-scratch composer: the typing saved a draft there for smoke.
    // After a timeout too. Worst case (s): the watch 2, restore 160, open 100, clear 5 = 267.
    afterEach(async function () {
      this.timeout(290_000)
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
      // switch 2, the typing 30, signed in 60, the pause 5, the reads 4, step 2, restore 160 = 392
      this.timeout(420_000)
      try {
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
          async () => ((await callsOf(before, 'chat.1.local.updateUnsentText')).length > 0 ? true : undefined),
          {interval: 50, timeout: 10_000}
        )
        await startAppAccountSwitch(data.secondUser)
        await typing
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
        const calls = (await callsSince(before)).calls
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
      } finally {
        await restoreToSmoke()
      }
    })

    it('a thread opened after switching accounts and back gets new messages for the account signed in', async function () {
      // worst case (s): open 100, second 250 (open 100, the screen 2, peer 70, send 60, row 20, step 2
      // inside it: 254), open 100, row 20, send 60, row 20, the read 1, step 2 = 807
      this.timeout(830_000)
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
      const methods = [...new Set((await callsSince(before)).calls.map(c => c.method))]
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
    // Whether the inbox lists the channel. It drops the channel as the leave's notification arrives
    // (about 200ms after the leave); the channel's meta still says active well after.
    const inInbox = async (convID: string) =>
      jsEval<boolean>(
        `const ls = kbModule('chat/inbox/layout-state.tsx'); return !!ls.getBigLayoutChannelRow(ls.useInboxLayoutState.getState(), ${JSON.stringify(convID)})`
      )
    // the throwaway channels a test made, for the afterEach to delete
    let created: Array<string> = []

    // Deletes the channels from the host, then puts the app back on smoke, each whether the one
    // before threw; after a timeout too. Worst case (s), one channel: delete 120, restore 160 = 280.
    afterEach(async function () {
      this.timeout(300_000)
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
      // 250 (open 100, the inbox 15, step 2, leave 60, the 5s watch 6, step 2: 185) = 650
      this.timeout(680_000)
      const {convID, topicName} = await createThrowawayChannel('dsel')
      created.push(topicName)
      // the peer's inbox may not list a channel this new yet: its first send waits until it does
      await sendWithRetry(await sender(), convID, e2eMarker('data-selection-hello'))
      await asSecond(async () => {
        await openConversation(convID)
        await waitFor('the inbox to list the channel', async () => ((await inInbox(convID)) ? true : undefined), {timeout: 15_000})
        await step('As the second account, the throwaway channel open')
        await (await sender()).leave(convID)
        const shown = new Set<string | null>()
        let left = false
        for (const until = Date.now() + 5_000; Date.now() < until; ) {
          shown.add(await visibleConversation())
          left ||= !(await inInbox(convID))
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

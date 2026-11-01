// What the phone sends for a message once it is in the thread: an edit, a message too long to send
// (pasted in, failing, and cancelled from its row), a forward to the self conversation, an exploding
// message running out and one exploded from its menu, a channel's history cleared, a pinned message
// dismissed by a member, the emoji skin tone, and the GIF picker up to the pick (a person's).
//
// Each acts in e2e-scratch, the self conversation or a throwaway channel of KB_E2E_TEAM this run
// made. The host stays on the smoke account: it seeds, reads back, and makes and deletes the
// channels. The second account's own view comes from the app switched to it and from its peer
// service. Every body and title is stamped with the run id. What a test changes is put back by the
// flow's afterEach, after a timeout too: the stuck outbox record, the exploding mode, the skin tone,
// and the throwaway channels (a pin goes with its channel).
import {loadE2EEnv} from '../../accounts/env'
import {
  E2E_CHANNELS,
  attachFromCli,
  directConvIDFromCli,
  ensureChatData,
  sendToThrowawayFromCli,
  type ChatData,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {convIDBytes} from '../../shared/conv-id.ts'
import {mainRpc} from '../../shared/main-rpc.ts'
import {sendWithRetry} from '../../shared/peer-actors'
import {ensurePeer} from '../../shared/peer-service.ts'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {asSecond, restoreToSmoke} from '../gate/accounts'
import {creditSurface} from '../gate/attempt'
import {forwardResultMatches} from '../gate/chat-lib'
import {setPasteboard} from '../gate/device'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {requireSecondNotBlocked} from '../gate/blocks'
import {manualEdge, step} from '../gate/step'
import {
  appPinnedMessageID,
  appSkinTone,
  cancelAppOutbox,
  clearComposer,
  closeInfoPanel,
  closeMessageMenu,
  composerText,
  dragUntilOnScreen,
  editCancel,
  elementInRow,
  expectPersists,
  explodingModeSeconds,
  giphyGalleryShown,
  hideKeyboard,
  messageIDAt,
  openConversation,
  openHeaderMenuItem,
  openMessageMenu,
  ordinalsWithText,
  outboxIDsWithText,
  pasteIntoComposer,
  pinnedBanner,
  pressInlineText,
  readThread,
  resetComposer,
  restoreAppSkinTone,
  sendMessage,
  shownSkinTone,
  signedInAs,
  storedAttachment,
  storedMessageState,
  typeInComposer,
  typeInSearchFilter,
  visibleConversation,
  waitForComposerText,
  waitForRow,
} from '../helpers/chat'
import {check, chooseMenuItem} from '../helpers/menus'
import {expectCli, expectHost, pinnedOnHost, secondSender, textBodies, throwawayChannels} from '../helpers/chat-host'
import {el, els} from '../helpers/elements'
import {appSnapshot, waitFor} from '../helpers/lifecycle'
import {goBackUntilGone} from '../helpers/navigate'

describe('chat messages', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  sent  sendMessage 25;  row  waitForRow 15 (30 where given)
  //   id        a sent message's id 10;  keyboard  5;  menu  openMessageMenu 15 + chooseMenuItem 20 = 35
  //   cli       a host read polled 80 (20, overrun by one read's 60);  host  one host send or attach 60
  //   gregor    the host's gregor read 75 (whoami 15, the call 60), polled 95;  pin  the host's read
  //             of a conversation's pin 75, polled 95
  //   peer      the peer found 45 and a failing call's diagnosis 25 = 70;  peer send  sendWithRetry 90
  //             (30, overrun by one send's 60);  peer pin  the second peer's read 65 (found 45, call 20)
  //   app       one ask of the phone's own service 25 (20, the pause and resume);  polled 45
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   second    asSecond 425 (the switch 150, restoreToSmoke 275);  restore  restoreToSmoke 275
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120
  //   relaunch  relaunchApp 200;  signed in  90
  //   paste     setPasteboard 50, the edit menu's Paste 20 and its tap 1 = 71;  its length polled 20
  //   panel     the header menu 15, the panel 10, a tab 10 = 35
  //   clear     clearComposer 21 (clearFieldByKeys 16, the composer read empty 5)
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // the second account's messages and switches need it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  const scratch = () => data.convIDs[E2E_CHANNELS.scratch]
  const openScratch = async () => openConversation(scratch())

  // -- what the afterEach puts back ---------------------------------------------------------------
  // Each is set before the change it undoes and cleared once its restore reads back, so the restore
  // runs only when needed and a second run of it does nothing.

  // the marker of an over-length message the phone may still hold in its outbox
  let tooLongMarker: string | undefined
  // gregor categories of exploding modes a test set
  const explodingCategories = new Set<string>()
  // the skin tone the phone had before a test changed it
  let skinToneBefore: number | undefined
  // throwaway channels a test made (a pin in one goes when it is deleted)
  const channels = throwawayChannels()

  // -- reads --------------------------------------------------------------------------------------

  // The smoke account's gregor item of `category`, as the host reads it (the server keeps the
  // exploding mode there, for every device), as text, or null when there is none.
  type GregorState = {items?: Array<{item?: {body?: Uint8Array | null; category: string} | null}> | null}
  const gregorBody = async (category: string) => {
    const state = await mainRpc<GregorState>('keybase.1.gregor.getState', {})
    const item = state.items?.find(i => i.item?.category === category)?.item
    return item ? Buffer.from(item.body ?? new Uint8Array()).toString('utf8') : null
  }
  const expectGregor = async (what: string, category: string, want: string | null) =>
    expectHost(what, async () => gregorBody(category), b => b === want)

  // The conversation's pin as the second account's peer service localizes it: 'shown' (a pin message
  // and its pinned message), 'ignored' (a pin message, hidden for this device) or 'none' (no pin
  // message yet). The peer is another device of the second account: a dismissal is kept on the device
  // that made it, so the phone's never reaches it.
  const peerPinState = async (convID: string) => {
    type Conv = {info: {pinnedMsg?: object | null}; maxMessages?: Array<{messageType: number}> | null}
    const rpc = await (await ensurePeer('second', loadE2EEnv())).rpc()
    try {
      const res = await rpc.call<{conversations?: Array<Conv> | null}>(
        'chat.1.local.getInboxAndUnboxLocal',
        {
          identifyBehavior: 6, // chatSkip
          query: {computeActiveList: false, convIDs: [convIDBytes(convID)], readOnly: false, unreadOnly: false},
        },
        20_000
      )
      const conv = res.conversations?.[0]
      if (!conv) throw new Error("the second account's peer reads no such conversation")
      const pinType = 18 // MessageType.pin
      if (!conv.maxMessages?.some(m => m.messageType === pinType)) return 'none'
      return conv.info.pinnedMsg ? 'shown' : 'ignored'
    } finally {
      rpc.close()
    }
  }

  // -- restores -----------------------------------------------------------------------------------

  const resetExplodingModes = async () => {
    for (const category of [...explodingCategories]) {
      if ((await gregorBody(category)) !== null) {
        await mainRpc('keybase.1.gregor.dismissCategory', {category})
        await expectGregor('the exploding mode off', category, null)
      }
      explodingCategories.delete(category)
    }
  }

  // The phone's restores are the signed-in account's: they run only on the smoke account, and a state
  // left set waits for the next afterEach.
  const requireSmoke = async (what: string) => {
    const a = await signedInAs()
    check(a.loggedIn && !a.switching && a.username === data.smokeUser, `not ${what}: the app is not on the smoke account`)
  }

  const restoreSkinTone = async () => {
    if (skinToneBefore === undefined) return
    await requireSmoke('restoring the skin tone')
    const want = skinToneBefore
    if ((await appSkinTone()) !== want) await restoreAppSkinTone(want)
    check((await appSkinTone()) === want, `the skin tone did not go back to ${want}`)
    skinToneBefore = undefined
  }

  // e2e-scratch with no edit or reply under way and an empty composer, and no outbox record of an
  // over-length message left: the service keeps a failed record through reloads, and only the
  // phone's own service has it, so it is cancelled there (recorder paused). Needs the app on the
  // smoke account.
  const resetScratch = async () => {
    await requireSmoke('resetting e2e-scratch')
    await openScratch()
    if (tooLongMarker !== undefined) {
      // the thread brings the outbox records with its first load
      await waitFor('e2e-scratch to load', async () => ((await readThread())?.ordinals.length ? true : undefined), {
        interval: 250,
        timeout: 15_000,
      })
      await cancelAppOutbox(await outboxIDsWithText(tooLongMarker))
      tooLongMarker = undefined
    }
    await resetComposer()
  }

  // Back on smoke with nothing a test changed left behind, after a timeout too. The host's restores
  // go first; the phone's need the app back on smoke. Worst case (s): close 19, keyboard 5, the
  // exploding mode 245 (a read 75, the dismiss 75 and its poll 95), a channel 120, restore 275, the
  // skin tone 85 (the account 10, three asks), scratch 197 (the account 10, open 100, the load 15, the
  // ids 1, one cancel 25, resetComposer 46) = 946.
  afterEach(async function () {
    this.timeout(960_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, resetExplodingModes, channels.deleteAll, restoreToSmoke, restoreSkinTone, resetScratch])
  })

  it('an edit posted from the menu shows in the row, and the host reads the new body', async function () {
    // worst case (s): open 100, sent 25, id 10, cli 80, keyboard 5, menu 35, the edit bar 5, composer
    // 5, clear 21, type 15, the seq 2, the button 5, the tap 1, the row 15, calls 10, step 2, cli 80,
    // step 2 = 418
    this.timeout(440_000)
    await openScratch()
    const before = e2eMarker('msg-edit')
    const ordinal = await sendMessage(before)
    await messageIDAt(ordinal)
    await expectCli({topicName: E2E_CHANNELS.scratch}, 'the message', ms => textBodies(ms).includes(before))
    await hideKeyboard()
    await openMessageMenu(before)
    await chooseMenuItem('Edit')
    await editCancel().waitForExist({timeout: 5_000})
    await waitForComposerText(before)

    await clearComposer()
    const after = e2eMarker('msg-edited')
    await typeInComposer(after)
    const seq = await currentCallSeq()
    await el(T.CHAT_SEND_BUTTON).waitForExist({timeout: 5_000})
    await el(T.CHAT_SEND_BUTTON).click()
    await waitFor(
      'the row to show the edit',
      async () => {
        const m = await storedMessageState(ordinal)
        return m?.edited && m.text.includes(after) && !m.text.includes(before) ? true : undefined
      },
      {interval: 250, timeout: 15_000}
    )
    await waitForUiCall('the edit to go out', seq, 'chat.1.local.postEditNonblock')
    await step('Edited: the row shows the new body')
    await expectCli({topicName: E2E_CHANNELS.scratch}, 'the edited body and not the old one', ms => {
      const bodies = textBodies(ms)
      return bodies.includes(after) && !bodies.includes(before)
    })
    await step('The host reads the edited body', {card: true})
  })

  // The service refuses a text over 10000 bytes before it leaves the outbox, so it never reaches the
  // server: the row stays failed, offering Edit or Cancel, and Cancel drops the record. The text goes
  // in by the pasteboard (typing 10001 keys would take minutes), and it is filler: the run's marker,
  // then x's.
  it('a pasted message over the length limit fails, and its Cancel drops it for good', async function () {
    // worst case (s): open 100, sent 25 (the anchor), keyboard 5, paste 71, its length 20, step 2, the
    // button 5, the tap 1, row 30, the failed record 30, composer 5, keyboard 5, step 2, the seq 2, the
    // edge 2, the press 1, the row gone 15, calls 10, the record 1, step 2, relaunch 200, signed in 90,
    // open 100, the anchor 20, the read 1, cli 80, step 2 = 827
    this.timeout(880_000)
    await openScratch()
    // a message sent first, which shows the thread loaded after the relaunch
    const anchor = e2eMarker('msg-toolong-anchor')
    await sendMessage(anchor)
    await hideKeyboard()

    const marker = e2eMarker('msg-toolong')
    const text = `${marker} ${'x'.repeat(10_001)}`
    tooLongMarker = marker
    await setPasteboard(text)
    await pasteIntoComposer()
    await waitFor(
      'the composer to hold the pasted text',
      async () => {
        const now = await composerText()
        return now.length === text.length && now.startsWith(marker) ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    creditSurface('pasteboard')
    await step('The over-length text pasted into the composer')

    await el(T.CHAT_SEND_BUTTON).waitForExist({timeout: 5_000})
    await el(T.CHAT_SEND_BUTTON).click()
    const ordinal = await waitForRow(marker, 30_000)
    // the record the app holds: in its outbox, never sent, failed as too long (OutboxErrorType 3)
    await waitFor(
      'the message to fail as too long',
      async () => {
        const m = await storedMessageState(ordinal)
        return m?.id === 0 && !!m.outboxID && m.submitState === 'failed' && m.errorTyp === 3 ? true : undefined
      },
      {interval: 500, timeout: 30_000}
    )
    await waitForComposerText('', 5_000)
    await hideKeyboard()
    await step('The message failed: too long, with Edit or Cancel', {card: true})

    // The row's Cancel is inline text with no element or frame on iOS: its own handler is called and
    // a person checks the tap (ledger ruling); the CancelPost it sends is the app's own.
    const beforeCancel = await currentCallSeq()
    await manualEdge('failed-send-cancel')
    await pressInlineText(ordinal, 'Cancel')
    await waitFor('the failed row to go', async () => ((await ordinalsWithText(marker)).length === 0 ? true : undefined), {
      interval: 250,
      timeout: 15_000,
    })
    await waitForUiCall('the cancel to go out', beforeCancel, 'chat.1.local.CancelPost')
    const record = await storedMessageState(ordinal)
    check(!record, `the outbox record is still in the thread: ${JSON.stringify(record)}`)
    await step('Cancelled: the failed row is gone')

    // an outbox record comes back with the thread after a relaunch, so this shows the service dropped it
    await expectPersists(
      'rows of the cancelled message in e2e-scratch',
      async () => {
        await openScratch()
        await waitForRow(anchor, 20_000)
        return (await ordinalsWithText(marker)).length
      },
      0
    )
    creditSurface('relaunch')
    await expectCli({topicName: E2E_CHANNELS.scratch}, 'the anchor and no message with the marker', ms => {
      const bodies = textBodies(ms)
      return bodies.includes(anchor) && bodies.every(b => !b.startsWith(marker))
    })
    await step('After a relaunch the cancelled message is still gone, and the server never had it')
  })

  // Forward is offered for attachments and messages with unfurls: the host attaches an image, the
  // account's own from another device, and the phone forwards it.
  it('an attachment forwarded to the self conversation lands there with its caption', async function () {
    // worst case (s): open 100, host 60, the row 60, ready 60, keyboard 5, menu 35, the picker 10, the
    // screen 1, the search box 5, type 15, the result polled 15, the tap 1, the caption 10, type 15,
    // its value 5, step 2, the seq 2, send 5, the tap 1, the destination 20, cli 80, the self id 60,
    // calls 10, row 30, step 2 = 609
    this.timeout(680_000)
    await openScratch()
    const title = e2eMarker('msg-fwd')
    await attachFromCli(E2E_CHANNELS.scratch, title)
    const ordinal = await waitForRow(title, 60_000)
    await waitFor(
      'the image to be ready',
      async () => {
        const a = await storedAttachment(ordinal)
        return a && a.id > 0 && a.hasPreview && !a.transferState ? true : undefined
      },
      {interval: 500, timeout: 60_000}
    )
    await hideKeyboard()
    await openMessageMenu(title)
    await chooseMenuItem('Forward')
    await el(T.CHAT_FORWARD_SEARCH).waitForExist({timeout: 10_000})
    check((await appSnapshot()).screen?.name === 'chatForwardMsgPick', 'Forward did not open the forward picker')

    await typeInSearchFilter(data.smokeUser)
    // the self conversation, by its name in memory: no selector holds it
    const selfRow = await waitFor(
      'the self conversation among the results',
      async () => {
        const matches: Array<WebdriverIO.Element> = []
        for (const r of await els(T.CHAT_FORWARD_RESULT).getElements()) {
          const label = await r.getAttribute('label').catch(() => null)
          if (label !== null && forwardResultMatches(label, data.smokeUser)) matches.push(r)
        }
        if (matches.length > 1) throw new Error(`${matches.length} results match the self conversation`)
        return matches[0]
      },
      {interval: 500, timeout: 15_000}
    )
    await selfRow.click()

    // an attachment asks for its caption: the forward keeps the run's title
    await el(T.CHAT_FORWARD_CAPTION).waitForExist({timeout: 10_000})
    await el(T.CHAT_FORWARD_CAPTION).addValue(title)
    await waitFor('the caption to hold the title', async () => ((await el(T.CHAT_FORWARD_CAPTION).getAttribute('value')) === title ? true : undefined), {
      interval: 250,
      timeout: 5_000,
    })
    await step('The forward caption')
    const seq = await currentCallSeq()
    const send = browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Send" AND visible == 1')
    await send.waitForExist({timeout: 5_000})
    await send.click()

    // the forward opens the destination
    const destination = await waitFor(
      'the forward to open its destination',
      async () => {
        const now = await visibleConversation()
        return now && now !== scratch() ? now : undefined
      },
      {interval: 250, timeout: 20_000}
    )
    await expectCli({tlfName: data.smokeUser}, "the forward as the self conversation's newest message", ms => {
      const newest = ms[0]
      return newest?.content.type === 'attachment' && newest.content.attachment?.object?.title === title
    })
    check(destination === (await directConvIDFromCli(data.smokeUser)), 'the forward opened another conversation than the self conversation')
    await waitForUiCall('the forward to go out', seq, 'chat.1.local.forwardMessageNonblock')
    await waitForRow(title, 30_000)
    await step('Forwarded: the self conversation shows it, and the host reads it there', {card: true})
  })

  // In a throwaway channel: the exploding mode is the conversation's own setting, kept in the smoke
  // account's gregor state. Bound 90s from the send, not 30s: the service queues a due explosion
  // behind its loader of long conversations (desktop saw 20s past the timer).
  it('an exploding message counts down and explodes, and Explode now explodes another at once', async function () {
    // worst case (s): channel 240, open 100, the mode 1, gregor 75, the seq 2, the button 1, the item
    // 20, calls 10, gregor 95, the label 5, step 2, sent 25, the countdown 12 (the meta 10, in row 2),
    // the pause 2, its second read 1, step 2, exploded 90, step 2, sent 25, keyboard 5, menu 35, the
    // seq 2, exploded 20, calls 10, step 2 = 784
    this.timeout(840_000)
    const {convID} = await channels.make('explode', {withSecond: false})
    const category = `exploding:${convID}`
    await openConversation(convID)
    check((await explodingModeSeconds()) === 0, 'a new channel starts with exploding messages on')
    check((await gregorBody(category)) === null, 'the host reads an exploding mode for a new channel')

    explodingCategories.add(category)
    let seq = await currentCallSeq()
    await el(T.CHAT_EXPLODING_BUTTON).click()
    await chooseMenuItem('30 seconds')
    await waitForUiCall('the exploding mode to go out', seq, 'keybase.1.gregor.updateCategory')
    await expectGregor('the exploding mode at 30 seconds', category, '30')
    await waitFor(
      'the timer button to read 30s',
      async () => (((await el(T.CHAT_EXPLODING_BUTTON).getAttribute('label')) ?? '').includes('30s') ? true : undefined),
      {interval: 250, timeout: 5_000}
    )
    await step('Exploding messages on, at 30 seconds')

    const text = e2eMarker('msg-explode')
    const ordinal = await sendMessage(text)
    const sentAt = Date.now()
    const countdown = async () => {
      const meta = await elementInRow(`~${T.CHAT_EXPLODING_META}`, ordinal, 'the exploding countdown')
      const m = /^(\d+)s$/.exec((await meta.getAttribute('label')) ?? '')
      return m ? Number(m[1]) : undefined
    }
    const first = await waitFor('the countdown to show', countdown, {interval: 250, timeout: 10_000})
    await new Promise(resolve => setTimeout(resolve, 2_000))
    const second = await countdown()
    check(second !== undefined && second < first, 'the exploding countdown did not count down')
    await step('The countdown')
    await waitFor(
      'the message to explode',
      async () => {
        const m = await storedMessageState(ordinal)
        return m?.exploded && !m.text.includes(text) ? true : undefined
      },
      {interval: 1_000, timeout: Math.max(1_000, sentAt + 90_000 - Date.now())}
    )
    await step('Exploded', {card: true})

    const now = e2eMarker('msg-explode-now')
    const nowOrdinal = await sendMessage(now)
    await hideKeyboard()
    await openMessageMenu(now)
    seq = await currentCallSeq()
    await chooseMenuItem('Explode now')
    await waitFor(
      'the message to explode at once',
      async () => {
        const m = await storedMessageState(nowOrdinal)
        return m?.exploded && m.explodedBy === data.smokeUser && !m.text.includes(now) ? true : undefined
      },
      {interval: 250, timeout: 20_000}
    )
    await waitForUiCall('the explosion to go out', seq, 'chat.1.local.postDeleteNonblock')
    await step('Explode now: exploded at once, by the account')
  })

  it("delete history clears a throwaway channel's messages for everyone", async function () {
    // worst case (s): channel 240, three host sends 180, cli 80, open 100, three rows 90, panel 35, the
    // button 20, the tap 1, the warning 10, the conversation 1, step 2, past the newest send 10, the seq
    // 2, the tap 1, the warning gone 10, calls 10, the back 10, gone 5, the conversation 1, the rows gone
    // 20, step 2, host 60, cli 80, row 30, step 2 = 1002
    this.timeout(1_060_000)
    const {convID, topicName} = await channels.make('history', {withSecond: false})
    const texts = [e2eMarker('msg-hist'), e2eMarker('msg-hist'), e2eMarker('msg-hist')]
    for (const t of texts) await sendToThrowawayFromCli(topicName, t)
    // when the server took the newest, in its own clock
    let newestSentAt = 0
    await expectCli({topicName}, 'the three messages', ms => {
      const sent = ms.filter(m => m.content.type === 'text' && texts.includes(m.content.text?.body ?? ''))
      newestSentAt = Math.max(0, ...sent.map(m => m.sent_at_ms ?? 0))
      return sent.length === texts.length && newestSentAt > 0
    })
    await openConversation(convID)
    for (const t of texts) await waitForRow(t, 30_000)

    await openHeaderMenuItem('Info', async () => el(T.CHAT_INFO_PANEL).isExisting())
    await el(T.CHAT_INFO_PANEL_SETTINGS_TAB).waitForExist({timeout: 10_000})
    await el(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
    const clear = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Clear entire conversation"')
    await dragUntilOnScreen('"Clear entire conversation"', clear)
    await clear().click()
    const confirm = browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Yes, clear for everyone" AND visible == 1')
    await confirm.waitForExist({timeout: 10_000})
    // the warning clears whatever conversation it was opened over: it must be the throwaway channel
    check((await visibleConversation()) === convID, 'the clear history warning is not over the throwaway channel')
    await step('The clear history warning')
    // The clear cuts off at the server's time, and a message the server took within about 2s before it
    // survives. So the tap waits, if it must, until 5s past the server's own stamp of the newest send;
    // the steps above nearly always outlast that.
    await waitFor('5s past the newest send', () => (Date.now() >= newestSentAt + 5_000 ? true : undefined), {
      interval: 250,
      timeout: 10_000,
    })
    const seq = await currentCallSeq()
    await confirm.click()
    await confirm.waitForExist({reverse: true, timeout: 10_000})
    await waitForUiCall('the clear to go out', seq, 'chat.1.local.postDeleteHistoryByAge')
    await closeInfoPanel()
    check((await visibleConversation()) === convID, 'back from the info panel is not the throwaway channel')
    await waitFor(
      'the cleared rows to go',
      async () => {
        for (const t of texts) if ((await ordinalsWithText(t)).length) return undefined
        return true
      },
      {interval: 500, timeout: 20_000}
    )
    await step('History cleared: the rows are gone')
    // a message sent once the clear has landed: the channel reads, and holds only it
    const after = e2eMarker('msg-hist-after')
    await sendToThrowawayFromCli(topicName, after)
    await expectCli({topicName}, 'the message sent after the clear, and none of the cleared ones', ms => {
      const bodies = textBodies(ms)
      return bodies.includes(after) && texts.every(t => !bodies.includes(t))
    })
    await waitForRow(after, 30_000)
    await step('The host reads only the message sent after the clear', {card: true})
  })

  // The smoke account owns the team, so its close unpins for everyone; a writer's close hides the pin
  // for that device only (the service keeps the dismissal on the device): what this checks, as the
  // phone signed in as the second account, with the second account's other device (its peer) still
  // shown the pin.
  it('a writer dismisses a pinned banner for itself, and it stays dismissed through a relaunch', async function () {
    // worst case (s): channel 240, peer 70, peer send 90, open 100, sent 25, id 10, keyboard 5, menu 35,
    // the banner 10, its text 5, pin 95, peer pin 65, step 2; asSecond 425 and in it: open 100, the
    // banner 10, its text 5, the unpin 1, the dismiss 5, app 25, step 2, the seq 2, the tap 1, the
    // banner gone 10, calls 10, app polled 45, peer pin 65, step 2, relaunch 200, signed in 90, open
    // 100, row 30, the banner 1, app 25, step 2 = 731; then open 100, the banner 10, its text 5, pin
    // 75, step 2 = 2100
    this.timeout(2_150_000)
    const {convID} = await channels.make('pin')
    await sendWithRetry(await secondSender(), convID, e2eMarker('msg-pin-hello'))
    await openConversation(convID)
    const text = e2eMarker('msg-pin')
    const ordinal = await sendMessage(text)
    const id = await messageIDAt(ordinal)
    await hideKeyboard()
    await openMessageMenu(text)
    await chooseMenuItem('Pin message')
    const bannerSays = async () => ((await pinnedBanner().getAttribute('label')) ?? '').includes(text)
    await pinnedBanner().waitForExist({timeout: 10_000})
    await waitFor('the banner to show the pinned message', async () => ((await bannerSays()) ? true : undefined), {timeout: 5_000})
    await expectHost('the message pinned', async () => pinnedOnHost(convID), p => p === id)
    check((await peerPinState(convID)) === 'shown', "the second account's other device is not shown the pin")
    await step('Pinned by the owner')

    await asSecond(async () => {
      await openConversation(convID)
      await pinnedBanner().waitForExist({timeout: 10_000})
      await waitFor('the banner to show the pinned message', async () => ((await bannerSays()) ? true : undefined), {timeout: 5_000})
      check(!(await el(T.CHAT_PINNED_UNPIN).isExisting()), 'a writer is asked to unpin for everyone')
      await el(T.CHAT_PINNED_DISMISS).waitForExist({timeout: 5_000})
      check((await appPinnedMessageID(convID)) === id, "the phone's service does not show the second account the pin")
      await step('The pinned banner as a writer')

      const seq = await currentCallSeq()
      await el(T.CHAT_PINNED_DISMISS).click()
      await pinnedBanner().waitForExist({reverse: true, timeout: 10_000})
      await waitForUiCall('the dismiss to go out', seq, 'chat.1.local.ignorePinnedMessage')
      await waitFor("the phone's service to hide the pin", async () => ((await appPinnedMessageID(convID)) === null ? true : undefined), {
        interval: 1_000,
        timeout: 20_000,
      })
      check((await peerPinState(convID)) === 'shown', "the dismiss reached the second account's other device")
      await step('Dismissed: no banner, the pin hidden on this device only')

      await expectPersists(
        'the dismissed pin',
        async () => {
          await openConversation(convID)
          await waitForRow(text, 30_000)
          return {banner: await pinnedBanner().isExisting(), pinned: await appPinnedMessageID(convID)}
        },
        {banner: false, pinned: null}
      )
      creditSurface('relaunch')
      await step('After a relaunch the banner stays dismissed')
    })

    // dismissing hides it for the second account's device only
    await openConversation(convID)
    await pinnedBanner().waitForExist({timeout: 10_000})
    await waitFor('the banner to show the pinned message', async () => ((await bannerSays()) ? true : undefined), {timeout: 5_000})
    check((await pinnedOnHost(convID)) === id, 'the dismiss unpinned the message for everyone')
    await step('Back as the owner: the pin is still there', {card: true})
  })

  // The phone's options row lists the tones in their order: the default (0) first, then 1 to 5.
  const TONE_CODES = ['1F3FA', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'] as const

  it('a skin tone picked in the emoji picker is saved, and stays through a relaunch', async function () {
    // worst case (s): app 25, open 100, the button 1, the picker 10, keyboard 5, the tone button 5 and
    // its tap 1, the options 5, the seq 2, the option 5 and its tap 1, the options gone 5, calls 10, app
    // polled 45, the shown tone 1, step 2, the back 10, gone 5, relaunch 200, signed in 90, the shown
    // tone polled 30, step 2 = 560
    this.timeout(600_000)
    const original = await appSkinTone()
    // a tone that is not the one in use, so the change shows
    const want = original === 3 ? 2 : 3
    await openScratch()
    await el(T.CHAT_EMOJI_BUTTON).click()
    await el(T.CHAT_EMOJI_PICKER).waitForExist({timeout: 10_000})
    // the picker's search takes the keyboard, which covers the skin tone button
    await hideKeyboard()
    await el(T.CHAT_SKIN_TONE_BUTTON).waitForExist({timeout: 5_000})
    await el(T.CHAT_SKIN_TONE_BUTTON).click()
    await el(T.CHAT_SKIN_TONE_OPTIONS).waitForExist({timeout: 5_000})

    skinToneBefore = original
    const seq = await currentCallSeq()
    const option = el(T.CHAT_SKIN_TONE_OPTION_PREFIX + TONE_CODES[want])
    await option.waitForExist({timeout: 5_000})
    await option.click()
    await el(T.CHAT_SKIN_TONE_OPTIONS).waitForExist({reverse: true, timeout: 5_000})
    await waitForUiCall('the skin tone to go out', seq, 'chat.1.local.putReacjiSkinTone')
    await waitFor(`the phone's service to keep tone ${want}`, async () => ((await appSkinTone()) === want ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })
    check((await shownSkinTone()) === want, `the app does not show tone ${want}`)
    await step(`Skin tone ${want} picked`)
    await goBackUntilGone(T.CHAT_EMOJI_PICKER)
    await el(T.CHAT_EMOJI_PICKER).waitForExist({reverse: true, timeout: 5_000})

    await expectPersists(
      'the skin tone',
      async () => {
        return waitFor('the app to load its skin tone', shownSkinTone, {interval: 500, timeout: 30_000})
      },
      want
    )
    creditSurface('relaunch')
    await step(`After a relaunch the app shows tone ${want}`, {card: true})
  })

  // The phone's picker is a web view of the service's gallery page, and a tap on a GIF there asks the
  // service itself to post it (so the app sends no trackGiphySelect; desktop's picker does). The
  // WKWebView exposes no image of the page to XCUITest (seen live), so the pick is a person's
  // (ledger ruling). It runs in a throwaway channel, which a GIF picked there by hand would post to.
  it('Share a GIF opens the GIF picker for the search typed, where a person picks one', async function () {
    // worst case (s): channel 240, open 100, the button 1, the item 10 and its tap 1, composer 5, type
    // 15, composer 5, the gallery 30, step 2, the edge 2, clear 21, the gallery gone 15 = 447
    this.timeout(460_000)
    const {convID} = await channels.make('giphy', {withSecond: false})
    await openConversation(convID)
    await el(T.CHAT_MORE_BUTTON).click()
    // the row reads "<glyph>, Share a GIF, /giphy": its icon, the title, then its subtitle
    const gifItem = browser.$('-ios predicate string:type == "XCUIElementTypeOther" AND label ENDSWITH ", Share a GIF, /giphy" AND visible == 1')
    await gifItem.waitForExist({timeout: 10_000})
    await gifItem.click()
    await waitForComposerText('/giphy ')
    await el(T.CHAT_INPUT).addValue('cat')
    await waitForComposerText('/giphy cat')
    await waitFor('the GIF picker', async () => ((await giphyGalleryShown()) ? true : undefined), {interval: 500, timeout: 30_000})
    await step('The GIF picker for the search')
    await manualEdge('giphy-pick')
    await clearComposer()
    await waitFor('the GIF picker to close', async () => ((await giphyGalleryShown()) ? undefined : true), {interval: 500, timeout: 15_000})
  })
})

// Where the iOS thread scrolls, read off the list as the app holds it: opening lands at the end, new
// messages keep a reader at the end there (keyboard up or not) and leave one in history where they
// are, search hits centre and let the reader take over with a drag, older pages load without moving
// the reader (and with nobody scrolling when the first page draws too little to scroll), newer pages
// load as the reader nears the newest row loaded until the present is reached (from a search hit or
// after Catch up), an edit stays in view as the keyboard rises for it, and the list keeps its place
// across an edit, a mark unread and a trip to the info panel.
//
// The app stays on the smoke account throughout. Incoming messages come from the second account's
// peer service; what the phone sends is smoke's own. Every body is stamped with the run id.
import {
  E2E_CHANNELS,
  LONG_COUNT,
  LONG_SEARCH_TOKENS,
  SHORT_COUNT,
  SPARSE_NEWER,
  SPARSE_OLDER,
  channelUnreadFromCli,
  ensureChatData,
  longMarker,
  shortMarker,
  sparseMarker,
  type ChatData,
  type E2EChannel,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {requireSecondNotBlocked} from '../gate/blocks'
import {step} from '../gate/step'
import {
  catchUpPill,
  centreOffset,
  centreTolerance,
  clearComposer,
  closeInfoPanel,
  closeSearch,
  dragThread,
  editCancel,
  expectAtEnd,
  expectCentred,
  flickThread,
  hideKeyboard,
  isAtEnd,
  isKeyboardUp,
  jumpToRecentButton,
  newestGap,
  openConversation,
  openHeaderMenuItem,
  openMessageMenu,
  openThreadSearch,
  ordinalsWithText,
  pickAnchor,
  readThread,
  requireThread,
  resetComposer,
  rowOf,
  rowText,
  sampleThreadWhile,
  sampleTop,
  searchAgain,
  searchFor,
  searchOpen,
  sendMessage,
  summary,
  tapStatusBar,
  threadListPrelude,
  type ThreadReading,
  type ThreadSample,
  viewport,
  type Viewport,
  waitForKeyboard,
  waitForRow,
  waitForThreadStable,
  wholly,
} from '../helpers/chat'
import {check, chooseMenuItem} from '../helpers/menus'
import {secondSender} from '../helpers/chat-host'
import {el} from '../helpers/elements'
import {jsEval, waitFor} from '../helpers/lifecycle'

describe('chat scroll', function () {
  // no retries: a retry would let an intermittent race pass
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100 (keyboard 5, escapeToTabs 30, chat tab 10, the link 20, the
  //             thread's composer, push and list 35)
  //   stable    waitForThreadStable 10 (20 where given)
  //   end       expectAtEnd 21 (a stable reading, retaken for up to 3s)
  //   centred   expectCentred 20;  row  waitForRow 15 (20 where given)
  //   search    openThreadSearch 20 + searchFor 66 (its 30 overall, overrun by one try's waits, its
  //             clear 16 among them);  searchAndSelect 106;  close  closeSearch 5
  //   clear     clearComposer 21 (clearFieldByKeys 16, the composer read empty 5)
  //   peer      the peer found, on the first send of a test, 45, and a failing send's diagnosis 25;
  //             send  one peer send 60
  //   menu      openMessageMenu 15 + chooseMenuItem 20 = 35;  sent  sendMessage 25
  //   unread    one host read 25 (whoami 15, the read 10); a polled read 45 (20, overrun by one read)
  //   drag      a drag or tap 2;  step  2 (its 1s settle and the attach);  keyboard  5
  // A sum that holds a cap (paging steps) counts every step to it.

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // the second account's messages and switches need it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  // No thread search left open, after a timeout too: closing it needs the thread still on screen,
  // so it runs before the gate's own afterEach. Worst case (s): the read 1, close 5 = 6.
  afterEach(async function () {
    this.timeout(20_000)
    await withCleanup(async () => {
      if (await searchOpen()) await closeSearch()
    }, [])
  })

  const sendIncoming = async (channel: E2EChannel, text: string) => (await secondSender()).send(data.convIDs[channel], text)

  const openLong = async () => openConversation(data.convIDs[E2E_CHANNELS.long])
  const openScratch = async () => openConversation(data.convIDs[E2E_CHANNELS.scratch])

  // How far a row the reader is looking at may move while nothing the reader did moved it.
  const stillTolerance = 2

  const expectRowWhere = (t: ThreadReading, anchor: {ordinal: number; top: number}, what: string) => {
    const r = rowOf(t, anchor.ordinal)
    check(!!r, `${what}: row ${anchor.ordinal} is no longer measured`)
    check(
      Math.abs(r!.top - anchor.top) <= stillTolerance,
      `${what}: row ${anchor.ordinal} moved from ${anchor.top} to ${r!.top}`
    )
  }

  // Waits for the rows loaded to hold for 2s (the page a thread asks for as it opens lands within a
  // second or two), and returns that reading.
  const waitForRowsToHold = async () =>
    waitFor(
      'the rows loaded to hold for 2s',
      async () => {
        const a = (await requireThread()).ordinals.length
        await browser.pause(2_000)
        const b = await requireThread()
        return b.ordinals.length === a ? b : undefined
      },
      {interval: 0, timeout: 15_000}
    )

  // Selects the only hit for `token`, and returns the ordinal of its row once the row is loaded.
  const searchAndSelect = async (token: string) => {
    await openThreadSearch()
    const counter = await searchFor(token)
    check(counter === '1 of 1', `the search for ${token} found "${counter}"`)
    return waitForRow(token, 20_000)
  }

  // How an incoming send moved the list, from samples taken from the send until it settled.
  const describeSamples = (samples: Array<ThreadSample>) => {
    const at = (s: ThreadSample) => `${Math.round(s.t - samples[0]!.t)}ms`
    const counts = samples.filter((s, i) => i === 0 || s.count !== samples[i - 1]!.count).map(s => `${at(s)}: ${s.count}`)
    const moves = samples
      .filter((s, i) => i > 0 && Math.abs(s.offset - samples[i - 1]!.offset) >= 0.5)
      .map(s => `${at(s)}: ${Math.round(s.offset * 10) / 10}`)
    return `rows loaded ${counts.join(', ')}; offset ${moves.join(', ') || 'unchanged'}`
  }

  describe('opening', () => {
    // The phone loads a first page of 20 rows, so unlike on desktop the intro card at the top of this
    // thread is not in it; the thread still runs past the view.
    it('a short thread lands at its end', async function () {
      // worst case (s): open 100, row 15, end 21, step 2 = 138
      this.timeout(150_000)
      await openConversation(data.convIDs[E2E_CHANNELS.short])
      const newest = await waitForRow(shortMarker(SHORT_COUNT))
      const {t, v} = await expectAtEnd()
      check(t.rows.at(-1)?.ordinal === newest, `the newest row is not ${newest}: ${summary(t, v)}`)
      check(t.rows[0]!.top < v.top, `the short thread does not run past the view: ${summary(t, v)}`)
      await step('The short thread opened at its newest message', {card: true})
    })

    it('a long thread with more history to load lands at its end', async function () {
      // worst case (s): open 100, row 15, end 21, step 2 = 138
      this.timeout(150_000)
      await openLong()
      const newest = await waitForRow(longMarker(LONG_COUNT))
      const {t, v} = await expectAtEnd()
      check(t.moreToLoadBack, 'the long thread has no more history to load')
      check(t.rows.at(-1)?.ordinal === newest, `the newest row is not ${newest}: ${summary(t, v)}`)
      await step('The long thread opened at its newest message, older history still to load', {card: true})
    })
  })

  describe('new messages', () => {
    it('at the end, an incoming message keeps the thread at its end', async function () {
      // worst case (s): open 100, end 21, peer 70, send 60, row 20, end 21, two steps 4 = 296
      this.timeout(300_000)
      await openScratch()
      await expectAtEnd()
      await step('The scratch thread at its end')
      const text = e2eMarker('scroll-incoming-end')
      await sendIncoming(E2E_CHANNELS.scratch, text)
      const sent = Date.now()
      const ordinal = await waitForRow(text, 20_000)
      console.log(`incoming at the end: its row showed ${Date.now() - sent}ms after the send returned`)
      const {t, v} = await expectAtEnd('after the incoming message, the thread')
      check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the incoming one: ${summary(t, v)}`)
      await step('The incoming message is the newest row, the thread still at its end', {card: true})
    })

    it('with the keyboard up, the first keystroke keeps the newest message above the composer', async function () {
      // worst case (s): open 100, end 21, keyboard 5, end 21, end 21, the clear 21, two steps 4 = 193
      this.timeout(210_000)
      await openScratch()
      await expectAtEnd()
      await el(T.CHAT_INPUT).click()
      await waitForKeyboard()
      const up = await expectAtEnd('with the keyboard up, the thread')
      check(up.t.keyboardTop !== undefined, `no keyboard reading: ${summary(up.t, up.v)}`)
      await step('Keyboard up, the newest message above the composer')
      try {
        await el(T.CHAT_INPUT).addValue('x')
        await expectAtEnd('after the first keystroke, the thread')
        await step('After the first keystroke, the newest message still above the composer', {card: true})
      } finally {
        await clearComposer()
      }
    })

    it('with the keyboard up, an incoming message and a send keep the newest message above the composer', async function () {
      // worst case (s): open 100, end 21, keyboard 5, end 21, peer 70, send 60, row 20, end 21, sent 25, end 21, three steps 6 = 390
      this.timeout(400_000)
      await openScratch()
      await expectAtEnd()
      await el(T.CHAT_INPUT).click()
      await waitForKeyboard()
      await expectAtEnd('with the keyboard up, the thread')
      await step('Keyboard up at the end of the scratch thread')

      const incoming = e2eMarker('scroll-kb-incoming')
      await sendIncoming(E2E_CHANNELS.scratch, incoming)
      const incomingOrdinal = await waitForRow(incoming, 20_000)
      const a = await expectAtEnd('after an incoming message with the keyboard up, the thread')
      check(a.t.rows.at(-1)?.ordinal === incomingOrdinal, `the newest row is not the incoming one: ${summary(a.t, a.v)}`)
      check(await isKeyboardUp(), 'the keyboard went down')
      await step('The incoming message is the newest row above the composer, keyboard still up')

      const sent = e2eMarker('scroll-kb-send')
      const sentOrdinal = await sendMessage(sent)
      const b = await expectAtEnd('after a send with the keyboard up, the thread')
      check(b.t.rows.at(-1)?.ordinal === sentOrdinal, `the newest row is not the one sent: ${summary(b.t, b.v)}`)
      await step('The sent message is the newest row above the composer', {card: true})
    })

    for (const {how, move} of [
      {how: 'dragged up into history', move: async () => dragThread(400)},
      {how: 'flicked from the end into history', move: async () => flickThread(500)},
    ]) {
      it(`${how}, an incoming message leaves the reader where they are`, async function () {
        // worst case (s): open 100, end 21, drag 2, stable 10, peer 70, send 60, the load 20, stable 10, two steps 4 = 297
        this.timeout(300_000)
        await openScratch()
        await expectAtEnd()
        await move()
        const before = await waitForThreadStable()
        const v = await viewport(before)
        check(!isAtEnd(before, v), `the thread is still at its end: ${summary(before, v)}`)
        const anchor = pickAnchor(before, v)
        await step('The reader up in the history of the scratch thread')

        await sendIncoming(E2E_CHANNELS.scratch, e2eMarker('scroll-incoming-up'))
        await waitFor(
          'the incoming message to load',
          async () => ((await requireThread()).ordinals.length > before.ordinals.length ? true : undefined),
          {timeout: 20_000}
        )
        const after = await waitForThreadStable()
        expectRowWhere(after, anchor, 'after the incoming message')
        await step('After the incoming message, the rows in view have not moved', {card: true})
      })
    }
  })

  // Its own describe: a known failure (known-failures.ts) taints nothing else.
  //
  // Sampled from the first send until the thread settles, so a miss says how the list moved. The
  // burst waits for the page the thread asks for as it opens, so no page lands during it.
  //
  // Seen on iOS: six messages about 120ms apart leave the list 114 points short of its end. Each
  // insert shifts the offset by the new row's 25 points; the first two start the animated follow, and
  // each lands during the one before it, which it cuts short, and from the third on no follow starts
  // at all (offset 25, 45.7, 54.3, 75, 100, 125). The same on a list without the newer scroll fixes,
  // so it predates them: the content-position anchor's autoscroll does not follow an insert that lands
  // while its own animated scroll is running.
  describe('a burst of incoming messages', () => {
    it('at the end, a burst of incoming messages keeps the thread at its end', async function () {
      // worst case (s): open 100, end 21, rows holding 17, end 21, peer 70, six sends 360, row 20, two stables 20, two steps 4 = 653
      this.timeout(660_000)
      await openScratch()
      await expectAtEnd()
      const settled = (await waitForRowsToHold()).ordinals.length
      await expectAtEnd()
      await step('The scratch thread at its end, its first pages loaded')
      console.log(`a burst of 6 incoming messages, from ${settled} rows loaded`)
      let last = ''
      let ordinal = -1
      const samples = await sampleThreadWhile(async () => {
        for (let i = 0; i < 6; i++) {
          last = e2eMarker(`scroll-burst-${i}`)
          await sendIncoming(E2E_CHANNELS.scratch, last)
        }
        ordinal = await waitForRow(last, 20_000)
        await waitForThreadStable()
      })
      const t = await waitForThreadStable()
      const v = await viewport(t)
      const during = describeSamples(samples)
      console.log(`a burst of 6 incoming messages: newest row ${newestGap(t, v)}pt above the composer (${during})`)
      await step('After the burst of incoming messages')
      check(isAtEnd(t, v), `after the burst, the thread is not at its end (${during}): ${summary(t, v)}`)
      check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the last of the burst: ${summary(t, v)}`)
    })
  })

  describe('search', () => {
    it('a deep hit loads its page and is centred', async function () {
      // worst case (s): open 100, end 21, search 106, centred 20, step 2, close 5 = 254
      this.timeout(270_000)
      await openLong()
      await expectAtEnd()
      const {index, token} = LONG_SEARCH_TOKENS.deep
      check(!(await ordinalsWithText(longMarker(index))).length, 'the deep hit is already loaded')
      const ordinal = await searchAndSelect(token)
      await expectCentred(ordinal)
      await step('The deep search hit loaded and centred', {card: true})
    })

    it('searching again for the same hit after dragging away centres it again', async function () {
      // worst case (s): open 100, search 106, centred 20, drag 2, stable 10, centred 20, three steps 6, close 5 = 269
      this.timeout(290_000)
      await openLong()
      const {token} = LONG_SEARCH_TOKENS.middle
      const ordinal = await searchAndSelect(token)
      await expectCentred(ordinal)
      await step('The search hit centred')

      // toward older rows: the hit sits ten rows from the newest of its window, too near its edge
      // for a drag toward newer rows to take it out of the middle
      await dragThread(350)
      const moved = await waitForThreadStable()
      const mv = await viewport(moved)
      const r = rowOf(moved, ordinal)
      check(!r || Math.abs(centreOffset(r, mv)) > centreTolerance(mv), `the drag left row ${ordinal} centred`)
      await step('Dragged away from the hit')

      await searchAgain()
      await expectCentred(ordinal)
      await step('Searching again centred the hit again', {card: true})
    })

    // A drag done the moment the hit's row lands, while the list is still centring it. The reader's
    // move wins: the list stays where the drag left it and is not pulled back to the hit. (A
    // status-bar tap cannot be told apart here: every hit's page holds only about ten rows newer than
    // the hit, so its centred place and the list's top, where a tap goes, are both offset 0.)
    it('a drag right after the hit centres is not pulled back to the middle', async function () {
      // worst case (s): open 100, end 21, search open 20 and typed 66, the hit 20, drag 2, two stables 20, the pause 4, step 2, close 5 = 260
      this.timeout(280_000)
      await openLong()
      await expectAtEnd()
      const {token} = LONG_SEARCH_TOKENS.deep
      await openThreadSearch()
      await searchFor(token)
      const ordinal = await waitFor(
        'the hit to load',
        async () => {
          const found = await ordinalsWithText(token)
          if (found.length > 1) throw new Error(`${found.length} rows hold the hit's token`)
          return found[0]
        },
        {interval: 50, timeout: 20_000}
      )
      // The phone draws the hit's row already centred as it loads, so a drag during the centring
      // animation cannot be reached on iOS (that case stays desktop's). The drag lands right after,
      // in the centring's follow-up, where its corrector could still re-aim at the hit: the reader
      // is not pulled back.
      const pre = await requireThread()
      await dragThread(250)
      const moved = await waitForThreadStable()
      check(Math.abs(moved.offset - pre.offset) > 20, `the drag did not move the list: ${summary(pre)} then ${summary(moved)}`)
      // outlast the centring's own schedule, then check nothing pulled the reader back
      await browser.pause(3_500)
      const later = await waitForThreadStable()
      check(
        Math.abs(later.offset - moved.offset) <= stillTolerance,
        `the list moved after the reader did: ${summary(moved)} then ${summary(later)}`
      )
      const v = await viewport(moved)
      const r = rowOf(moved, ordinal)
      check(
        !r || Math.abs(centreOffset(r, v)) > centreTolerance(v),
        `row ${ordinal} was pulled back to the middle: ${JSON.stringify(r)} ${summary(moved, v)}`
      )
      await step('The drag right after the hit centred left the list where the reader put it', {card: true})
    })

    // Closing search with the list resting at its end, the newest message loaded, gives the end back
    // to the list where it was before search opened: the next message is followed as on any thread at
    // its end.
    it('closing search at the newest message, then an incoming message keeps the end', async function () {
      // worst case (s): open 100, end 21, sent 25, keyboard 5, end 21, search open 20, the finding wait 30 overrun by a try (searchFor 66, close 5, reopen 20) = 121, end 21, close 5, three stables 30, peer 70, send 60, row 20, three steps 6, close 5 = 540
      this.timeout(560_000)
      await openScratch()
      await expectAtEnd()
      // one word the search finds whole
      const token = e2eMarker('scrollsearchend').replaceAll('-', '')
      await sendMessage(`${e2eMarker('scroll-search-end')} ${token}`)
      await hideKeyboard()
      const rest = await expectAtEnd()
      const restGap = newestGap(rest.t, rest.v)!
      await openThreadSearch()
      // the search index can take a moment to hold a message just sent
      await waitFor(
        'the search for the message just sent to find it',
        async () => {
          const counter = await searchFor(token)
          if (counter === '1 of 1') return true
          await closeSearch()
          await openThreadSearch()
          return undefined
        },
        {interval: 1_000, timeout: 30_000}
      )
      const open = await expectAtEnd('with the newest message the hit, the thread')
      await step('Search open on the newest message, the thread at its end')
      const closing = await sampleThreadWhile(async () => {
        await closeSearch()
        await waitForThreadStable()
      })
      const closed = await waitForThreadStable()
      const cv = await viewport(closed)
      const closedGap = newestGap(closed, cv)
      console.log(
        `closing search at the newest message: newest row ${closedGap}pt above the composer (${restGap} before search), offset ${closed.offset} (${rest.t.offset} before, ${open.t.offset} with search open, newest row ${newestGap(open.t, open.v)}pt above the search bar); closing, offset ${closing.filter((s, i) => i === 0 || Math.abs(s.offset - closing[i - 1]!.offset) >= 0.5).map(s => `${Math.round(s.t - closing[0]!.t)}ms: ${Math.round(s.offset * 10) / 10}`).join(', ')}`
      )
      check(
        closedGap !== undefined && Math.abs(closedGap - restGap) <= 1 && Math.abs(closed.offset - rest.t.offset) <= 1,
        `closing search left the thread off its end: ${summary(closed, cv)}, before search ${summary(rest.t, rest.v)}`
      )
      await step('Search closed, the thread back where it rested before search')

      const text = e2eMarker('scroll-search-end-incoming')
      await sendIncoming(E2E_CHANNELS.scratch, text)
      const ordinal = await waitForRow(text, 20_000)
      const t = await waitForThreadStable()
      const v = await viewport(t)
      console.log(`then an incoming message: newest row ${newestGap(t, v)}pt above the composer`)
      check(isAtEnd(t, v), `after the incoming message, the thread is not at its end: ${summary(t, v)}`)
      check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the incoming one: ${summary(t, v)}`)
      await step('The incoming message is the newest row, the thread at its end', {card: true})
    })

    it('jump to recent from a deep hit lands at the newest message and closes search', async function () {
      // worst case (s): open 100, search 106, centred 20, keyboard 5, the tap 2, row 15, end 21, the button 5, two steps 4, close 5 = 283
      this.timeout(300_000)
      await openLong()
      const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
      await expectCentred(ordinal)
      await hideKeyboard()
      await step('The deep hit centred, jump to recent offered')
      await jumpToRecentButton().click()
      const newest = await waitForRow(longMarker(LONG_COUNT), 15_000)
      const {t, v} = await expectAtEnd('after jump to recent, the thread')
      check(t.rows.at(-1)?.ordinal === newest, `the newest row is not ${newest}: ${summary(t, v)}`)
      await jumpToRecentButton().waitForExist({reverse: true, timeout: 5_000})
      check(!(await searchOpen()), 'thread search is still open')
      await step('Jump to recent landed at the newest message and closed search', {card: true})
    })
  })

  // Its own describe: a known failure (known-failures.ts) taints nothing else.
  //
  // Seen on iOS: closing search moves the rows and nothing puts them back. Closing swaps the search
  // bar back for the composer; the scroll view keeps its offset, so the rows shift with the layout
  // change (cause not yet pinned down). Readings (window points): the centred hit's row top 400 with
  // search open, 376.7 once the list settles, never corrected (448.3 while the list also padded its
  // end by the search bar's height).
  describe('closing search', () => {
    it('closing search leaves the list where it is', async function () {
      // worst case (s): open 100, search 106, centred 20, close 5, two stables 20, two steps 4, close 5 = 260
      this.timeout(280_000)
      await openLong()
      const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.middle.token)
      const {t} = await expectCentred(ordinal)
      const before = rowOf(t, ordinal)!
      await step('The search hit centred, search open')

      const samples = await sampleThreadWhile(async () => {
        await closeSearch()
        await waitForThreadStable()
      })
      const after = await waitForThreadStable()
      const v = await viewport(after)
      const tops = samples.map(s => sampleTop(s, ordinal))
      const off = samples.filter((_, i) => tops[i] === undefined || Math.abs(tops[i]! - before.top) > stillTolerance)
      const most = Math.max(0, ...tops.map(top => (top === undefined ? 0 : Math.abs(top - before.top))))
      console.log(
        `closing search: row ${ordinal} at ${before.top}, then ${rowOf(after, ordinal)?.top}; away from its place in ${off.length} of ${samples.length} samples, ${off.length ? Math.round(off.at(-1)!.t - off[0]!.t) : 0}ms from the first to the last, by up to ${Math.round(most * 10) / 10} points`
      )
      await step('Search closed')
      check(!isAtEnd(after, v), `the thread went to its end: ${summary(after, v)}`)
      const r = rowOf(after, ordinal)
      check(
        !!r && Math.abs(r.top - before.top) <= stillTolerance,
        `row ${ordinal} moved from ${before.top} to ${r?.top}: ${summary(after, v)}`
      )
    })
  })

  // The row in view a drag of `dy` leaves on screen: the top one when the rows move down (toward
  // older), the bottom one when they move up.
  const rowToFollow = (t: ThreadReading, v: Viewport, dy: number) => {
    const inView = t.rows.filter(r => wholly(r, v))
    return dy > 0 ? inView[0] : inView.at(-1)
  }

  // How far a row the reader is looking at may stray, across a page landing, from how far a drag with
  // no page landing moves it: the same drag's own travel varies by up to 13 points (511 to 524 seen),
  // and a page moving the reader moves it 55 points or more.
  const pagingTolerance = 24

  // Paging toward older rows from the end, where the rows loaded settle before each drag, the drags
  // with a landing travel within this of the usual drag (seen: 511 and 519 against 511).
  const olderPagingTolerance = 10

  // How far a page landing at rest may move the row at the bottom of the view.
  const restingPageTolerance = 100

  type Landing = {added: number; atEdge: boolean; i: number; waited?: boolean; travel?: number; what: string}

  // Moves the thread in `stride`-point steps (by `move`, a drag unless given) until `done`, at most
  // `maxSteps` times. Each step's travel is read off a row in view before it that stays rendered; a
  // step in which a page landed must travel as far as the steps in which none did, so a landing never
  // moves what the reader sees. Toward newer rows while a newer page is still to come, a step that
  // would reach the newest row loaded first waits a moment for the page (it loads within two screens
  // of that row), and carries on when none comes. Returns the landings (with the rows each brought,
  // and whether the reader was at the newest row loaded), and which of them moved the reader by more
  // than `tolerance`.
  const scrollThroughPages = async ({
    done,
    maxSteps = 100,
    move,
    stride,
    tolerance = pagingTolerance,
  }: {
    done: (t: ThreadReading, v: Viewport) => boolean
    maxSteps?: number
    move?: () => Promise<void>
    stride: number
    tolerance?: number
  }) => {
    let t = await waitForThreadStable()
    let v = await viewport(t)
    const plain: Array<number> = []
    const landed: Array<Landing> = []
    for (let i = 0; i < maxSteps && !done(t, v); i++) {
      const before = t
      // how far a step moves the list, until one has been measured
      const travelled = plain.length ? Math.abs(plain[0]!) : Math.abs(stride)
      const atEdge = stride < 0 && before.moreToLoadForward && before.offset - travelled < 20
      if (atEdge) {
        const came = await waitFor(
          'a page of newer rows',
          async () => ((await requireThread()).ordinals.length > before.ordinals.length ? true : undefined),
          {timeout: 3_000}
        ).catch((e: unknown) => {
          if (isAttemptOver(e)) throw e
          return false
        })
        if (came) {
          t = await waitForThreadStable()
          v = await viewport(t)
          // the reader did not move, so this landing has no travel to compare
          landed.push({added: t.ordinals.length - before.ordinals.length, atEdge, i, what: 'landed while the reader waited at the edge', waited: true})
          continue
        }
      }
      const anchor = rowToFollow(before, v, stride)
      if (!anchor) throw new Error(`step ${i}: no row in view to follow: ${summary(before, v)}`)
      if (move) await move()
      else await dragThread(stride)
      t = await waitForThreadStable()
      v = await viewport(t)
      const now = rowOf(t, anchor.ordinal)
      const travel = now && now.top - anchor.top
      if (t.ordinals.length !== before.ordinals.length) {
        const what = `row ${anchor.ordinal} at ${anchor.top} -> ${now?.top}; ${summary(before, v)} then ${summary(t, v)}`
        landed.push({added: t.ordinals.length - before.ordinals.length, atEdge, i, travel, what})
      } else if (travel === undefined && move) {
        // a fling can carry its row past the rows rendered: a step with no measure, not a miss
        continue
      } else {
        check(travel !== undefined, `step ${i}: row ${anchor.ordinal} is no longer rendered: ${summary(t, v)}`)
        // the last step can stop short at the end of the thread, and one from the edge at the edge
        if (!done(t, v) && !atEdge) plain.push(travel!)
      }
    }
    check(done(t, v), `the scroll did not reach its end: ${summary(t, v)}`)
    // a fling's travel varies too much to measure a usual step, and its landings are only reported
    if (!move) check(plain.length >= 2, `only ${plain.length} steps loaded no page, too few to measure a step's travel`)
    const usual = plain.length ? [...plain].sort((x, y) => x - y)[Math.floor(plain.length / 2)]! : undefined
    const moved = (l: Landing) =>
      !l.waited && (l.travel === undefined || usual === undefined || Math.abs(l.travel - usual) > tolerance)
    const explain = (ls: Array<Landing>) =>
      ls.map(l => `step ${l.i}: the reader's row travelled ${l.travel ?? 'out of the rendered rows'} where a step moves it ${usual}${l.atEdge ? ' (reader on the newest row loaded)' : ''}: ${l.what}`).join('\n')
    return {explain, landed, moved}
  }

  // One drag, and how far it moved a row that stayed in view.
  const dragTravel = async (dy: number) => {
    const before = await waitForThreadStable()
    const v = await viewport(before)
    const anchor = rowToFollow(before, v, dy)
    if (!anchor) throw new Error(`no row in view to follow: ${summary(before, v)}`)
    const samples = await sampleThreadWhile(async () => dragThread(dy))
    const after = await waitForThreadStable()
    const now = rowOf(after, anchor.ordinal)
    check(!!now, `row ${anchor.ordinal} is no longer measured: ${summary(after)}`)
    return {after, before, samples, travel: now!.top - anchor.top}
  }

  // Taps the status bar until the list rests at its end, waiting for each newer page a tap that
  // rests on the newest row loaded asks for.
  const tapToThePresent = async () => {
    for (let i = 0; i < 12; i++) {
      const rest = await waitForThreadStable()
      if (isAtEnd(rest, await viewport(rest))) return
      if (rest.moreToLoadForward && Math.abs(rest.offset) <= 1) {
        await waitFor(
          'a page of newer rows',
          async () => ((await requireThread()).ordinals.length > rest.ordinals.length ? true : undefined),
          {timeout: 15_000}
        )
      }
      await tapStatusBar()
    }
  }

  // Opens e2e-long on the middle search hit and closes search, leaving the reader on a window of
  // history that lacks the newest message.
  const openOnOldHit = async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.middle.token)
    await expectCentred(ordinal)
    if (await searchOpen()) await closeSearch()
    await jumpToRecentButton().waitForExist({timeout: 5_000})
    const start = await waitForThreadStable()
    check(start.moreToLoadForward, `the hit's page holds the newest message: ${summary(start)}`)
    await step('On an old search hit, search closed, the newest message not loaded')
    return start
  }

  // At the present by newer pages: the newest message loaded and the list at rest at its end.
  const expectAtThePresent = async (how: string) => {
    await waitForRow(longMarker(LONG_COUNT))
    const {t, v} = await expectAtEnd(`${how} to the present, the thread`)
    check(!t.moreToLoadForward, `the thread still has newer rows to load: ${summary(t, v)}`)
    check(Math.abs(t.offset) <= 1, `the thread is not at rest at its end: ${summary(t, v)}`)
    await jumpToRecentButton().waitForExist({reverse: true, timeout: 5_000})
    await step(`${how}, the thread reached the newest message`, {card: true})
  }

  describe('paging', () => {
    // A thread left alone at its end loads the pages the reader is near once (the phone's first page
    // of 20 rows is within two screens of its oldest row, so one page of 100 more follows), then no
    // more: the rows loaded stay the same over a long idle stretch, and a drag up still loads older
    // pages.
    for (const {name, open} of [
      {name: 'e2e-scratch', open: openScratch},
      {name: 'e2e-long', open: openLong},
    ]) {
      it(`left idle at its end, ${name} loads no more pages, and dragging up still loads them`, async function () {
        // worst case (s): open 100, end 21, rows holding 17, idle 13, stable 10, the drags 60 overrun by one (drag 2, stable 10), two steps 4 = 237
        this.timeout(240_000)
        await open()
        const first = (await expectAtEnd()).t.ordinals.length
        const start = await waitForRowsToHold()
        const counts: Array<number> = []
        const idleFrom = Date.now()
        while (Date.now() - idleFrom < 12_000) {
          counts.push((await requireThread()).ordinals.length)
          await browser.pause(1_000)
        }
        const idle = await waitForThreadStable()
        console.log(
          `${name} idle: ${first} rows at the end, ${start.ordinals.length} once settled, then ${counts.join(', ')}, ${idle.ordinals.length} after ${Math.round((Date.now() - idleFrom) / 1000)}s`
        )
        check(
          counts.every(c => c === start.ordinals.length) && idle.ordinals.length === start.ordinals.length,
          `left idle, the thread loaded pages: ${start.ordinals.length} rows became ${counts.join(', ')}, ${idle.ordinals.length}`
        )
        check(idle.moreToLoadBack, `the idle thread loaded its whole history: ${summary(idle)}`)
        await step('Left idle at its end, the thread loaded no more pages')
        const paged = await waitFor(
          'a drag up to load an older page',
          async () => {
            await dragThread(500)
            const t = await waitForThreadStable()
            return t.ordinals.length > start.ordinals.length ? t : undefined
          },
          {interval: 0, timeout: 60_000}
        )
        console.log(`${name} dragged up: ${start.ordinals.length} rows became ${paged.ordinals.length}`)
        await step('Dragging up loaded an older page', {card: true})
      })
    }

    // A page of older rows lands during a drag up from the end of the thread; the drag moves the
    // reader's rows as far as the next drag, with that page loaded, does. The thread loads a page as
    // it opens, so the drags start once that has landed and go on until one brings in the next.
    it('an older page landing during a drag up from the end leaves the reader where the drag put them', async function () {
      // worst case (s): open 100, end 21, rows holding 17, the drags 90 overrun by one (two stables 20, drag 2), one more 22, two steps 4 = 276
      this.timeout(280_000)
      await openLong()
      await expectAtEnd()
      await waitForRowsToHold()
      await step('The long thread at its end, its first pages loaded')
      let drags = 0
      const landing = await waitFor(
        'a drag during which an older page lands',
        async () => {
          drags++
          const d = await dragTravel(400)
          if (d.after.ordinals.length <= d.before.ordinals.length) return undefined
          // A page that lands only once the list has stopped (the drag ran into the oldest row loaded,
          // or ended) did not land during the drag; the travel then is the distance to that edge (seen
          // live: 381pt where a drag moves 511pt). Such a drag is passed over and the drags go on.
          const grew = d.samples.findIndex((x, i) => i > 0 && x.count > d.samples[i - 1]!.count)
          const moving = grew > 0 && d.samples.slice(Math.max(0, grew - 4), grew).some((x, i, a) => i > 0 && Math.abs(x.offset - a[i - 1]!.offset) >= 0.5)
          if (moving) return d
          console.log(`a page landed after drag ${drags} had stopped (travel ${d.travel}); dragging on`)
          return undefined
        },
        {interval: 0, timeout: 90_000}
      ).catch((e: unknown) => {
        if (isAttemptOver(e)) throw e
        throw new Error(`no older page landed while a drag was moving (${drags} drags)`, {cause: e})
      })
      const plain = await dragTravel(400)
      console.log(
        `an older page landed during drag ${drags} (${landing.before.ordinals.length} to ${landing.after.ordinals.length} rows), travel ${landing.travel}; the next drag ${plain.travel}`
      )
      check(plain.after.ordinals.length === plain.before.ordinals.length, 'a page landed during the next drag too')
      check(
        Math.abs(landing.travel - plain.travel) <= pagingTolerance,
        `the drag moved the reader's row ${landing.travel}pt as the page landed, ${plain.travel}pt with it loaded`
      )
      await step('The drag during which a page landed moved the reader as far as the next drag', {card: true})
    })

    // Pages load two screens ahead of the reader, and one lands, the next is asked for as soon as the
    // reader is still that near the oldest row loaded: the first drag from the end brings in several
    // pages (20 rows loaded became 320 in one drag, then 403 in the next). So pages are counted by the
    // rows each drag brought in, and every drag during which rows landed must travel as the drags
    // without a landing do.
    it('dragging up loads older pages without moving the reader, back to the first message', async function () {
      // worst case (s): open 100, end 21, stable 10, 50 steps of drag 2 and stable 10 = 600, stable 10, row 15, two steps 4 = 760
      this.timeout(780_000)
      await openLong()
      const start = (await expectAtEnd()).t.ordinals.length
      await step('The long thread at its end')
      const {explain, landed, moved} = await scrollThroughPages({
        done: t => !t.moreToLoadBack && t.rows[0]!.top >= t.listTop - 1,
        maxSteps: 50,
        stride: 400,
        tolerance: olderPagingTolerance,
      })
      // pages also land while the list rests between drags, so the whole history is counted at the end
      const loaded = (await waitForThreadStable()).ordinals.length
      console.log(`older pages: from ${start} rows to ${loaded}; ${landed.map(l => `step ${l.i} +${l.added} rows, travel ${l.travel}`).join('; ')}`)
      check(landed.length >= 1, 'no page landed during a drag')
      check(loaded >= LONG_COUNT, `the thread holds ${loaded} rows, short of the ${LONG_COUNT} messages`)
      check(!landed.some(moved), explain(landed.filter(moved)))
      await waitForRow(longMarker(1))
      await step('Dragged up to the first message, every page landing without moving the reader', {card: true})
    })

    // From a window of history (the hit's page holds about ten rows newer than it), moving toward the
    // present loads newer pages as the reader comes within two screens of the newest row loaded, until
    // the thread holds the newest message. A page landing while the list moves can throw the reader
    // (seen on some landings only), so those are logged apart from the assertion that the present is
    // reached.
    for (const {how, move, stride} of [
      {how: 'dragging down', move: undefined, stride: -200},
      {how: 'flicking down', move: async () => flickThread(-300), stride: -300},
    ]) {
      it(`${how} from an old hit loads newer pages until the present`, async function () {
        // worst case (s): openOnOldHit 248 (open 100, search 106, centred 20, close 5, button 5, stable 10, step 2), stable 10, 40 steps of an edge wait 3, stable 10, drag 2 and stable 10 = 1000, expectAtThePresent 43 (row 15, end 21, button 5, step 2) = 1301
        this.timeout(1320_000)
        await openOnOldHit()
        const {explain, landed, moved} = await scrollThroughPages({
          done: (t, v) => isAtEnd(t, v),
          maxSteps: 40,
          move,
          stride,
        })
        check(landed.length >= 1, 'no newer page landed')
        // landings that move the reader are logged, not failed: they depend on where each page lands
        const jumped = landed.filter(moved)
        console.log(
          `${how}: ${landed.length} newer pages landed, ${landed.filter(l => l.atEdge).length} with the reader on the newest row loaded, ${jumped.length} moving the reader beyond ${pagingTolerance}pt${jumped.length ? `:\n${explain(jumped)}` : ''}`
        )
        await expectAtThePresent(how)
      })
    }

    // A status-bar tap has no travel of its own to compare: it rests the list on the newest row
    // loaded, and the test after this one holds what a page then does. Reaching the present by newer
    // pages leaves older paging working: scrolling back up past where the window started loads older
    // rows.
    it('a status-bar tap from an old hit loads newer pages until the present', async function () {
      // worst case (s): openOnOldHit 248, 12 taps of stable 10, a page 15 and the tap 1 = 312, expectAtThePresent 43, stable 10, 20 flicks of 1 and stable 10 = 220, step 2 = 835
      this.timeout(860_000)
      const start = await openOnOldHit()
      await tapToThePresent()
      await expectAtThePresent('a status-bar tap')

      const startOldest = start.ordinals[0]!
      let up = await waitForThreadStable()
      for (let i = 0; i < 20 && up.ordinals[0]! >= startOldest; i++) {
        await flickThread(600)
        up = await waitForThreadStable()
      }
      check(
        up.ordinals[0]! < startOldest,
        `scrolling back up from the present loaded nothing older than ${startOldest}: ${summary(up)}`
      )
      await step('Scrolling back up from the present loaded older rows')
    })

    // With the reader resting on the newest row of a window of history, the page of newer rows that
    // lands next leaves them there: from a deep hit (rows up to the hit's page loaded), a status-bar
    // tap rests the list on the newest row loaded, and the row at the bottom of the view stays where
    // it is once the page lands.
    it('resting on the newest row of a window of history, the next page leaves the reader where they are', async function () {
      // worst case (s): open 100, search 106, centred 20, close 5, stable 10, 5 taps of 1, the rest 5 and a page 4 = 50, stable 10, two steps 4 = 305
      this.timeout(320_000)
      await openLong()
      const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
      await expectCentred(ordinal)
      if (await searchOpen()) await closeSearch()
      const before = await waitForThreadStable()
      check(before.moreToLoadForward, `the hit's page holds the newest message: ${summary(before)}`)
      await step('On a deep search hit, search closed, the newest message not loaded')
      // A page asked for at rest lands a gate (1s) after the rows last changed, so the reading taken
      // as the tap comes to rest is caught before it; the stable-thread wait is too slow for that. If
      // a page already landed and carried the reader off the end, tap again.
      const restingAtEnd = async () => {
        let last: ThreadReading | undefined
        return waitFor(
          'the tap to rest at the newest row loaded',
          async () => {
            const t = await requireThread()
            const held = !!last && Math.abs(t.offset - last.offset) < 0.5 && t.ordinals.length === last.ordinals.length
            last = t
            return held && Math.abs(t.offset) <= 1 ? t : undefined
          },
          {interval: 150, timeout: 5_000}
        ).catch((e: unknown) => {
          if (isAttemptOver(e)) throw e
          return last
        })
      }
      let rest = before
      let rv = await viewport(rest)
      let pageLanded = false
      for (let i = 0; i < 5 && !pageLanded; i++) {
        await tapStatusBar()
        rest = (await restingAtEnd()) ?? (await requireThread())
        rv = await viewport(rest)
        if (Math.abs(rest.offset) > 1 || !rest.moreToLoadForward) continue
        const loaded = rest.ordinals.length
        pageLanded = await waitFor(
          'the next page of newer rows',
          async () => ((await requireThread()).ordinals.length > loaded ? true : undefined),
          {timeout: 4_000}
        ).catch((e: unknown) => {
          if (isAttemptOver(e)) throw e
          return false
        })
      }
      check(
        Math.abs(rest.offset) <= 1 && rest.moreToLoadForward,
        `the reader is not on the newest row of a window lacking the newest message: ${summary(rest, rv)}`
      )
      const bottom = rowToFollow(rest, rv, -1)
      if (!bottom) throw new Error(`no row in view to follow: ${summary(rest, rv)}`)
      check(pageLanded, `no newer page landed after resting on the newest row: ${summary(rest, rv)}`)
      const after = await waitForThreadStable()
      const now = rowOf(after, bottom.ordinal)
      // The platform's content-position keeping can leave the row a little off as the page lands
      // (seen ~60pt); what this rules out is the reader being carried a page (thousands of points)
      // ahead.
      check(
        !!now && Math.abs(now.top - bottom.top) <= restingPageTolerance,
        `row ${bottom.ordinal} at the bottom of the view moved from ${bottom.top} to ${now?.top} as the page landed: ${summary(rest, rv)} then ${summary(after, await viewport(after))}`
      )
      await step('The next page landed with the reader resting on the newest row, which stayed in place', {card: true})
    })

  })

  describe('back to the end', () => {
    for (const {how, toEnd} of [
      {
        how: 'dragging back down',
        toEnd: async () => {
          for (let i = 0; i < 6 && !isAtEnd(await waitForThreadStable(), await viewport()); i++) await dragThread(-500)
        },
      },
      {how: 'a status-bar tap', toEnd: tapStatusBar},
    ]) {
      it(`${how} re-pins it, and a later incoming message keeps the end`, async function () {
        // worst case (s): open 100, end 21, the drags 30 overrun by one 12, back to the end 72 (6 drags of stable 10 and drag 2), end 21, peer 70, send 60, row 20, two stables 20, three steps 6 = 432
        this.timeout(440_000)
        await openScratch()
        await expectAtEnd()
        // the first drag from the end can stop short as the first older page lands (see paging)
        await waitFor(
          'the thread to be well away from its end',
          async () => {
            await dragThread(500)
            const up = await waitForThreadStable()
            return (newestGap(up, await viewport(up)) ?? 0) < -300 ? true : undefined
          },
          {interval: 0, timeout: 30_000}
        )
        await step('The reader well up in the history of the scratch thread')

        await toEnd()
        await expectAtEnd('back at the end, the thread')
        await step(`${how}, the thread back at its end`)

        // sampled from the send until the thread settles, so a miss says what else moved the list then
        const text = e2eMarker('scroll-repin')
        let ordinal = -1
        const samples = await sampleThreadWhile(async () => {
          await sendIncoming(E2E_CHANNELS.scratch, text)
          ordinal = await waitForRow(text, 20_000)
          await waitForThreadStable()
        })
        const t = await waitForThreadStable()
        const v = await viewport(t)
        const during = describeSamples(samples)
        console.log(`${how}, then an incoming message: ${during}`)
        check(isAtEnd(t, v), `after the incoming message, the thread is not at its end (${during}): ${summary(t, v)}`)
        check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the incoming one: ${summary(t, v)}`)
        await step('The incoming message is the newest row, the thread at its end', {card: true})
      })
    }
  })

  describe('editing', () => {
    // No edit left under way, after a timeout too: the thread must still be on screen, so it runs
    // before the gate's own afterEach. Worst case (s): resetComposer 46.
    afterEach(async function () {
      this.timeout(60_000)
      await withCleanup(resetComposer, [])
    })

    // Where the keyboard's top sits once it is up, measured by focusing the composer.
    const keyboardTopWhenUp = async () => {
      await el(T.CHAT_INPUT).click()
      await waitForKeyboard()
      // the app hears the keyboard's metrics a moment after the element reports it shown
      const top = await waitFor('the keyboard in the app', async () => (await requireThread()).keyboardTop, {timeout: 5_000})
      await hideKeyboard()
      await waitForThreadStable(20_000)
      return top
    }

    // A message of the user's with `below` incoming messages after it, so it can sit anywhere in view.
    const sendWithRowsBelow = async (below: number) => {
      const text = e2eMarker('scroll-edit-kb')
      const ordinal = await sendMessage(text)
      await hideKeyboard()
      let last = ''
      for (let i = 0; i < below; i++) {
        last = e2eMarker(`scroll-edit-kb-below-${i}`)
        await sendIncoming(E2E_CHANNELS.scratch, last)
      }
      await waitForRow(last, 20_000)
      return {ordinal, text}
    }

    // Drags until the row's middle sits within `within` points of `y`.
    const bringRowTo = async (ordinal: number, y: number, within = 10) => {
      for (let i = 0; i < 8; i++) {
        const t = await waitForThreadStable(20_000)
        const r = rowOf(t, ordinal)
        check(!!r, `row ${ordinal} is not rendered: ${summary(t)}`)
        const off = y - (r!.top + r!.bottom) / 2
        if (Math.abs(off) <= within) return {r: r!, t}
        // a drag shorter than the touch slop moves nothing, so overshoot and come back
        await dragThread(Math.abs(off) < 30 ? off + Math.sign(off) * 60 : off)
        if (Math.abs(off) < 30) await dragThread(-Math.sign(off) * 60)
      }
      const t = await waitForThreadStable()
      throw new Error(`row ${ordinal} did not come to ${y}: ${JSON.stringify(rowOf(t, ordinal))} ${summary(t)}`)
    }

    const editWithKeyboard = async (text: string) => {
      await openMessageMenu(text)
      await chooseMenuItem('Edit')
      await editCancel().waitForExist({timeout: 5_000})
      await waitForKeyboard()
      const t = await waitForThreadStable()
      return {t, v: await viewport(t)}
    }

    // Records, on the app's clock, when the keyboard reports it has finished showing.
    const watchKeyboardDidShow = async () =>
      jsEval<boolean>(`
        const g = globalThis
        // by its path's end: a worktree's node_modules can be a link, which Metro names by its target
        const kc = kbModule('node_modules/react-native-keyboard-controller/src/index.ts')
        if (g.__e2eKbDidShow) g.__e2eKbDidShow.remove()
        const now = g.nativePerformanceNow ? () => g.nativePerformanceNow() : () => Date.now()
        g.__e2eKbDidShowAt = []
        g.__e2eKbDidShow = kc.KeyboardEvents.addListener('keyboardDidShow', () => g.__e2eKbDidShowAt.push(now()))
        return true
      `)
    const keyboardDidShowTimes = async () => jsEval<Array<number>>(`return globalThis.__e2eKbDidShowAt || []`)
    const unwatchKeyboardDidShow = async () =>
      jsEval<boolean>(`
        const g = globalThis
        if (g.__e2eKbDidShow) g.__e2eKbDidShow.remove()
        g.__e2eKbDidShow = undefined
        return true
      `)

    // The edited row counts as in view only in the part of the list the keyboard leaves clear, judged
    // once the keyboard is up: a row wholly in view before it rose, but half under where it rises, is
    // revealed above it.
    it('editing a row that the rising keyboard half covers brings it into view above the keyboard', async function () {
      // worst case (s): open 100, the keyboard top 36 (keyboard 10, keyboard hidden 5, stable 20, the tap 1), sent 25, keyboard 5, peer 70, eight sends 480, row 20, bringRowTo 192 (8 of stable 20 and two drags 4), stable 10, the edit 55 (menu 35, edit bar 5, keyboard 5, stable 10), the cancel 6, two steps 4 = 1003
      this.timeout(1020_000)
      await openScratch()
      const kbTop = await keyboardTopWhenUp()
      const {ordinal, text} = await sendWithRowsBelow(8)
      const {r, t} = await bringRowTo(ordinal, kbTop)
      const v0 = await viewport(t)
      check(wholly(r, v0), `row ${ordinal} is not wholly in view before the edit: ${JSON.stringify(r)} ${summary(t, v0)}`)
      check(r.top < kbTop && r.bottom > kbTop, `row ${ordinal} does not straddle the keyboard's top ${kbTop}: ${JSON.stringify(r)}`)
      await step('The sent row sits where the keyboard will rise')
      const {t: after, v} = await editWithKeyboard(text)
      console.log(
        `half covered: row ${ordinal} at ${r.top}-${r.bottom} with the keyboard's top at ${kbTop}; editing, ${JSON.stringify(rowOf(after, ordinal))} with the composer's top at ${v.bottom}`
      )
      check(wholly(rowOf(after, ordinal), v), `row ${ordinal} is not wholly in view with the keyboard up: ${summary(after, v)}`)
      await step('Editing, the row is wholly in view above the keyboard', {card: true})
    })

    // A row near the top of the view when the edit starts: the keyboard rising must not leave it off
    // the top. Sampled every frame from the edit until a second after the keyboard reports it has
    // finished showing: once the row is wholly in view it stays there.
    it('editing a row near the top keeps it in view once the keyboard is up', async function () {
      // worst case (s): open 100, sent 25, keyboard 5, peer 70, 22 sends 1320, row 20, the tap 1, the row 60 overrun by one 22, bringRowTo 192, stable 10, the watch 2, the edit 55, didShow 5, the pause 1, stable 10, the cancel 6, two steps 4 = 1907
      this.timeout(1920_000)
      await openScratch()
      const {ordinal, text} = await sendWithRowsBelow(22)
      // a burst of incoming messages can leave the list short of its end: go to the end, then up to
      // the row until the list renders it
      await tapStatusBar()
      const t0 = await waitFor(
        `row ${ordinal} rendered`,
        async () => {
          const t = await waitForThreadStable(20_000)
          if (rowOf(t, ordinal)) return t
          await dragThread(300)
          return undefined
        },
        {interval: 0, timeout: 60_000}
      )
      const height = rowOf(t0, ordinal)!.bottom - rowOf(t0, ordinal)!.top
      // near the top: its top 5 to 55 points below the list's top
      const {r, t} = await bringRowTo(ordinal, t0.listTop + height / 2 + 30, 25)
      const v0 = await viewport(t)
      check(wholly(r, v0), `row ${ordinal} is not wholly in view before the edit: ${JSON.stringify(r)} ${summary(t, v0)}`)
      await step('The sent row near the top of the view')
      await watchKeyboardDidShow()
      let didShow: number | undefined
      let samples: Array<ThreadSample>
      try {
        samples = await sampleThreadWhile(async () => {
          await editWithKeyboard(text)
          didShow = await waitFor('keyboardDidShow', async () => (await keyboardDidShowTimes())[0], {timeout: 5_000})
          await browser.pause(1_200)
        })
      } finally {
        await unwatchKeyboardDidShow()
      }
      const after = await waitForThreadStable()
      const v = await viewport(after)
      const final = rowOf(after, ordinal)
      const rowHeight = final ? final.bottom - final.top : r.bottom - r.top
      const inView = (s: ThreadSample) => {
        const top = sampleTop(s, ordinal)
        return top !== undefined && top >= v.top - 1 && top + rowHeight <= v.bottom + 1
      }
      const window = samples.filter(s => s.t >= didShow! && s.t <= didShow! + 1_000)
      const firstIn = window.findIndex(inView)
      const outAfterIn = firstIn < 0 ? [] : window.slice(firstIn).filter(s => !inView(s))
      const at = (s: ThreadSample) => `${Math.round(s.t - didShow!)}ms: ${sampleTop(s, ordinal) ?? 'off'}`
      console.log(
        `near the top: row ${ordinal} at ${r.top}-${r.bottom}; editing, ${JSON.stringify(final)} with the view ${v.top}-${v.bottom}; in the second after keyboardDidShow ${window.length} samples, ${window.filter(s => !inView(s)).length} not wholly in view, first wholly in view at ${firstIn < 0 ? 'never' : at(window[firstIn]!)}; tops at didShow ${window.slice(0, 3).map(at).join(', ')}`
      )
      check(window.length > 0, `no samples in the second after keyboardDidShow (${samples.length} samples)`)
      check(firstIn >= 0, `row ${ordinal} was never wholly in view in the second after keyboardDidShow: ${window.map(at).join(', ')}`)
      check(!outAfterIn.length, `row ${ordinal} left the view after it was revealed: ${outAfterIn.map(at).join(', ')}`)
      check(wholly(final, v), `row ${ordinal} is not wholly in view with the keyboard up: ${summary(after, v)}`)
      await step('Editing, the row stayed wholly in view once the keyboard was up', {card: true})
    })

    it('editing a message in view does not scroll the thread', async function () {
      // worst case (s): open 100, sent 25, keyboard 5, end 21, menu 35, the edit bar 5, end 21, the cancel 6, two steps 4 = 222
      this.timeout(240_000)
      await openScratch()
      const text = e2eMarker('scroll-edit')
      const ordinal = await sendMessage(text)
      await hideKeyboard()
      await expectAtEnd()
      await step('The sent message at the end of the thread')

      await openMessageMenu(text)
      await chooseMenuItem('Edit')
      await editCancel().waitForExist({timeout: 5_000})
      const {t, v} = await expectAtEnd('editing, the thread')
      check(wholly(rowOf(t, ordinal), v), `row ${ordinal} is not wholly in view: ${summary(t, v)}`)
      await step('Editing, the thread still at its end with the row in view', {card: true})
    })
  })

  // Seeing the unread line is catching up: the pill shows only for a line the reader has not had on
  // screen, and once the line has been in view nothing brings the pill back for it. Catch up lands
  // on a row well up in history with the newest message not loaded; scrolling down from there loads
  // newer pages until the present.
  describe('catch-up pill', () => {
    // The host's read of e2e-long, polled until it is `want`.
    const longUnreadIs = async (want: boolean) =>
      waitFor(
        `the host to see e2e-long ${want ? 'unread' : 'read'}`,
        async () => ((await channelUnreadFromCli(E2E_CHANNELS.long)) === want ? true : undefined),
        {interval: 1_000, timeout: 20_000}
      )

    // Marks the row `ordinal` of e2e-long unread from its menu, the host reading the channel as read
    // before and unread after, so the change is the app's. Callers have just opened e2e-long at its
    // end, which reads it. The afterEach reads it again.
    const markLongUnread = async (ordinal: number) => {
      await longUnreadIs(false)
      await openMessageMenu(await rowText(ordinal))
      await chooseMenuItem('Mark as unread')
      await waitForThreadStable()
      await longUnreadIs(true)
    }

    // A fresh open of e2e-long, from its end, with a row well up in history marked unread: the line
    // above the view, never seen.
    const markUnreadAboveTheView = async (drags: number) => {
      await openLong()
      await expectAtEnd()
      for (let i = 0; i < drags; i++) await dragThread(500)
      const up = await waitForThreadStable()
      const target = pickAnchor(up, await viewport(up), 60)
      await markLongUnread(target.ordinal)
      return target
    }

    // Mocha runs this before the gate's own afterEach, after a timeout too, so the thread is read
    // again before the next test drives the app. It reads the host first, so it does nothing to a
    // thread already read; otherwise the phone opens e2e-long at its end, which reads it, the
    // channel's newest messages being deletes (the sweeper's) or not, and the host reads it read.
    // Worst case (s): keyboard 5, one host read 25, open 100, end 21, read 45 = 196.
    afterEach(async function () {
      this.timeout(220_000)
      await withCleanup(hideKeyboard, [
        async () => {
          if (!(await channelUnreadFromCli(E2E_CHANNELS.long))) return
          await openLong()
          await expectAtEnd('e2e-long')
          await longUnreadIs(false)
        },
      ])
    })

    it('an unread line above the view shows the catch-up pill, which centres the unread message', async function () {
      // worst case (s): open 100, end 21, two drags 4, stable 10, the mark 135 (two reads 90, menu 35,
      // stable 10), open 100, end 21, the pill 5, centred 20, the pill gone 5, three steps 6 = 427
      this.timeout(450_000)
      const target = await markUnreadAboveTheView(2)
      check(!(await catchUpPill().isExisting()), 'the catch-up pill shows with the unread line in view')
      await step('A row marked unread, its line in view, no catch-up pill')

      // a fresh open lands at the end, with the unread line above the view, never seen there
      await openLong()
      await expectAtEnd()
      await catchUpPill().waitForExist({timeout: 5_000})
      await step('Reopened at the end, the catch-up pill shows for the line above the view')
      await catchUpPill().click()
      await expectCentred(target.ordinal)
      await catchUpPill().waitForExist({reverse: true, timeout: 5_000})
      await step('Catch up centred the unread row and the pill went away', {card: true})
    })

    // The negative half needs a positive control in the same thread state, so a pill that never
    // shows at all cannot pass it: a line above the view, never seen, shows the pill with the
    // keyboard up.
    it('once the unread line has been in view, the keyboard carrying it away does not show the catch-up pill', async function () {
      // worst case (s): open 100, end 21, stable 10, the mark 135, open 100, end 21, keyboard 5,
      // stable 10; the control: keyboard 5, the mark above the view 270 (open 100, end 21, two drags
      // 4, stable 10, the mark 135), open 100, end 21, the pill 5, keyboard 5; four steps 8 = 816
      this.timeout(840_000)
      await openLong()
      await expectAtEnd()
      const t = await waitForThreadStable()
      const v = await viewport(t)
      // near the top of the view, so the rising keyboard carries the line off it
      const target = pickAnchor(t, v, 40)
      await markLongUnread(target.ordinal)
      // a fresh open, as on a visit with unread messages: the line is in view at the end
      await openLong()
      await expectAtEnd()
      check(!(await catchUpPill().isExisting()), 'the catch-up pill shows with the unread line in view')
      await step('Reopened with the unread line in view, no catch-up pill')

      await el(T.CHAT_INPUT).click()
      await waitForKeyboard()
      const k = await waitForThreadStable()
      const kv = await viewport(k)
      const carried = rowOf(k, target.ordinal)
      check(!carried || carried.bottom <= kv.top, `row ${target.ordinal} is still in view with the keyboard up: ${summary(k, kv)}`)
      check(!(await catchUpPill().isExisting()), 'the catch-up pill shows for an unread line already seen')
      await step('The keyboard carried the seen line off the view, and no catch-up pill shows', {card: true})

      await hideKeyboard()
      await markUnreadAboveTheView(2)
      await openLong()
      await expectAtEnd()
      await catchUpPill().waitForExist({timeout: 5_000})
      await el(T.CHAT_INPUT).click()
      await waitForKeyboard()
      check(await catchUpPill().isExisting(), 'with the keyboard up, the catch-up pill went away for a line never seen')
      await step('Control: a line never seen shows the catch-up pill with the keyboard up')
    })

    it('after Catch up, scrolling down reaches the present', async function () {
      // worst case (s): the mark above the view 272 (open 100, end 21, three drags 6, stable 10, the
      // mark 135), open 100, the pill 10, centred 20, stable 10, 15 drags of 2 and stable 10 = 180,
      // four steps 8 = 600
      this.timeout(620_000)
      const target = await markUnreadAboveTheView(3)
      await step('A row well up in history marked unread')
      await openLong()
      await catchUpPill().waitForExist({timeout: 10_000})
      await step('Reopened, the catch-up pill shows')
      await catchUpPill().click()
      await expectCentred(target.ordinal)
      await step('Catch up centred the unread row')

      let t = await waitForThreadStable()
      for (let i = 0; i < 15 && !isAtEnd(t, await viewport(t)); i++) {
        await dragThread(-500)
        t = await waitForThreadStable()
      }
      const v = await viewport(t)
      check(isAtEnd(t, v), `dragging down from the unread row did not reach the present: ${summary(t, v)}`)
      check(!t.moreToLoadForward, `the thread still has newer rows to load: ${summary(t, v)}`)
      await step('Dragging down from the unread row reached the present', {card: true})
    })
  })

  // e2e-sparse's newest page is mostly deleted messages, which draw no rows: the rows the first page
  // draws do not fill the view, so there is nothing to scroll. The thread loads the older pages
  // anyway, with nobody touching it, until the view is full or the history ends. Read every 50ms from
  // inside the app from the moment the thread's list appears.
  describe('a thread too short to scroll', () => {
    it('a thread whose first page draws too little to scroll loads older pages by itself', async function () {
      // worst case (s): the watch 1, open 100, row 20, the pause 1, the read 1, stable 10, end 21, step 2 = 156
      this.timeout(180_000)
      const convID = data.convIDs[E2E_CHANNELS.sparse]
      await jsEval(`${threadListPrelude}
        const g = globalThis
        if (g.__e2eOpenWatch) clearInterval(g.__e2eOpenWatch)
        g.__e2eOpenSamples = []
        g.__e2eOpenError = undefined
        const started = Date.now()
        g.__e2eOpenWatch = setInterval(() => {
          if (Date.now() - started > 20000) { clearInterval(g.__e2eOpenWatch); return }
          // a throw here would land in the app's error overlay every tick: keep it for the read below
          try {
            const fiber = e2eThreadList(${JSON.stringify(convID)})
            if (!fiber) return
            const list = e2eListInternals(fiber.stateNode._listRef)
            const data = fiber.memoizedProps.data || []
            g.__e2eOpenSamples.push({
              content: Math.round(list.contentLength()),
              offset: Math.round(list.offset()),
              rows: data.length,
              t: Date.now() - started,
              view: Math.round(list.view().height),
            })
          } catch (e) {
            g.__e2eOpenError = String((e && e.message) || e)
            clearInterval(g.__e2eOpenWatch)
          }
        }, 50)
        return true
      `)
      let samples: Array<{content: number; offset: number; rows: number; t: number; view: number}> = []
      let watchError: string | null | undefined
      try {
        await openConversation(convID)
        await waitForRow(sparseMarker(1), 20_000)
        await browser.pause(500)
      } finally {
        const read = await jsEval<{error: string | null; samples: typeof samples}>(`
          const g = globalThis
          clearInterval(g.__e2eOpenWatch)
          const s = g.__e2eOpenSamples || []
          const error = g.__e2eOpenError || null
          g.__e2eOpenSamples = undefined
          g.__e2eOpenError = undefined
          return {error, samples: s}
        `)
        watchError = read.error
        samples = read.samples
      }
      check(!watchError, `the open watch stopped: ${watchError}`)
      const first = samples.find(x => x.rows > 0 && x.content > 0)
      const changes = samples.filter((x, i) => i === 0 || x.rows !== samples[i - 1]!.rows || x.offset !== samples[i - 1]!.offset)
      console.log(`sparse thread, each change (ms: rows, content/view, offset): ${changes.map(x => `${x.t}: ${x.rows}, ${x.content}/${x.view}, ${x.offset}`).join('; ')}`)
      check(!!first, 'the list never drew a row')
      check(first!.content < first!.view, `the first page drew enough to fill the view: ${JSON.stringify(first)}`)
      const t = await waitForThreadStable()
      check(
        t.ordinals.length >= SPARSE_OLDER + SPARSE_NEWER,
        `the thread holds ${t.ordinals.length} rows, short of the ${SPARSE_OLDER + SPARSE_NEWER} messages drawn: ${summary(t)}`
      )
      // nobody moved it, so it still rests at its end, the newest message in view
      await expectAtEnd('after the older pages, the thread')
      await step('The sparse thread loaded its older pages by itself and rests at its end', {card: true})
    })
  })

  // The phone hides the tab bar inside a conversation, so the way away and back is a screen pushed
  // over the thread: its info panel.
  describe('leaving and coming back', () => {
    it('coming back from the info panel keeps the reader in place', async function () {
      // worst case (s): open 100, end 21, drag 2, stable 10, the info panel 20, back 12, the thread 5, stable 10, three steps 6 = 186
      this.timeout(200_000)
      await openLong()
      await expectAtEnd()
      await dragThread(450)
      const before = await waitForThreadStable()
      const anchor = pickAnchor(before, await viewport(before))
      await step('The reader up in the history of the long thread')

      await openHeaderMenuItem('Info', async () => el(T.CHAT_INFO_PANEL).isExisting())
      await step('The info panel over the thread')
      await closeInfoPanel()
      await waitFor('the thread to show again', async () => ((await readThread()) ? true : undefined), {timeout: 5_000})
      const after = await waitForThreadStable()
      expectRowWhere(after, anchor, 'back from the info panel')
      await step('Back from the info panel, the rows in view have not moved', {card: true})
    })
  })
})

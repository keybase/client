// Where the iOS thread scrolls, read off the list as the app holds it: opening lands at the end, new
// messages keep a reader at the end there (keyboard up or not) and leave one in history where they
// are, search hits centre and let the reader take over (a drag or a status-bar tap), pages load in
// both directions without moving the reader (and older ones with nobody scrolling when the first
// page draws too little to scroll), an edit stays in view as the keyboard rises for it, and the list
// keeps its place across an edit, a mark unread and a tab switch.
import {
  E2E_CHANNELS,
  LONG_COUNT,
  LONG_SEARCH_TOKENS,
  SHORT_COUNT,
  SPARSE_NEWER,
  SPARSE_OLDER,
  ensureChatData,
  longMarker,
  sendFromCli,
  shortMarker,
  sparseMarker,
  type ChatData,
} from '../../shared/chat-data'
import {
  catchUpPill,
  centreOffset,
  centreTolerance,
  check,
  chooseMenuItem,
  closeSearch,
  dragThread,
  editCancel,
  expectedFailure,
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
  rowOf,
  rowText,
  searchAgain,
  searchFor,
  searchOpen,
  sampleTop,
  sendMessage,
  sampleThreadWhile,
  summary,
  tapStatusBar,
  threadListPrelude,
  viewport,
  waitForRow,
  waitForThreadStable,
  wholly,
  type ThreadReading,
  type ThreadSample,
  type Viewport,
} from '../helpers/chat'
import {el} from '../helpers/elements'
import {goBackUntilGone} from '../helpers/navigate'
import {jsEval, waitFor} from '../helpers/lifecycle'
import * as T from '../../shared/test-ids'

let data: ChatData
before(async () => {
  data = await ensureChatData()
})

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

describe('chat scroll: opening', () => {
  // The phone loads a first page of 20 rows, so unlike on desktop the intro card at the top of this
  // thread is not in it; the thread still runs past the view.
  it('a short thread lands at its end', async () => {
    await openConversation(data.convIDs[E2E_CHANNELS.short])
    const newest = await waitForRow(shortMarker(SHORT_COUNT))
    const {t, v} = await expectAtEnd()
    check(t.rows.at(-1)?.ordinal === newest, `the newest row is not ${newest}: ${summary(t, v)}`)
    check(t.rows[0]!.top < v.top, `the short thread does not run past the view: ${summary(t, v)}`)
  })

  it('a long thread with more history to load lands at its end', async () => {
    await openLong()
    const newest = await waitForRow(longMarker(LONG_COUNT))
    const {t, v} = await expectAtEnd()
    check(t.moreToLoadBack, 'the long thread has no more history to load')
    check(t.rows.at(-1)?.ordinal === newest, `the newest row is not ${newest}: ${summary(t, v)}`)
  })
})

describe('chat scroll: new messages', () => {
  it('at the end, an incoming message keeps the thread at its end', async () => {
    await openScratch()
    await expectAtEnd()
    const text = `e2e-ios-scroll-incoming-end-${Date.now()}`
    await sendFromCli(E2E_CHANNELS.scratch, text)
    const sent = Date.now()
    const ordinal = await waitForRow(text, 20_000)
    console.log(`incoming at the end: its row showed ${Date.now() - sent}ms after the send returned`)
    const {t, v} = await expectAtEnd('after the incoming message, the thread')
    check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the incoming one: ${summary(t, v)}`)
  })

  // Sampled from the first send until the thread settles, so a miss says how the list moved. The
  // burst waits for the page the thread asks for as it opens, so no page lands during it.
  //
  // App bug (iOS): six messages about 120ms apart leave the list 114 points short of its end. Each
  // insert shifts the offset by the new row's 25 points; the first two start the animated follow,
  // and each lands during the one before it, which it cuts short, and from the third on no follow
  // starts at all (offset 25, 45.7, 54.3, 75, 100, 125). The same on a list without the newer
  // scroll fixes, so it predates them: the content-position anchor's autoscroll does not follow an
  // insert that lands while its own animated scroll is running. Remove the expected-failure mark
  // once fixed.
  it('at the end, a burst of incoming messages keeps the thread at its end', async () => {
    await openScratch()
    await expectAtEnd()
    const settled = (await waitForRowsToHold()).ordinals.length
    await expectAtEnd()
    console.log(`a burst of 6 incoming messages, from ${settled} rows loaded`)
    let last = ''
    let ordinal = -1
    const samples = await sampleThreadWhile(async () => {
      for (let i = 0; i < 6; i++) {
        last = `e2e-ios-scroll-burst-${Date.now()}-${i}`
        await sendFromCli(E2E_CHANNELS.scratch, last)
      }
      ordinal = await waitForRow(last, 20_000)
      await waitForThreadStable()
    })
    const t = await waitForThreadStable()
    const v = await viewport(t)
    const at = (s: ThreadSample) => `${Math.round(s.t - samples[0]!.t)}ms`
    const counts = samples.filter((s, i) => i === 0 || s.count !== samples[i - 1]!.count).map(s => `${at(s)}: ${s.count}`)
    const moves = samples
      .filter((s, i) => i > 0 && Math.abs(s.offset - samples[i - 1]!.offset) >= 0.5)
      .map(s => `${at(s)}: ${Math.round(s.offset * 10) / 10}`)
    const during = `rows loaded ${counts.join(', ')}; offset ${moves.join(', ') || 'unchanged'}`
    console.log(`a burst of 6 incoming messages: newest row ${newestGap(t, v)}pt above the composer (${during})`)
    await expectedFailure({bug: 'a burst of incoming messages at the end is not followed', origin: 'suspected pre-existing on master: the maintainVisibleContentPosition autoscroll races the insert animation of the new rows'}, () => {
      check(isAtEnd(t, v), `after the burst, the thread is not at its end (${during}): ${summary(t, v)}`)
      check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the last of the burst: ${summary(t, v)}`)
    })
  })

  it('with the keyboard up, the first keystroke keeps the newest message above the composer', async () => {
    await openScratch()
    await expectAtEnd()
    await el(T.CHAT_INPUT).click()
    await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
    const up = await expectAtEnd('with the keyboard up, the thread')
    check(up.t.keyboardTop !== undefined, `no keyboard reading: ${summary(up.t, up.v)}`)
    await el(T.CHAT_INPUT).addValue('x')
    await expectAtEnd('after the first keystroke, the thread')
    await el(T.CHAT_INPUT).clearValue()
  })

  it('with the keyboard up, an incoming message and a send keep the newest message above the composer', async () => {
    await openScratch()
    await expectAtEnd()
    await el(T.CHAT_INPUT).click()
    await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
    await expectAtEnd('with the keyboard up, the thread')

    const incoming = `e2e-ios-scroll-kb-incoming-${Date.now()}`
    await sendFromCli(E2E_CHANNELS.scratch, incoming)
    const incomingOrdinal = await waitForRow(incoming, 20_000)
    const a = await expectAtEnd('after an incoming message with the keyboard up, the thread')
    check(a.t.rows.at(-1)?.ordinal === incomingOrdinal, `the newest row is not the incoming one: ${summary(a.t, a.v)}`)
    check(await isKeyboardUp(), 'the keyboard went down')

    const sent = `e2e-ios-scroll-kb-send-${Date.now()}`
    const sentOrdinal = await sendMessage(sent)
    const b = await expectAtEnd('after a send with the keyboard up, the thread')
    check(b.t.rows.at(-1)?.ordinal === sentOrdinal, `the newest row is not the one sent: ${summary(b.t, b.v)}`)
  })

  for (const {how, move} of [
    {how: 'dragged up into history', move: async () => dragThread(400)},
    {how: 'flicked from the end into history', move: async () => flickThread(500)},
  ]) {
    it(`${how}, an incoming message leaves the reader where they are`, async () => {
      await openScratch()
      await expectAtEnd()
      await move()
      const before = await waitForThreadStable()
      const v = await viewport(before)
      check(!isAtEnd(before, v), `the thread is still at its end: ${summary(before, v)}`)
      const anchor = pickAnchor(before, v)

      await sendFromCli(E2E_CHANNELS.scratch, `e2e-ios-scroll-incoming-up-${Date.now()}`)
      await waitFor(
        'the incoming message to load',
        async () => ((await requireThread()).ordinals.length > before.ordinals.length ? true : undefined),
        {timeout: 20_000}
      )
      const after = await waitForThreadStable()
      expectRowWhere(after, anchor, 'after the incoming message')
    })
  }
})

describe('chat scroll: search', () => {
  afterEach(async () => {
    if (await searchOpen()) await closeSearch()
  })

  it('a deep hit loads its page and is centred', async () => {
    await openLong()
    await expectAtEnd()
    const {index, token} = LONG_SEARCH_TOKENS.deep
    check(!(await ordinalsWithText(longMarker(index))).length, 'the deep hit is already loaded')
    const ordinal = await searchAndSelect(token)
    await expectCentred(ordinal)
  })

  it('searching again for the same hit after dragging away centres it again', async () => {
    await openLong()
    const {token} = LONG_SEARCH_TOKENS.middle
    const ordinal = await searchAndSelect(token)
    await expectCentred(ordinal)

    // toward older rows: the hit sits ten rows from the newest of its window, too near its edge for a
    // drag toward newer rows to take it out of the middle
    await dragThread(350)
    const moved = await waitForThreadStable()
    const mv = await viewport(moved)
    const r = rowOf(moved, ordinal)
    check(!r || Math.abs(centreOffset(r, mv)) > centreTolerance(mv), `the drag left row ${ordinal} centred`)

    await searchAgain()
    await expectCentred(ordinal)
  })

  // A drag done the moment the hit's row lands, while the list is still centring it. The reader's
  // move wins: the list stays where the drag left it and is not pulled back to the hit. (A
  // status-bar tap cannot be told apart here: every hit's page holds only about ten rows newer than
  // the hit, so its centred place and the list's top, where a tap goes, are both offset 0.)
  const moveDuringCentring = async (move: () => Promise<void>) => {
    await openLong()
    await expectAtEnd()
    const {token} = LONG_SEARCH_TOKENS.deep
    await openThreadSearch()
    await searchFor(token)
    await waitFor('the hit to load', async () => ((await ordinalsWithText(token)).length ? true : undefined), {
      interval: 50,
      timeout: 20_000,
    })
    const pre = await requireThread()
    await move()
    const moved = await waitForThreadStable()
    check(Math.abs(moved.offset - pre.offset) > 20, `the move did not move the list: ${summary(pre)} then ${summary(moved)}`)
    // outlast the centring's own schedule, then check nothing pulled the reader back
    await browser.pause(3_500)
    const later = await waitForThreadStable()
    check(
      Math.abs(later.offset - moved.offset) <= stillTolerance,
      `the list moved after the reader did: ${summary(moved)} then ${summary(later)}`
    )
    return {moved, ordinal: (await ordinalsWithText(token))[0]!}
  }

  it('a drag during centring stops it', async () => {
    const {moved, ordinal} = await moveDuringCentring(async () => dragThread(250))
    const v = await viewport(moved)
    const r = rowOf(moved, ordinal)
    check(
      !r || Math.abs(centreOffset(r, v)) > centreTolerance(v),
      `row ${ordinal} was pulled back to the middle: ${JSON.stringify(r)} ${summary(moved, v)}`
    )
  })

  // App bug (iOS): closing search moves the rows and nothing puts them back. Closing swaps the
  // search bar back for the composer; the scroll view keeps its offset, so the rows shift with the
  // layout change (cause not yet pinned down). Readings (window points): the centred hit's row top 400
  // with search open, 376.7 once the list settles, never corrected (448.3 while the list also padded
  // its end by the search bar's height). Remove the expected-failure mark once fixed.
  it('closing search leaves the list where it is', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.middle.token)
    const {t} = await expectCentred(ordinal)
    const before = rowOf(t, ordinal)!

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
    check(!isAtEnd(after, v), `the thread went to its end: ${summary(after, v)}`)
    await expectedFailure({bug: 'closing search moves the rows by the composer swap', origin: 'suspected pre-existing on master'}, () => {
      const r = rowOf(after, ordinal)
      check(
        !!r && Math.abs(r.top - before.top) <= stillTolerance,
        `row ${ordinal} moved from ${before.top} to ${r?.top}: ${summary(after, v)}`
      )
    })
  })

  // Closing search with the list resting at its end, the newest message loaded, gives the end back
  // to the list where it was before search opened: the next message is followed as on any thread at
  // its end.
  it('closing search at the newest message, then an incoming message keeps the end', async () => {
    await openScratch()
    await expectAtEnd()
    const token = `e2esearchend${Date.now()}`
    await sendMessage(`e2e-ios-scroll-search-end ${token}`)
    await hideKeyboard()
    const rest = await expectAtEnd()
    const restGap = newestGap(rest.t, rest.v)!
    await openThreadSearch()
    // the search index can take a moment to hold a message just sent
    await waitFor(
      `the search for ${token} to find it`,
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

    const text = `e2e-ios-scroll-search-end-incoming-${Date.now()}`
    await sendFromCli(E2E_CHANNELS.scratch, text)
    const ordinal = await waitForRow(text, 20_000)
    const t = await waitForThreadStable()
    const v = await viewport(t)
    console.log(`then an incoming message: newest row ${newestGap(t, v)}pt above the composer`)
    check(
      closedGap !== undefined && Math.abs(closedGap - restGap) <= 1 && Math.abs(closed.offset - rest.t.offset) <= 1,
      `closing search left the thread off its end: ${summary(closed, cv)}, before search ${summary(rest.t, rest.v)}`
    )
    check(isAtEnd(t, v), `after the incoming message, the thread is not at its end: ${summary(t, v)}`)
    check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the incoming one: ${summary(t, v)}`)
  })

  it('jump to recent from a deep hit lands at the newest message and closes search', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
    await expectCentred(ordinal)
    await hideKeyboard()
    await jumpToRecentButton().click()
    const newest = await waitForRow(longMarker(LONG_COUNT), 15_000)
    const {t, v} = await expectAtEnd('after jump to recent, the thread')
    check(t.rows.at(-1)?.ordinal === newest, `the newest row is not ${newest}: ${summary(t, v)}`)
    await jumpToRecentButton().waitForExist({reverse: true, timeout: 5_000})
    check(!(await searchOpen()), 'thread search is still open')
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

type Landing = {added: number; atEdge: boolean; i: number; travel?: number; what: string}

// Drags the thread in `step`-point steps until `done`. Each step's travel is read off a row in view
// before it that stays rendered; a step in which a page landed must travel as far as the steps in
// which none did, so a landing never moves what the reader sees. Dragging toward newer rows while a
// newer page is still to come, a drag that would reach the newest row loaded first waits a moment
// for the page (it loads once the reader is within ten rows), and drags on when none comes; a page
// that lands with the reader on that row is marked, as the flow for it is its own. Returns the
// landings (with the rows each brought), and which of them moved the reader by more than
// `tolerance`.
const scrollThroughPages = async (
  step: number,
  done: (t: ThreadReading, v: Viewport) => boolean,
  tolerance = pagingTolerance
) => {
  let t = await waitForThreadStable()
  let v = await viewport(t)
  const plain: Array<number> = []
  const landed: Array<Landing> = []
  for (let i = 0; i < 100 && !done(t, v); i++) {
    const before = t
    // how far a drag moves the list, until one has been measured
    const travelled = plain.length ? Math.abs(plain[0]!) : Math.abs(step)
    const atEdge = step < 0 && before.moreToLoadForward && before.offset - travelled < 20
    if (atEdge) {
      const came = await waitFor(
        'a page of newer rows',
        async () => ((await requireThread()).ordinals.length > before.ordinals.length ? true : undefined),
        {timeout: 3_000}
      ).catch(() => false)
      if (came) {
        t = await waitForThreadStable()
        v = await viewport(t)
        continue
      }
    }
    const anchor = rowToFollow(before, v, step)
    if (!anchor) throw new Error(`step ${i}: no row in view to follow: ${summary(before, v)}`)
    await dragThread(step)
    t = await waitForThreadStable()
    v = await viewport(t)
    const now = rowOf(t, anchor.ordinal)
    const travel = now && now.top - anchor.top
    if (t.ordinals.length !== before.ordinals.length) {
      const what = `row ${anchor.ordinal} at ${anchor.top} -> ${now?.top}; ${summary(before, v)} then ${summary(t, v)}`
      landed.push({added: t.ordinals.length - before.ordinals.length, atEdge, i, travel, what})
    } else {
      check(travel !== undefined, `step ${i}: row ${anchor.ordinal} is no longer rendered: ${summary(t, v)}`)
      // the last step can stop short at the end of the thread, and one from the edge at the edge
      if (!done(t, v) && !atEdge) plain.push(travel!)
    }
  }
  check(done(t, v), `the scroll did not reach its end: ${summary(t, v)}`)
  check(plain.length >= 2, `only ${plain.length} steps loaded no page, too few to measure a drag's travel`)
  const usual = [...plain].sort((a, b) => a - b)[Math.floor(plain.length / 2)]!
  const moved = (l: Landing) => l.travel === undefined || Math.abs(l.travel - usual) > tolerance
  const describe = (ls: Array<Landing>) =>
    ls.map(l => `step ${l.i}: the reader's row travelled ${l.travel ?? 'out of the rendered rows'} where a drag moves it ${usual}: ${l.what}`).join('\n')
  return {describe, landed, moved}
}

// One drag, and how far it moved a row that stayed in view.
const dragTravel = async (dy: number) => {
  const before = await waitForThreadStable()
  const v = await viewport(before)
  const anchor = rowToFollow(before, v, dy)
  if (!anchor) throw new Error(`no row in view to follow: ${summary(before, v)}`)
  await dragThread(dy)
  const after = await waitForThreadStable()
  const now = rowOf(after, anchor.ordinal)
  check(!!now, `row ${anchor.ordinal} is no longer measured: ${summary(after)}`)
  return {after, before, travel: now!.top - anchor.top}
}

// A page of newer rows lands at rest once the list has been still (no scroll event) for 100ms. How
// long the list must have been still when a page lands, less a sample's worth of slack.
const heldRestMs = 80

type SampledLanding = {rows: string; shift: number; stillFor: number}

// The pages that landed in a run of samples (a sample with more rows loaded than the one before):
// how long the list had been still (its offset unchanged) when each landed, and how far the rows in
// view just before it moved over the 300ms from the landing (Infinity when one left the rows near
// the view).
const sampledLandings = (samples: ReadonlyArray<ThreadSample>, v: Viewport) => {
  const out: Array<SampledLanding> = []
  let lastMove = samples[0]?.t ?? 0
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!
    const b = samples[i]!
    if (b.count === a.count) {
      if (Math.abs(b.offset - a.offset) >= 0.5) lastMove = b.t
      continue
    }
    if (b.count < a.count) continue
    const inView = a.rows.filter(([, top]) => top >= v.top && top <= v.bottom - 40)
    let shift = 0
    for (let j = i; j < samples.length && samples[j]!.t - b.t <= 300; j++) {
      // the list can read no rows at all mid-render, the tick the page lands
      if (!samples[j]!.rows.length) continue
      for (const [ordinal, top] of inView) {
        const now = sampleTop(samples[j]!, ordinal)
        shift = Math.max(shift, now === undefined ? Infinity : Math.abs(now - top))
      }
    }
    out.push({rows: `${a.count} -> ${b.count}`, shift: Math.round(shift * 10) / 10, stillFor: Math.round(b.t - lastMove)})
  }
  return out
}

const describeLandings = (ls: ReadonlyArray<SampledLanding>) =>
  ls.map(l => `${l.rows} rows after ${l.stillFor}ms still, rows in view moved ${l.shift}`).join('; ')

// Every page landed at rest and left the rows in view where they were.
const checkLandings = (ls: ReadonlyArray<SampledLanding>, what: string) => {
  check(ls.length >= 1, `${what}: no page landed`)
  const moving = ls.filter(l => l.stillFor < heldRestMs)
  check(!moving.length, `${what}: pages landed while the list moved: ${describeLandings(moving)}`)
  const jumped = ls.filter(l => l.shift > stillTolerance)
  check(!jumped.length, `${what}: pages moved the rows in view: ${describeLandings(jumped)}`)
}

describe('chat scroll: paging', () => {
  // A thread left alone at its end loads the pages the reader is near once (the phone's first page of
  // 20 rows is within two screens of its oldest row, so one page of 100 more follows), then no more:
  // the rows loaded stay the same over a long idle stretch, and a drag up still loads older pages.
  for (const {name, open} of [
    {name: 'e2e-scratch', open: openScratch},
    {name: 'e2e-long', open: openLong},
  ]) {
    it(`left idle at its end, ${name} loads no more pages, and dragging up still loads them`, async () => {
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
    })
  }

  // A page of older rows lands during a drag up from the end of the thread; the drag moves the
  // reader's rows as far as the next drag, with that page loaded, does. The thread loads a page as it
  // opens, so the drags start once that has landed and go on until one brings in the next.
  it('an older page landing during a drag up from the end leaves the reader where the drag put them', async () => {
    await openLong()
    await expectAtEnd()
    await waitForRowsToHold()
    let drags = 0
    const landing = await waitFor(
      'a drag during which an older page lands',
      async () => {
        drags++
        const d = await dragTravel(400)
        return d.after.ordinals.length > d.before.ordinals.length ? d : undefined
      },
      {interval: 0, timeout: 90_000}
    )
    const plain = await dragTravel(400)
    console.log(
      `an older page landed during drag ${drags} (${landing.before.ordinals.length} to ${landing.after.ordinals.length} rows), travel ${landing.travel}; the next drag ${plain.travel}`
    )
    check(plain.after.ordinals.length === plain.before.ordinals.length, 'a page landed during the next drag too')
    check(
      Math.abs(landing.travel - plain.travel) <= pagingTolerance,
      `the drag moved the reader's row ${landing.travel}pt as the page landed, ${plain.travel}pt with it loaded`
    )
  })

  // Pages load two screens ahead of the reader, and one lands, the next is asked for as soon as
  // the reader is still that near the oldest row loaded: the first drag from the end brings in
  // several pages (20 rows loaded became 320 in one drag, then 403 in the next). So pages are
  // counted by the rows each drag brought in, and every drag during which rows landed must travel
  // as the drags without a landing do.
  it('dragging up loads older pages without moving the reader, back to the first message', async () => {
    await openLong()
    const start = (await expectAtEnd()).t.ordinals.length
    const {describe, landed, moved} = await scrollThroughPages(
      400,
      t => !t.moreToLoadBack && t.rows[0]!.top >= t.listTop - 1,
      olderPagingTolerance
    )
    // pages also land while the list rests between drags, so the whole history is counted at the end
    const loaded = (await waitForThreadStable()).ordinals.length
    console.log(`older pages: from ${start} rows to ${loaded}; ${landed.map(l => `step ${l.i} +${l.added} rows, travel ${l.travel}`).join('; ')}`)
    check(landed.length >= 1, 'no page landed during a drag')
    check(loaded >= LONG_COUNT, `the thread holds ${loaded} rows, short of the ${LONG_COUNT} messages`)
    check(!landed.some(moved), describe(landed.filter(moved)))
    await waitForRow(longMarker(1))
  })

  // Dragging down from an old hit reaches the present, and no page of newer rows moves the reader,
  // mid-drag or at the drag's end on the newest row loaded.
  //
  // App bug (iOS): a newer page throws the reader ahead. The page is prepended to the inverted
  // list, and maintainVisibleContentPosition must shift the offset by the new rows' height in the
  // same commit; RN's VirtualizedList renders the new window first, so the shift is skipped and the
  // rows in view move out of the rendered rows (125 rows becoming 225 in one drag). The reader's
  // row still reaches the present, which this flow requires. Remove the expected-failure mark once
  // fixed.
  it('dragging down from an old hit loads newer pages until the present', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
    await expectCentred(ordinal)
    await closeSearch()
    await jumpToRecentButton().waitForExist({timeout: 5_000})

    const v = await viewport(await waitForThreadStable())
    let paging: Awaited<ReturnType<typeof scrollThroughPages>> | undefined
    const samples = await sampleThreadWhile(async () => {
      paging = await scrollThroughPages(-200, (t, tv) => isAtEnd(t, tv))
    })
    const {describe, landed, moved} = paging!
    const sampled = sampledLandings(samples, v)
    console.log(`newer pages while dragging: ${landed.length} drags with a landing; ${describeLandings(sampled)}`)
    check(landed.length >= 2, `only ${landed.length} drags had a page land`)
    await waitForRow(longMarker(LONG_COUNT))
    await expectAtEnd()
    await jumpToRecentButton().waitForExist({reverse: true, timeout: 5_000})
    await expectedFailure({bug: 'a newer page landing mid-drag throws the reader ahead', origin: 'introduced on this branch by 0de2ca2456 (mobile newer-page loading; master loads no newer pages)'}, () => {
      check(!landed.some(moved), describe(landed.filter(moved)))
      checkLandings(sampled, 'dragging')
    })
  })

  // The same through flicks: the list keeps moving after the finger lifts, and a page asked for
  // mid-fling waits for it to stop.
  //
  // App bug (iOS): the same skipped window shift as dragging down; nothing holds a page until the
  // list rests, so each lands mid-fling and the rows in view leave the rendered rows. Remove the
  // expected-failure mark once fixed.
  it('flicking down from an old hit, newer pages land at rest without moving the reader', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
    await expectCentred(ordinal)
    await closeSearch()

    const v = await viewport(await waitForThreadStable())
    const samples = await sampleThreadWhile(async () => {
      for (let i = 0; i < 40; i++) {
        const t = await waitForThreadStable()
        if (isAtEnd(t, await viewport(t))) break
        // short enough to start above the jump-to-recent button, which takes a touch that lands on it
        await flickThread(-300)
      }
    })
    const sampled = sampledLandings(samples, v)
    console.log(`newer pages while flicking: ${describeLandings(sampled)}`)
    await waitForRow(longMarker(LONG_COUNT))
    await expectAtEnd()
    await expectedFailure({bug: 'a newer page landing mid-fling throws the reader ahead', origin: 'introduced on this branch by 0de2ca2456 (mobile newer-page loading; master loads no newer pages)'}, () => {
      checkLandings(sampled, 'flicking')
    })
  })

  // App bug (iOS): a status-bar tap from the deep hit scrolls the list to the newest row loaded
  // (125 of 403, offset 0), and the next page carries the reader with it: RN's VirtualizedList
  // renders the new window before maintainVisibleContentPosition shifts the offset, so the shift is
  // skipped; sampled every 16ms, the offset stays 0 and the rows at the bottom read 225, 224 where
  // 125, 124 were (row 124 leaves the rendered rows). Remove the expected-failure mark once fixed.
  it('resting on the newest row of a window of history, the next page leaves the reader where they are', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
    await expectCentred(ordinal)
    await closeSearch()
    const before = await waitForThreadStable()
    check(before.moreToLoadForward, `the hit's page holds the newest message: ${summary(before)}`)
    const newestLoaded = before.ordinals.at(-1)!
    const v0 = await viewport(before)
    const samples = await sampleThreadWhile(async () => {
      await tapStatusBar()
      await waitFor(
        'the next page of newer rows',
        async () => ((await requireThread()).ordinals.length > before.ordinals.length ? true : undefined),
        {timeout: 15_000}
      )
      await waitForThreadStable()
    })
    const sampled = sampledLandings(samples, v0)
    console.log(`newer page after a status-bar tap: ${describeLandings(sampled)}`)
    const after = await waitForThreadStable()
    const v = await viewport(after)
    await expectedFailure({bug: 'a newer page carries a reader resting on the newest row with it', origin: 'introduced on this branch by 0de2ca2456 (mobile newer-page loading; master loads no newer pages)'}, () => {
      checkLandings(sampled, 'after a status-bar tap')
      check(
        wholly(rowOf(after, newestLoaded), v),
        `row ${newestLoaded}, the newest the reader could reach, left the view: ${summary(after, v)}`
      )
    })
  })
})

describe('chat scroll: back to the end', () => {
  for (const {how, toEnd} of [
    {
      how: 'dragging back down',
      toEnd: async () => {
        for (let i = 0; i < 6 && !isAtEnd(await waitForThreadStable(), await viewport()); i++) await dragThread(-500)
      },
    },
    {how: 'a status-bar tap', toEnd: tapStatusBar},
  ]) {
    it(`${how} re-pins it, and a later incoming message keeps the end`, async () => {
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

      await toEnd()
      await expectAtEnd('back at the end, the thread')

      // sampled from the send until the thread settles, so a miss says what else moved the list then
      const text = `e2e-ios-scroll-repin-${Date.now()}`
      let ordinal = -1
      const samples = await sampleThreadWhile(async () => {
        await sendFromCli(E2E_CHANNELS.scratch, text)
        ordinal = await waitForRow(text, 20_000)
        await waitForThreadStable()
      })
      const t = await waitForThreadStable()
      const v = await viewport(t)
      const at = (s: ThreadSample) => `${Math.round(s.t - samples[0]!.t)}ms`
      const counts = samples.filter((s, i) => i === 0 || s.count !== samples[i - 1]!.count).map(s => `${at(s)}: ${s.count}`)
      const moves = samples
        .filter((s, i) => i > 0 && Math.abs(s.offset - samples[i - 1]!.offset) >= 0.5)
        .map(s => `${at(s)}: ${Math.round(s.offset * 10) / 10}`)
      const during = `rows loaded ${counts.join(', ')}; offset ${moves.join(', ') || 'unchanged'}`
      console.log(`${how}, then an incoming message: ${during}`)
      check(isAtEnd(t, v), `after the incoming message, the thread is not at its end (${during}): ${summary(t, v)}`)
      check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the incoming one: ${summary(t, v)}`)
    })
  }
})

describe('chat scroll: editing', () => {
  afterEach(async () => {
    if (await editCancel().isExisting()) await editCancel().click()
    await editCancel().waitForExist({reverse: true, timeout: 5_000})
  })

  // Where the keyboard's top sits once it is up, measured by focusing the composer.
  const keyboardTopWhenUp = async () => {
    await el(T.CHAT_INPUT).click()
    await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
    // the app hears the keyboard's metrics a moment after the element reports it shown
    const top = await waitFor('the keyboard in the app', async () => (await requireThread()).keyboardTop, {timeout: 5_000})
    await hideKeyboard()
    await waitForThreadStable(20_000)
    return top
  }

  // A message of the user's with `below` incoming messages after it, so it can sit anywhere in view.
  const sendWithRowsBelow = async (below: number) => {
    const text = `e2e-ios-scroll-edit-kb-${Date.now()}`
    const ordinal = await sendMessage(text)
    await hideKeyboard()
    let last = ''
    for (let i = 0; i < below; i++) {
      last = `e2e-ios-scroll-edit-kb-below-${Date.now()}-${i}`
      await sendFromCli(E2E_CHANNELS.scratch, last)
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
    await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
    const t = await waitForThreadStable()
    return {t, v: await viewport(t)}
  }

  // Records, on the app's clock, when the keyboard reports it has finished showing.
  const watchKeyboardDidShow = async () =>
    jsEval<boolean>(`
      const g = globalThis
      let id
      for (const [i, m] of __r.getModules()) if (m.verboseName && m.verboseName.startsWith('node_modules/react-native-keyboard-controller/src/index')) id = i
      if (id === undefined) throw new Error('no react-native-keyboard-controller module')
      if (g.__e2eKbDidShow) g.__e2eKbDidShow.remove()
      const now = g.nativePerformanceNow ? () => g.nativePerformanceNow() : () => Date.now()
      g.__e2eKbDidShowAt = []
      g.__e2eKbDidShow = __r(id).KeyboardEvents.addListener('keyboardDidShow', () => g.__e2eKbDidShowAt.push(now()))
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
  it('editing a row that the rising keyboard half covers brings it into view above the keyboard', async () => {
    await openScratch()
    const kbTop = await keyboardTopWhenUp()
    const {ordinal, text} = await sendWithRowsBelow(8)
    const {r, t} = await bringRowTo(ordinal, kbTop)
    const v0 = await viewport(t)
    check(wholly(r, v0), `row ${ordinal} is not wholly in view before the edit: ${JSON.stringify(r)} ${summary(t, v0)}`)
    check(r.top < kbTop && r.bottom > kbTop, `row ${ordinal} does not straddle the keyboard's top ${kbTop}: ${JSON.stringify(r)}`)
    const {t: after, v} = await editWithKeyboard(text)
    console.log(
      `half covered: row ${ordinal} at ${r.top}-${r.bottom} with the keyboard's top at ${kbTop}; editing, ${JSON.stringify(rowOf(after, ordinal))} with the composer's top at ${v.bottom}`
    )
    check(wholly(rowOf(after, ordinal), v), `row ${ordinal} is not wholly in view with the keyboard up: ${summary(after, v)}`)
  })

  // A row near the top of the view when the edit starts: the keyboard rising must not leave it off
  // the top. Sampled every frame from the edit until a second after the keyboard reports it has
  // finished showing: once the row is wholly in view it stays there.
  it('editing a row near the top keeps it in view once the keyboard is up', async () => {
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
  })

  it('editing a message in view does not scroll the thread', async () => {
    await openScratch()
    const text = `e2e-ios-scroll-edit-${Date.now()}`
    const ordinal = await sendMessage(text)
    await hideKeyboard()
    await expectAtEnd()

    await openMessageMenu(text)
    await chooseMenuItem('Edit')
    await editCancel().waitForExist({timeout: 5_000})
    const {t, v} = await expectAtEnd('editing, the thread')
    check(wholly(rowOf(t, ordinal), v), `row ${ordinal} is not wholly in view: ${summary(t, v)}`)
  })
})

it('chat scroll: mark unread shows the catch-up pill, which centres the unread message', async () => {
  await openLong()
  await expectAtEnd()
  await dragThread(500)
  await dragThread(500)
  const up = await waitForThreadStable()
  const uv = await viewport(up)
  const target = pickAnchor(up, uv, 60)
  try {
    await openMessageMenu(await rowText(target.ordinal))
    await chooseMenuItem('Mark as unread')
    await waitForThreadStable()
    check(!(await catchUpPill().isExisting()), 'the catch-up pill shows with the unread line in view')

    await tapStatusBar()
    await expectAtEnd()
    await catchUpPill().waitForExist({timeout: 5_000})
    await catchUpPill().click()
    await expectCentred(target.ordinal)
    await catchUpPill().waitForExist({reverse: true, timeout: 5_000})
  } finally {
    // a fresh open marks the thread read again
    await openLong()
  }
})

// e2e-sparse's newest page is mostly deleted messages, which draw no rows: the rows the first page
// draws do not fill the view, so there is nothing to scroll. The thread loads the older pages anyway,
// with nobody touching it, until the view is full or the history ends. Read every 50ms from inside
// the app from the moment the thread's list appears.
it('chat scroll: a thread whose first page draws too little to scroll loads older pages by itself', async () => {
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
  if (watchError) throw new Error(`the open watch stopped: ${watchError}`)
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
})

// The phone hides the tab bar inside a conversation, so the way away and back is a screen pushed
// over the thread: its info panel.
it('chat scroll: coming back from the info panel keeps the reader in place', async () => {
  await openLong()
  await expectAtEnd()
  await dragThread(450)
  const before = await waitForThreadStable()
  const anchor = pickAnchor(before, await viewport(before))

  await openHeaderMenuItem('Info', async () => el(T.CHAT_INFO_PANEL).isExisting())
  await goBackUntilGone(T.CHAT_INFO_PANEL)
  await waitFor('the thread to show again', async () => ((await readThread()) ? true : undefined), {timeout: 5_000})
  const after = await waitForThreadStable()
  expectRowWhere(after, anchor, 'back from the info panel')
})

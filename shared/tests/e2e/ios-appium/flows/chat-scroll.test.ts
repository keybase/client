// Where the iOS thread scrolls, read off the list as the app holds it: opening lands at the end, new
// messages keep a reader at the end there (keyboard up or not) and leave one in history where they
// are, search hits centre and let the reader take over (a drag or a status-bar tap), pages load in
// both directions without moving the reader, and the list keeps its place across an edit, a mark
// unread and a tab switch.
import {
  E2E_CHANNELS,
  LONG_COUNT,
  LONG_SEARCH_TOKENS,
  SHORT_COUNT,
  ensureChatData,
  longMarker,
  sendFromCli,
  shortMarker,
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
import {waitFor} from '../helpers/lifecycle'
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

    await dragThread(-350)
    const moved = await waitForThreadStable()
    const mv = await viewport(moved)
    const r = rowOf(moved, ordinal)
    check(!r || Math.abs(centreOffset(r, mv)) > centreTolerance(mv), `the drag left row ${ordinal} centred`)

    await searchAgain()
    await expectCentred(ordinal)
  })

  // Each way the reader can move the list, done the moment the hit's row lands, while the list is
  // still centring it. The reader's move wins: the list stays where it left it and is not pulled
  // back to the hit.
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

  // The tap scrolls the list to its top (for this inverted list, the newest rows loaded), and it
  // stays there: tapping again finds it already there.
  it('a status-bar tap during centring stops it', async () => {
    const {moved} = await moveDuringCentring(tapStatusBar)
    await tapStatusBar()
    const again = await waitForThreadStable()
    check(
      Math.abs(again.offset - moved.offset) <= stillTolerance,
      `the first tap did not leave the list at its top: ${summary(moved)} then ${summary(again)}`
    )
  })

  // App bug (integration build with the settling-window fix, iOS): closing search leaves the rows
  // near, not at, where they were. Readings (window points): the centred hit's row top 400 with
  // search open, 418.3 once the list settles; sampled every 16ms across the close, the row is away
  // from 400 for about 1.3s, by up to 23.3 points (before the fix: 448.3 after the 71.7-point shift,
  // never corrected). Remove the expected-failure mark once fixed.
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
    await expectedFailure('closing search leaves the rows about 18 points from their place', () => {
      const r = rowOf(after, ordinal)
      check(
        !!r && Math.abs(r.top - before.top) <= stillTolerance,
        `row ${ordinal} moved from ${before.top} to ${r?.top}: ${summary(after, v)}`
      )
    })
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

// A page of newer rows waits for the list to stop moving (no scroll event for 100ms) before it
// lands. How long the list must have been still when a page lands, less a sample's worth of slack.
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
  // The first page of older rows lands during a drag from the end of the thread; the drag moves the
  // reader's rows as far as the same drag does once that page is loaded.
  it('the first older page landing during a drag from the end leaves the reader where the drag put them', async () => {
    await openLong()
    await expectAtEnd()
    const landing = await dragTravel(400)
    check(landing.after.ordinals.length > landing.before.ordinals.length, 'no page landed during the first drag')
    await tapStatusBar()
    await expectAtEnd()
    const plain = await dragTravel(400)
    check(plain.after.ordinals.length === plain.before.ordinals.length, 'a page landed during the second drag')
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
    const rows = landed.reduce((n, l) => n + l.added, 0)
    console.log(`older pages: ${landed.map(l => `step ${l.i} +${l.added} rows, travel ${l.travel}`).join('; ')}`)
    check(landed.length >= 1, 'no page landed during a drag')
    check(start + rows >= LONG_COUNT, `the drags brought in ${rows} rows from ${start}, short of the ${LONG_COUNT} messages`)
    check(!landed.some(moved), describe(landed.filter(moved)))
    await waitForRow(longMarker(1))
  })

  // Pages of newer rows are held while the list moves and land at rest: none moves the reader,
  // mid-drag or at the drag's end on the newest row loaded.
  //
  // App bug (integration build with the held newer page, iOS), in 2 of 3 runs: every page landed
  // at rest (146-411ms after the list stopped), but a later one still threw the reader ahead: the
  // reader's row left the rendered rows as 225 rows became 403 in one drag (run 1), and as 325
  // became 403 (run 2); the 16ms samples agree. The third run held all three landings in place.
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
    check(!landed.some(moved), describe(landed.filter(moved)))
    checkLandings(sampled, 'dragging')
    await waitForRow(longMarker(LONG_COUNT))
    await expectAtEnd()
    await jumpToRecentButton().waitForExist({reverse: true, timeout: 5_000})
  })

  // The same through flicks: the list keeps moving after the finger lifts, and a page asked for
  // mid-fling waits for it to stop.
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
    checkLandings(sampled, 'flicking')
    await waitForRow(longMarker(LONG_COUNT))
    await expectAtEnd()
  })

  // App bug (integration build with the held newer page, iOS): a status-bar tap from the deep hit
  // scrolls the list to the newest row loaded (125 of 403, offset 0); the next page is held until
  // the list rests and lands about 500ms later, and carries the reader with it: sampled every 16ms,
  // the offset stays 0 and the rows at the bottom read 225, 224 where 125, 124 were (row 124 leaves
  // the rendered rows). Drags and flicks that end short of that row are not carried (their flows
  // hold it). Remove the expected-failure mark once fixed.
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
    await expectedFailure('a newer page carries a reader resting on the newest row with it', () => {
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

      const text = `e2e-ios-scroll-repin-${Date.now()}`
      await sendFromCli(E2E_CHANNELS.scratch, text)
      const ordinal = await waitForRow(text, 20_000)
      const {t, v} = await expectAtEnd('after the incoming message, the thread')
      check(t.rows.at(-1)?.ordinal === ordinal, `the newest row is not the incoming one: ${summary(t, v)}`)
    })
  }
})

describe('chat scroll: editing', () => {
  afterEach(async () => {
    if (await editCancel().isExisting()) await editCancel().click()
    await editCancel().waitForExist({reverse: true, timeout: 5_000})
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

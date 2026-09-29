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
  sendMessage,
  summary,
  tapStatusBar,
  viewport,
  waitForRow,
  waitForThreadStable,
  wholly,
  type ThreadReading,
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
    const ordinal = await waitForRow(text, 20_000)
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

  // App bug (integration build, iOS): closing thread search moves the rows the reader is looking at
  // down by about 48 points instead of leaving them where they are. Readings (window points): the
  // centred hit's row top 400 with search open, 448.3 after the close (3 of 3 runs). Sampled every
  // 16ms across the close, the list's frame shrinks first (686 to 663 high, the row at 376.7 with the
  // offset still 0), then the scroll view shifts the rows by the search bar's reserved padding
  // (offset 0 to 71.7, the row at 448.3), and nothing scrolls them back. Remove the expected-failure
  // mark once fixed.
  it('closing search leaves the list where it is', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.middle.token)
    const {t} = await expectCentred(ordinal)
    const before = rowOf(t, ordinal)!

    await closeSearch()
    const after = await waitForThreadStable()
    const v = await viewport(after)
    check(!isAtEnd(after, v), `the thread went to its end: ${summary(after, v)}`)
    await expectedFailure('closing search moves the rows', () => {
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

type Landing = {atEdge: boolean; i: number; travel?: number; what: string}

// Drags the thread in `step`-point steps until `done`. Each step's travel is read off a row in view
// before it that stays rendered; a step in which a page landed must travel as far as the steps in
// which none did, so a landing never moves what the reader sees. Dragging toward newer rows while a
// newer page is still to come, a drag that would reach the newest row loaded first waits a moment
// for the page (it loads once the reader is within ten rows), and drags on when none comes; a page
// that lands with the reader on that row is marked, as the flow for it is its own. Returns the
// landings, and which of them moved the reader.
const scrollThroughPages = async (step: number, done: (t: ThreadReading, v: Viewport) => boolean) => {
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
      landed.push({atEdge, i, travel, what})
    } else {
      check(travel !== undefined, `step ${i}: row ${anchor.ordinal} is no longer rendered: ${summary(t, v)}`)
      // the last step can stop short at the end of the thread, and one from the edge at the edge
      if (!done(t, v) && !atEdge) plain.push(travel!)
    }
  }
  check(done(t, v), `the scroll did not reach its end: ${summary(t, v)}`)
  check(plain.length >= 2, `only ${plain.length} steps loaded no page, too few to measure a drag's travel`)
  const usual = [...plain].sort((a, b) => a - b)[Math.floor(plain.length / 2)]!
  const moved = (l: Landing) => l.travel === undefined || Math.abs(l.travel - usual) > pagingTolerance
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

  it('dragging up loads older pages without moving the reader, back to the first message', async () => {
    await openLong()
    await expectAtEnd()
    // the first page's landing is the flow above
    await dragTravel(400)
    const {describe, landed, moved} = await scrollThroughPages(400, t => !t.moreToLoadBack && t.rows[0]!.top >= t.listTop - 1)
    check(landed.length >= 2, `only ${landed.length} pages landed`)
    check(!landed.some(moved), describe(landed.filter(moved)))
    await waitForRow(longMarker(1))
  })

  // Pages of newer rows landing sometimes throw the reader ahead (the app bug the next flow marks,
  // which reproduces it every time with the reader resting on the newest row loaded). Here it depends
  // on where each page lands, so about half the runs see it: rows wholly in view went from 181..201
  // to 298..318 in one drag as 225 rows loaded became 403 (Appium's element tree agreeing); in other
  // runs the reader's row left the rendered rows as 225 became 325 (390 points from the newest row
  // loaded) and as 325 became 403 (530 points from it). The landings that moved the reader are
  // logged, not failed; the flow holds the rest: pages keep loading until the present, and the
  // thread ends there.
  it('dragging down from an old hit loads newer pages until the present', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
    await expectCentred(ordinal)
    await closeSearch()
    await jumpToRecentButton().waitForExist({timeout: 5_000})

    const {describe, landed, moved} = await scrollThroughPages(-200, (t, v) => isAtEnd(t, v))
    check(landed.length >= 2, `only ${landed.length} pages landed`)
    const jumped = landed.filter(moved)
    console.log(
      `newer pages landed: ${landed.length}, ${landed.filter(l => l.atEdge).length} with the reader on the newest row loaded, ${jumped.length} moving the reader${jumped.length ? `:\n${describe(jumped)}` : ''}`
    )
    await waitForRow(longMarker(LONG_COUNT))
    await expectAtEnd()
    await jumpToRecentButton().waitForExist({reverse: true, timeout: 5_000})
  })

  // App bug (integration build, iOS): with the reader resting on the newest row of a window of
  // history, the page of newer rows that lands next carries the list to the new newest row: the
  // reader is thrown about 100 rows ahead. From the deep hit (rows 1..125 loaded), a status-bar tap
  // rests the list on row 125; the page 126..225 lands and the rows wholly in view read 205..225
  // (fiber reading, 2 of 2 tries). A drag that happens to end on that row does the same (rows in view
  // 181..201 -> 298..318 in one run, Appium's element tree agreeing). Remove the expected-failure
  // mark once fixed.
  it('resting on the newest row of a window of history, the next page leaves the reader where they are', async () => {
    await openLong()
    const ordinal = await searchAndSelect(LONG_SEARCH_TOKENS.deep.token)
    await expectCentred(ordinal)
    await closeSearch()
    const before = await waitForThreadStable()
    check(before.moreToLoadForward, `the hit's page holds the newest message: ${summary(before)}`)
    const newestLoaded = before.ordinals.at(-1)!
    await tapStatusBar()
    await waitFor(
      'the next page of newer rows',
      async () => ((await requireThread()).ordinals.length > before.ordinals.length ? true : undefined),
      {timeout: 15_000}
    )
    const after = await waitForThreadStable()
    const v = await viewport(after)
    await expectedFailure('a newer page carries a reader resting on the newest row with it', () => {
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

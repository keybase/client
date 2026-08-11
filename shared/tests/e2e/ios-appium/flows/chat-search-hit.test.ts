import type {ChainablePromiseElement} from 'webdriverio'
import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {anyExist, el, els, tab, waitForTestID, enterText} from '../helpers/elements'
import {dismissKeyboard, escapeToTabs} from '../helpers/navigate'
import * as T from '../../shared/test-ids'

// A word common enough to match throughout the thread, so hits span messages of different heights.
const QUERY = 'one'
// A word whose hit sits among the messages already on screen: jumping a few rows is the case where
// the list has nothing to load and the scroll lands against a content size that has not caught up.
const SAME_SCREEN_QUERY = 'working'
// Flings back through the thread until a page of older messages arrives.
const MAX_FLINGS = 20
// A row has to be visible by more than a hairline to count as landed on.
const MIN_VISIBLE_HEIGHT = 24
// How far the top of the thread has to jump away from the viewport to be a page of older messages
// arriving rather than the fling that provoked it.
const PREPEND_MIN_SHIFT = 600
// The thread is watched for this long after the drag, in samples, rather than looked at once at the
// end: a jump back to the hit can be brief.
const SNAP_BACK_SAMPLES = 8
const SNAP_BACK_SAMPLE_MS = 400

// iOS puts the conversation's header actions in a native overflow menu, so there is no React view
// to carry a testID - the bar button and its menu item are addressed by the accessibility labels
// the platform exposes, scoped to the navigation bar and the menu so they cannot match the "More"
// tab or the inbox's own search field. Other platforms render the search control directly.
const openThreadSearch = async () => {
  if (browser.isIOS) {
    const moreButton = browser.$('-ios class chain:**/XCUIElementTypeNavigationBar/**/XCUIElementTypeButton[`name == "More"`]')
    await moreButton.waitForExist({timeout: 5000, timeoutMsg: 'header overflow menu never appeared'})
    await moreButton.click()
    const searchItem = browser.$(
      '-ios predicate string:(type == "XCUIElementTypeMenuItem" OR type == "XCUIElementTypeButton") AND name == "Search"'
    )
    await searchItem.waitForExist({timeout: 5000, timeoutMsg: 'search menu item never appeared'})
    await searchItem.click()
    return
  }
  await waitForTestID(T.CHAT_HEADER_SEARCH_BUTTON, 5000)
  await el(T.CHAT_HEADER_SEARCH_BUTTON).click()
}

type Bounds = {height: number; width: number; x: number; y: number}

const boundsOfElement = async (element: ChainablePromiseElement): Promise<Bounds> => {
  const [location, size] = await Promise.all([element.getLocation(), element.getSize()])
  return {height: size.height, width: size.width, x: location.x, y: location.y}
}

const boundsOf = async (id: string): Promise<Bounds> => boundsOfElement(el(id))

// A row outside the render window is not in the accessibility tree at all, and that is an answer
// ("not on screen") rather than an error. Anything else - a dead session, a driver fault - is not,
// so only a missing element is swallowed here.
const maybeBoundsOf = async (element: ChainablePromiseElement): Promise<Bounds | undefined> => {
  if (!(await element.isExisting())) return undefined
  try {
    return await boundsOfElement(element)
  } catch (error) {
    if (/no such element|stale element|not found/i.test(String(error))) return undefined
    throw error
  }
}

// What the reader can actually see of the thread: the list's frame less the search bar, which
// overlays the bottom of it rather than shrinking it.
const visibleThreadBounds = async (): Promise<Bounds> => {
  const list = await boundsOf(T.CHAT_MESSAGE_LIST)
  const bar = await maybeBoundsOf(el(T.CHAT_THREAD_SEARCH_CANCEL))
  if (!bar) return list
  return {...list, height: Math.max(0, bar.y - list.y)}
}

const visibleHeight = (thing: Bounds, viewport: Bounds): number =>
  Math.min(thing.y + thing.height, viewport.y + viewport.height) - Math.max(thing.y, viewport.y)

// The row keeps its marker while it is the selected hit, but a virtualised list renders rows
// outside the viewport too - so the marker existing says nothing about whether it can be seen.
// Compare where the row is against where the thread is, and require more than a sliver.
const hitOnScreen = async (): Promise<Bounds | undefined> => {
  const hit = await maybeBoundsOf(el(T.CHAT_SEARCH_HIT))
  if (!hit) return undefined
  const viewport = await visibleThreadBounds()
  return visibleHeight(hit, viewport) >= Math.min(hit.height, MIN_VISIBLE_HEIGHT) ? hit : undefined
}

const describeHit = async (): Promise<string> => {
  const hit = await maybeBoundsOf(el(T.CHAT_SEARCH_HIT))
  const viewport = await visibleThreadBounds()
  if (!hit) return `no highlighted row is rendered; thread ${viewport.y}..${viewport.y + viewport.height}`
  return `row ${hit.y}..${hit.y + hit.height}, thread ${viewport.y}..${viewport.y + viewport.height}`
}

// The header above the oldest loaded message. It stays mounted while off screen, so its position is
// readable throughout - and a page-in is visible in that position directly: a fling moves it toward
// the viewport, while a prepend pushes it a page's worth further away.
const topOfThreadPosition = async (): Promise<number | undefined> => (await maybeBoundsOf(el(T.CHAT_THREAD_TOP)))?.y

// "3 of 18" in the search bar. The count is what makes the wrap-around case honest: stepping a
// fixed number of times proves nothing if the thread happens to have more hits than that.
const readHitCount = async (): Promise<number> => {
  const bar = browser.$('-ios predicate string:name CONTAINS " of "')
  if (browser.isAndroid) {
    const label = await browser.$('//*[contains(@text, " of ")]').getText().catch(() => '')
    return Number(/of (\d+)/.exec(label)?.[1] ?? 0)
  }
  const label = await bar.getAttribute('name').catch(() => '')
  return Number(/of (\d+)/.exec(label ?? '')?.[1] ?? 0)
}

const startSearch = async (query: string): Promise<number> => {
  await openThreadSearch()
  await waitForTestID(T.CHAT_THREAD_SEARCH_INPUT, 5000)
  // The field focuses itself a beat after mounting, so type into it rather than sending keys at
  // whatever happens to be focused. enterText also pastes where per-key injection is unsafe.
  await enterText(T.CHAT_THREAD_SEARCH_INPUT, query)
  await browser.keys(['\n'])

  // Results stream in from the server; the first hit is selected once they arrive.
  await waitForTestID(T.CHAT_SEARCH_HIT, 15000)
  const landed = await browser
    .waitUntil(async () => (await hitOnScreen()) !== undefined, {timeout: 5000})
    .then(() => true)
    .catch(() => false)
  if (!landed) throw new Error(`the first hit never came on screen: ${await describeHit()}`)
  const hits = await readHitCount()
  if (hits === 0) throw new Error(`"${query}" found no hits in this conversation`)
  return hits
}

const stepThroughHits = async (steps: number) => {
  for (let step = 0; step < steps; step++) {
    await el(T.CHAT_THREAD_SEARCH_PREV).click()

    // Give the jump, and the measurements that follow it, time to land.
    const landed = await browser
      .waitUntil(async () => (await hitOnScreen()) !== undefined, {timeout: 5000})
      .then(() => true)
      .catch(() => false)
    if (!landed) throw new Error(`hit ${step + 1} never came on screen: ${await describeHit()}`)
    // A hit that lands and then drifts off screen is the other half of what this watches for.
    await browser.pause(700)
    if (!(await hitOnScreen())) {
      throw new Error(`hit ${step + 1} landed and then drifted off screen: ${await describeHit()}`)
    }
  }
}

const closeThreadSearch = async () => {
  await el(T.CHAT_THREAD_SEARCH_CANCEL).click()
  await browser.pause(500)
}

// Gestures are measured from the thread itself: on a tablet the inbox sits beside it, so a fixed x
// would scroll the wrong list, and the search bar and keyboard cover part of the thread's frame.
const gesturePoints = async (distance: number) => {
  const viewport = await visibleThreadBounds()
  const x = Math.round(viewport.x + viewport.width / 2)
  const middle = viewport.y + viewport.height / 2
  const half = Math.min(distance, viewport.height - 80) / 2
  return {from: Math.round(middle - half), to: Math.round(middle + half), x}
}

// A fast flick that coasts - used only to travel back through the thread, never to establish the
// position an assertion depends on.
const flingThread = async () => {
  const {from, to, x} = await gesturePoints(420)
  await browser.action('pointer').move({x, y: from}).down().move({duration: 120, x, y: to}).up().perform()
}

// A drag that ends where it is left rather than coasting.
const dragThread = async () => {
  const {from, to, x} = await gesturePoints(200)
  await browser
    .action('pointer')
    .move({x, y: from})
    .down()
    .pause(100)
    .move({duration: 400, x, y: to})
    .pause(100)
    .up()
    .perform()
}

// Each test starts from the tab root: the suite returns there between tests, so a flow cannot
// assume the conversation another one left open. The conversation needs enough history to page in
// and enough matches for both queries, which is the smoke account's own chat with itself.
const openFirstConversation = async (): Promise<boolean> => {
  await escapeToTabs()
  await tab('Teams').click()
  await tab('Chat').click()
  await waitForTestID(T.CHAT_INBOX_LIST, 5000)

  if (!(await anyExist(T.CHAT_INBOX_ROW))) return false
  await els(T.CHAT_INBOX_ROW)[0]!.click()
  await waitForTestID(T.CHAT_MESSAGE_LIST, 5000)
  await dismissKeyboard()
  return true
}

describe('chat thread search', () => {
  it('keeps every hit it lands on visible, including wrapping around', async () => {
    requireSmokeUser()
    if (!(await openFirstConversation())) throw new Error('no conversations in the inbox')

    // Two past the end, so the search wraps and lands on hits it has already visited from a
    // different scroll position - the case that used to leave the hit off screen.
    const hits = await startSearch(QUERY)
    await stepThroughHits(hits + 2)
    await closeThreadSearch()
  })

  it('lands on a hit that is already on screen', async () => {
    requireSmokeUser()
    if (!(await openFirstConversation())) throw new Error('no conversations in the inbox')

    // No native mutation has been found that makes this case fail on its own - it is here because
    // it is the case people report on desktop, where it does fail. Treat a green here as coverage
    // of the flow, not proof of the fix.
    await startSearch(SAME_SCREEN_QUERY)
    await stepThroughHits(1)
    await closeThreadSearch()
  })

  it('leaves the thread where the user drags it after a hit', async () => {
    requireSmokeUser()
    if (!(await openFirstConversation())) throw new Error('no conversations in the inbox')
    await startSearch(SAME_SCREEN_QUERY)

    // A moment after landing is when the list is still measuring, and where anything holding the
    // scroll target used to pull the thread back out from under the user.
    await browser.pause(1000)
    expect(await hitOnScreen()).toBeDefined()

    // Travel back toward older messages until a page of them actually arrives. The page-in is the
    // point: the prepend shifts every row's index, and an index-keyed re-centre reads that as a new
    // target and yanks the thread back to the hit.
    let previousTop = await topOfThreadPosition()
    let pagedIn = false
    for (let fling = 0; fling < MAX_FLINGS && !pagedIn; fling++) {
      await flingThread()
      await browser.pause(200)
      const top = await topOfThreadPosition()
      // A fling moves the top of the thread toward the viewport; only a prepend moves it away, and
      // by a page's worth rather than a gesture's.
      if (top !== undefined && previousTop !== undefined && top < previousTop - PREPEND_MIN_SHIFT) {
        console.log(`page-in: top of thread moved ${previousTop} -> ${top}`)
        pagedIn = true
      }
      previousTop = top ?? previousTop
    }
    // Not provoking a page-in proves nothing about snapping back, so fail instead of passing.
    if (!pagedIn) throw new Error('flinging never loaded another page of older messages')

    // End on a controlled drag so the thread rests where the user left it rather than coasting.
    await dragThread()
    await browser.pause(400)
    if (await hitOnScreen()) throw new Error(`the hit never left the viewport: ${await describeHit()}`)

    // Watch rather than look once. A re-centre lands at whatever moment the page finishes settling,
    // and it does not necessarily stay: sampling only at the end lets a thread that jumped back and
    // was then dragged on by momentum read as if nothing happened.
    let snappedBack: Bounds | undefined
    for (let sample = 0; sample < SNAP_BACK_SAMPLES && !snappedBack; sample++) {
      await browser.pause(SNAP_BACK_SAMPLE_MS)
      snappedBack = await hitOnScreen()
    }
    if (snappedBack) {
      console.log(`thread snapped back to the hit: row at ${snappedBack.y} after being dragged away`)
    }
    expect(snappedBack).toBeUndefined()

    await closeThreadSearch()
  })
})

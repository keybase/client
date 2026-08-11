import type {ChainablePromiseElement} from 'webdriverio'
import {expect} from '@wdio/globals'
import {anyExist, byText, el, els, tab, waitForTestID} from '../helpers/elements'
import {escapeToTabs} from '../helpers/navigate'
import * as T from '../../shared/test-ids'

// More steps than the thread has hits, so the search wraps around and lands on hits it has already
// visited from a different scroll position - a case that used to leave the hit off screen.
const WRAPPING_STEPS = 20
// A word common enough to match throughout the thread, so hits span messages of different heights.
const QUERY = 'one'
// A word whose hit sits among the messages already on screen: jumping a few rows is the case where
// the list has nothing to load and the scroll lands against a content size that has not caught up.
const SAME_SCREEN_QUERY = 'working'
// Flings back through the thread until the top of the loaded page is on screen.
const MAX_FLINGS = 20
const FLING_DISTANCE = 420
// A fling moves the top-of-thread marker toward the viewport; only a prepend moves it away, and by
// far more than a fling's worth.
const PREPEND_MIN_SHIFT = 600

// iOS 26 puts the conversation's header actions in a native overflow menu (one glass pill), so
// there is no React view to carry a testID - the bar button and its menu item are addressed by the
// accessibility labels the platform exposes. Other platforms render the search control directly.
const openThreadSearch = async () => {
  if (browser.isIOS) {
    await browser.$('~More').waitForExist({timeout: 5000, timeoutMsg: 'header overflow menu never appeared'})
    await browser.$('~More').click()
    await browser.$('~Search').waitForExist({timeout: 5000, timeoutMsg: 'search menu item never appeared'})
    await browser.$('~Search').click()
    return
  }
  await waitForTestID(T.CHAT_HEADER_SEARCH_BUTTON, 5000)
  await el(T.CHAT_HEADER_SEARCH_BUTTON).click()
}

type Bounds = {height: number; y: number}

const boundsOfElement = async (element: ChainablePromiseElement): Promise<Bounds> => {
  const [location, size] = await Promise.all([element.getLocation(), element.getSize()])
  return {height: size.height, y: location.y}
}

const boundsOf = async (id: string): Promise<Bounds> => boundsOfElement(el(id))

// Off-screen rows are pruned from the accessibility tree, so a missing element is a real answer
// ("not on screen"), not an error - the caller decides what that means.
const maybeBoundsOf = async (element: ChainablePromiseElement): Promise<Bounds | undefined> => {
  if (!(await element.isExisting().catch(() => false))) return undefined
  return boundsOfElement(element).catch(() => undefined)
}

const overlapsViewport = (thing: Bounds, list: Bounds): boolean =>
  Math.min(thing.y + thing.height, list.y + list.height) - Math.max(thing.y, list.y) > 0

// The row keeps its marker while it is the selected hit, but a virtualised list renders rows
// outside the viewport too - so the marker existing says nothing about whether it can be seen.
// Compare where the row is against where the list is.
const hitOverlapsViewport = async (): Promise<boolean> => {
  const [hit, list] = await Promise.all([boundsOf(T.CHAT_SEARCH_HIT), boundsOf(T.CHAT_MESSAGE_LIST)])
  const overlaps = overlapsViewport(hit, list)
  if (!overlaps) {
    console.log(`hit off screen: row ${hit.y}..${hit.y + hit.height}, list ${list.y}..${list.y + list.height}`)
  }
  return overlaps
}

// The selected hit once the thread has been dragged away from it: undefined when the row has left
// the viewport entirely, which is the state the drag is meant to produce.
const hitIfOnScreen = async (): Promise<Bounds | undefined> => {
  const hit = await maybeBoundsOf(el(T.CHAT_SEARCH_HIT))
  if (!hit) return undefined
  const list = await boundsOf(T.CHAT_MESSAGE_LIST)
  return overlapsViewport(hit, list) ? hit : undefined
}

// The thread's top-of-loaded-window marker. It stays in the render window while off screen, so its
// position is readable throughout - and a page-in is visible in that position directly: a fling
// moves the marker back toward the viewport, while a prepend pushes it thousands of pixels away.
const loadingOlderPosition = async (): Promise<number | undefined> =>
  (await maybeBoundsOf(byText('Digging ancient')))?.y

const runSearch = async (query: string, steps: number) => {
  await openThreadSearch()
  await waitForTestID(T.CHAT_THREAD_SEARCH_NEXT, 5000)
  // The search bar focuses itself on mount, so the query goes straight to the keyboard.
  await browser.keys(query.split(''))
  await browser.keys(['\n'])

  // Results stream in from the server; the first hit is selected once they arrive.
  await waitForTestID(T.CHAT_SEARCH_HIT, 15000)
  await browser.pause(1200)
  expect(await hitOverlapsViewport()).toBe(true)

  for (let step = 0; step < steps; step++) {
    await el(T.CHAT_THREAD_SEARCH_PREV).click()

    // Give the jump, and the measurements that follow it, time to settle before looking. A hit that
    // lands and then drifts off screen is exactly the failure this is watching for.
    await browser.pause(1200)

    await expect(el(T.CHAT_SEARCH_HIT)).toExist()
    expect(await hitOverlapsViewport()).toBe(true)
  }
}

const closeThreadSearch = async () => {
  await el(T.CHAT_THREAD_SEARCH_CANCEL).click()
  await browser.pause(500)
}

// A fast flick that coasts - used only to travel back through the thread, never to establish the
// position the assertion depends on.
const flingThread = async (distance: number) => {
  const list = await boundsOf(T.CHAT_MESSAGE_LIST)
  const midY = Math.round(list.y + list.height / 2)
  await browser
    .action('pointer')
    .move({x: 200, y: midY - distance / 2})
    .down()
    .move({duration: 120, x: 200, y: midY + distance / 2})
    .up()
    .perform()
}

// Drag the thread without lifting into a fling, so it ends where it was left rather than coasting.
const dragThread = async (distance: number) => {
  const list = await boundsOf(T.CHAT_MESSAGE_LIST)
  const midY = Math.round(list.y + list.height / 2)
  await browser
    .action('pointer')
    .move({x: 200, y: midY})
    .down()
    .pause(100)
    .move({duration: 400, x: 200, y: midY + distance})
    .pause(100)
    .up()
    .perform()
}

// Each test starts from the tab root: the suite returns there between tests, so a flow cannot
// assume the conversation another one left open.
const openFirstConversation = async (): Promise<boolean> => {
  await escapeToTabs()
  await tab('Teams').click()
  await tab('Chat').click()
  await waitForTestID(T.CHAT_INBOX_LIST, 5000)

  if (!(await anyExist(T.CHAT_INBOX_ROW))) return false
  await els(T.CHAT_INBOX_ROW)[0]!.click()
  await waitForTestID(T.CHAT_MESSAGE_LIST, 5000)
  return true
}

describe('chat thread search', () => {
  it('keeps every hit it lands on visible, including wrapping around', async () => {
    if (!(await openFirstConversation())) return

    await runSearch(QUERY, WRAPPING_STEPS)
    await closeThreadSearch()
  })

  it('lands on a hit that is already on screen', async () => {
    if (!(await openFirstConversation())) return
    await runSearch(SAME_SCREEN_QUERY, 1)
    await closeThreadSearch()
  })

  it('leaves the thread where the user drags it after a hit', async () => {
    if (!(await openFirstConversation())) return
    await runSearch(SAME_SCREEN_QUERY, 0)

    // A moment after landing is when the list is still measuring, and where anything holding the
    // scroll target used to pull the thread back out from under the user.
    await browser.pause(1000)
    expect(await hitIfOnScreen()).toBeDefined()

    // Travel back toward older messages until a page of them actually arrives. The page-in is the
    // point: the prepend shifts every row's index, and an index-keyed re-centre reads that as a new
    // target and yanks the thread back to the hit.
    let previousMarker = await loadingOlderPosition()
    let pagedIn = false
    for (let fling = 0; fling < MAX_FLINGS && !pagedIn; fling++) {
      await flingThread(FLING_DISTANCE)
      await browser.pause(200)
      const marker = await loadingOlderPosition()
      if (marker !== undefined && previousMarker !== undefined && marker < previousMarker - PREPEND_MIN_SHIFT) {
        console.log(`page-in: top-of-thread marker moved ${previousMarker} -> ${marker}`)
        pagedIn = true
      }
      previousMarker = marker
    }
    // Not provoking a page-in proves nothing about snapping back, so fail instead of passing.
    if (!pagedIn) throw new Error('dragging never loaded another page of older messages')

    // End on a controlled drag so the thread rests where the user left it rather than coasting.
    await dragThread(200)
    await browser.pause(400)
    if (await hitIfOnScreen()) throw new Error('the hit never left the viewport')

    // Long enough for the page to arrive, prepend, and for the list to finish measuring it.
    await browser.pause(2500)

    const snappedBack = await hitIfOnScreen()
    if (snappedBack) {
      console.log(`thread snapped back to the hit: row at ${snappedBack.y} after being dragged away`)
    }
    expect(snappedBack).toBeUndefined()

    await closeThreadSearch()
  })
})

import {expect} from '@wdio/globals'
import {anyExist, el, els, tab, waitForTestID} from '../helpers/elements'
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

const boundsOf = async (id: string) => {
  const element = el(id)
  const [location, size] = await Promise.all([element.getLocation(), element.getSize()])
  return {height: size.height, y: location.y}
}

// The row keeps its marker while it is the selected hit, but a virtualised list renders rows
// outside the viewport too - so the marker existing says nothing about whether it can be seen.
// Compare where the row is against where the list is.
const hitOverlapsViewport = async (): Promise<boolean> => {
  const [hit, list] = await Promise.all([boundsOf(T.CHAT_SEARCH_HIT), boundsOf(T.CHAT_MESSAGE_LIST)])
  const overlap = Math.min(hit.y + hit.height, list.y + list.height) - Math.max(hit.y, list.y)
  if (overlap <= 0) {
    console.log(`hit off screen: row ${hit.y}..${hit.y + hit.height}, list ${list.y}..${list.y + list.height}`)
  }
  return overlap > 0
}

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
    const beforeDrag = await boundsOf(T.CHAT_SEARCH_HIT)
    // Several drags toward older messages, which is what asks the thread to page more in. The
    // prepend that follows shifts every row's index, and that is what used to re-centre the list
    // out from under the reader.
    for (let drag = 0; drag < 3; drag++) {
      await dragThread(260)
      await browser.pause(250)
    }
    await browser.pause(300)
    const afterDrag = await boundsOf(T.CHAT_SEARCH_HIT)

    // The drag has to have actually moved the thread, or the rest of this proves nothing.
    expect(Math.abs(afterDrag.y - beforeDrag.y)).toBeGreaterThan(40)

    await browser.pause(1500)
    const settled = await boundsOf(T.CHAT_SEARCH_HIT)
    if (Math.abs(settled.y - afterDrag.y) > 30) {
      console.log(`thread snapped back: row was at ${afterDrag.y} after the drag, ${settled.y} a moment later`)
    }
    expect(Math.abs(settled.y - afterDrag.y)).toBeLessThanOrEqual(30)

    await closeThreadSearch()
  })
})

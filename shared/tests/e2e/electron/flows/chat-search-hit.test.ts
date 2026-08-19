import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

// Searching a thread has to land on the hit, and then leave the thread alone. Both were manual
// checks until now: the list was landing with the hit far below the viewport, and after that was
// fixed a thread the reader had scrolled away from could still pull itself back.
//
// One test rather than two, because the second half depends on the state the first leaves: the
// search bar is open and a hit is selected, and re-entering that from scratch would just be the
// first half again.
// A row has to be visible by more than a hairline to count as landed on, matching the iOS flow.
const MIN_VISIBLE_HEIGHT = 24

test('lands on every search hit, then stays where the reader scrolls it', async ({page}) => {
  test.setTimeout(120_000)
  // Named, not "whichever row is first". The inbox is ordered by recency and the suites send
  // messages of their own, so the first row is a different conversation from one run to the next —
  // and with it the hit count and which words match at all.
  const smokeUser = process.env['KB_SMOKE_USER']
  expect(smokeUser, 'KB_SMOKE_USER is not set').toBeTruthy()
  await navigateToChat(page)
  const row = page
    .getByTestId(T.CHAT_INBOX_ROW)
    .filter({hasText: smokeUser!})
    .first()
  await row.click({timeout: 10_000})
  await page.waitForSelector(`[data-testid="${T.CHAT_MESSAGE_LIST}"]`, {timeout: 5_000})

  // force: the conversation header sits in the window's WebkitAppRegion drag region, which makes
  // playwright's actionability check wait forever on a control that is perfectly clickable.
  await page.getByTestId(T.CHAT_HEADER_SEARCH_BUTTON).first().click({force: true})
  await page.waitForTimeout(1_000)
  // A word common enough to hit repeatedly in any conversation with history.
  await page.keyboard.type('the')
  await page.waitForTimeout(4_000)

  // Enter steps to the next hit, wrapping around at the end — which is the case that used to land
  // off screen, since wrapping jumps the furthest.
  let checked = 0
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
    const hit = await page
      .getByTestId(T.CHAT_SEARCH_HIT)
      .first()
      .boundingBox({timeout: 3_000})
      .catch(() => null)
    const list = await page.getByTestId(T.CHAT_MESSAGE_LIST).first().boundingBox()
    if (!hit || !list) continue
    checked++
    // By more than a hairline: a row overlapping the viewport by a pixel has not "landed on the
    // hit", and the iOS flow holds the same line.
    const visibleHeight = Math.min(hit.y + hit.height, list.y + list.height) - Math.max(hit.y, list.y)
    const onScreen = visibleHeight >= Math.min(hit.height, MIN_VISIBLE_HEIGHT)
    expect(
      onScreen,
      `step ${i}: hit at y=${Math.round(hit.y)} h=${Math.round(hit.height)} is outside the list (y=${Math.round(list.y)} h=${Math.round(list.height)})`
    ).toBe(true)
  }
  // Without this the loop above passes by never measuring anything.
  expect(checked, 'no hit was ever measurable, so nothing was checked').toBeGreaterThan(0)

  const listBox = await page.getByTestId(T.CHAT_MESSAGE_LIST).first().boundingBox()
  expect(listBox).not.toBeNull()
  await page.mouse.move(listBox!.x + listBox!.width / 2, listBox!.y + listBox!.height / 2)
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, -600)
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(1_500)

  const readHit = async () =>
    page
      .getByTestId(T.CHAT_SEARCH_HIT)
      .first()
      .boundingBox({timeout: 3_000})
      .catch(() => null)

  // Watch rather than look once: a re-centre lands whenever the rows scrolled past finish
  // measuring, which is after the gesture rather than during it.
  // The row is often scrolled clean out of the render window, so its position is not always
  // readable. The top of the thread is, in every state — without a second reading like it, both
  // branches below can be skipped and this half of the test asserts nothing at all.
  const readThreadTop = async () =>
    page
      .getByTestId(T.CHAT_THREAD_TOP)
      .first()
      .boundingBox({timeout: 3_000})
      .then(b => (b ? b.y : null))
      .catch(() => null)

  const settled = await readHit()
  const settledTop = await readThreadTop()
  await page.waitForTimeout(3_000)
  const after = await readHit()
  const afterTop = await readThreadTop()

  if (settled && after) {
    const moved = Math.abs(after.y - settled.y)
    expect(moved, `the thread scrolled itself ${Math.round(moved)}px back toward the hit`).toBeLessThanOrEqual(8)
  } else if (!settled && after) {
    // Scrolled far enough to unmount the row, and then it came back — which only a scroll does.
    throw new Error('the hit came back into the render window after being scrolled away from')
  } else if (settledTop !== null && afterTop !== null) {
    const moved = Math.abs(afterTop - settledTop)
    expect(moved, `the thread moved ${Math.round(moved)}px on its own after the drag`).toBeLessThanOrEqual(8)
  } else {
    throw new Error('neither the hit nor the top of the thread could be measured, so nothing was checked')
  }
})

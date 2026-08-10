import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'
import * as T from '@/tests/e2e/shared/test-ids'

// Typography and Markdown are the __DEV__-only debug pages. They are long
// scrolling catalogs, so each page gets one test PER SCREENFUL: the report
// builds one card per test, so a single test could only ever show one shot.
// Screens overlap by 10% so nothing falls in a seam between two cards.
const OVERLAP = 0.9

// Screenful counts are upper bounds — a test whose offset is past the bottom
// skips itself, so these can stay ahead of the pages growing.
const MARKDOWN_SCREENS = 10
const TYPOGRAPHY_SCREENS = 16

async function openDebugPage(page: Page, label: string, marker: string): Promise<void> {
  await navigateToSettings(page)
  const item = page.getByTestId(T.SETTINGS_ACCOUNT).locator(`text=${label}`)
  if ((await item.count()) === 0) {
    // production build — the nav entry is gated by __DEV__
    test.skip()
    return
  }
  await item.click()
  await expect(page.getByTestId(marker)).toBeVisible({timeout: 5_000})
}

// Scrolls the container to screenful `index`. Returns false when that offset is
// past the bottom (fewer screenfuls of content than the constant above).
async function scrollToScreen(page: Page, marker: string, index: number): Promise<boolean> {
  const scroller = page.getByTestId(marker)
  // structural type, not HTMLElement: tsconfig.native has no 'dom' lib
  type Scrollable = {scrollHeight: number; clientHeight: number; scrollTop: number}
  const fits = await scroller.evaluate((node, args: {index: number; overlap: number}) => {
    const div = node as unknown as Scrollable
    const max = div.scrollHeight - div.clientHeight
    const step = div.clientHeight * args.overlap
    // Skip only once the PREVIOUS window already showed the end of the content.
    // Skipping on `top > max` instead would drop the tail: the last unskipped
    // window stops short of the bottom whenever max isn't a whole step.
    if (args.index > 0 && step * (args.index - 1) + div.clientHeight >= div.scrollHeight - 1) return false
    div.scrollTop = Math.min(step * args.index, max)
    return true
  }, {index, overlap: OVERLAP})
  if (!fits) return false
  // let images/fonts settle at the new offset
  await page.waitForTimeout(300)
  return true
}

for (let i = 0; i < MARKDOWN_SCREENS; i++) {
  test(`markdown debug page screen ${i + 1}`, async ({page}, testInfo) => {
    await openDebugPage(page, 'Markdown', T.SETTINGS_MARKDOWN)
    if (!(await scrollToScreen(page, T.SETTINGS_MARKDOWN, i))) {
      test.skip()
      return
    }
    await snap(page, testInfo)
  })
}

for (let i = 0; i < TYPOGRAPHY_SCREENS; i++) {
  test(`typography debug page screen ${i + 1}`, async ({page}, testInfo) => {
    await openDebugPage(page, 'Typography', T.SETTINGS_TYPOGRAPHY)
    if (!(await scrollToScreen(page, T.SETTINGS_TYPOGRAPHY, i))) {
      test.skip()
      return
    }
    await snap(page, testInfo)
  })
}

// The typography page's controls change what every sample row below renders;
// capture the non-default states too. Each of these RESTORES the default after
// snapping: re-selecting the page in the left nav doesn't remount it, so a
// left-on toggle would leak into every later screenful shot.
test('typography debug page dark background', async ({page}, testInfo) => {
  await openDebugPage(page, 'Typography', T.SETTINGS_TYPOGRAPHY)
  // .first(): the control row sits above the sample sections, which repeat these
  // same words (the Markdown section literally renders "strikethrough").
  const dark = page.getByTestId(T.SETTINGS_TYPOGRAPHY).getByText('Dark', {exact: true}).first()
  await dark.click()
  await page.waitForTimeout(300)
  await snap(page, testInfo)
  await dark.click()
})

test('typography debug page underline decoration', async ({page}, testInfo) => {
  await openDebugPage(page, 'Typography', T.SETTINGS_TYPOGRAPHY)
  const controls = page.getByTestId(T.SETTINGS_TYPOGRAPHY)
  await controls.getByText('underline', {exact: true}).first().click()
  await page.waitForTimeout(300)
  await snap(page, testInfo)
  await controls.getByText('strikethrough', {exact: true}).first().click()
})

test('typography debug page next sample', async ({page}, testInfo) => {
  await openDebugPage(page, 'Typography', T.SETTINGS_TYPOGRAPHY)
  const next = page.getByTestId(T.SETTINGS_TYPOGRAPHY).getByText('Next', {exact: true}).first()
  await next.click()
  await page.waitForTimeout(300)
  await snap(page, testInfo)
  // sampleIdx only counts up — cycle through the remaining 4 strings to land
  // back on the default sample.
  for (let i = 0; i < 4; i++) await next.click()
})

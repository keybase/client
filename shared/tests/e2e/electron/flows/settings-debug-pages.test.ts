import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import * as T from '@/tests/e2e/shared/test-ids'

// Typography and Markdown are the __DEV__-only debug pages. They are long
// scrolling catalogs, so each page gets one test PER SCREENFUL: the report
// builds one card per test, so a single test could only ever show one shot.
// Screens overlap by 10% so nothing falls in a seam between two cards.
const OVERLAP = 0.9

// Screenfuls of each page at the gate's window size. Every case checks the page still has exactly
// this many, so a page that grows or shrinks fails and names the count to set.
const MARKDOWN_SCREENS = 8
const TYPOGRAPHY_SCREENS = 5

async function openDebugPage(page: Page, label: string, marker: string): Promise<void> {
  await navigateToSettings(page)
  // the nav entry is gated by __DEV__, and the gate runs a dev build
  const item = page.getByTestId(T.SETTINGS_ACCOUNT).locator(`text=${label}`).first()
  await expect(item, `the ${label} debug page's nav entry`).toBeVisible({timeout: 5_000})
  await item.click()
  await expect(page.getByTestId(marker)).toBeVisible({timeout: 5_000})
}

// structural type, not HTMLElement: tsconfig.native has no 'dom' lib
type Scrollable = {scrollHeight: number; clientHeight: number; scrollTop: number}

// How many screenfuls the page takes: the last one is the first whose window reaches the end.
async function screenCount(page: Page, marker: string): Promise<number> {
  return page.getByTestId(marker).evaluate((node, overlap: number) => {
    const div = node as unknown as Scrollable
    const step = div.clientHeight * overlap
    let n = 1
    while (step * (n - 1) + div.clientHeight < div.scrollHeight - 1) n++
    return n
  }, OVERLAP)
}

// Scrolls the container to screenful `index` (the last one is pinned to the bottom).
async function scrollToScreen(page: Page, marker: string, index: number): Promise<void> {
  await page.getByTestId(marker).evaluate((node, args: {index: number; overlap: number}) => {
    const div = node as unknown as Scrollable
    div.scrollTop = Math.min(div.clientHeight * args.overlap * args.index, div.scrollHeight - div.clientHeight)
  }, {index, overlap: OVERLAP})
  // let images/fonts settle at the new offset
  await page.waitForTimeout(300)
}

const screenTests = (name: string, label: string, marker: string, screens: number, constName: string) => {
  for (let i = 0; i < screens; i++) {
    test(`${name} debug page screen ${i + 1}`, async ({page}, testInfo) => {
      await openDebugPage(page, label, marker)
      expect(await screenCount(page, marker), `screenfuls of the ${label} page: set ${constName} to it`).toBe(screens)
      await scrollToScreen(page, marker, i)
      await step(page, testInfo, `${name} debug page screen ${i + 1}`)
    })
  }
}

screenTests('markdown', 'Markdown', T.SETTINGS_MARKDOWN, MARKDOWN_SCREENS, 'MARKDOWN_SCREENS')
screenTests('typography', 'Typography', T.SETTINGS_TYPOGRAPHY, TYPOGRAPHY_SCREENS, 'TYPOGRAPHY_SCREENS')

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
  await step(page, testInfo, 'typography dark background')
  await dark.click()
})

test('typography debug page underline decoration', async ({page}, testInfo) => {
  await openDebugPage(page, 'Typography', T.SETTINGS_TYPOGRAPHY)
  const controls = page.getByTestId(T.SETTINGS_TYPOGRAPHY)
  await controls.getByText('underline', {exact: true}).first().click()
  await page.waitForTimeout(300)
  await step(page, testInfo, 'typography underline decoration')
  await controls.getByText('strikethrough', {exact: true}).first().click()
})

test('typography debug page next sample', async ({page}, testInfo) => {
  await openDebugPage(page, 'Typography', T.SETTINGS_TYPOGRAPHY)
  const next = page.getByTestId(T.SETTINGS_TYPOGRAPHY).getByText('Next', {exact: true}).first()
  await next.click()
  await page.waitForTimeout(300)
  await step(page, testInfo, 'typography next sample')
  // sampleIdx only counts up — cycle through the remaining 4 strings to land
  // back on the default sample.
  for (let i = 0; i < 4; i++) await next.click()
})

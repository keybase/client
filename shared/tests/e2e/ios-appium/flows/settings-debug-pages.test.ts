import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, scrollDownToText, tapSettingsRow} from '../helpers/navigate'
import {el, byText, waitForTestID} from '../helpers/elements'
import {skipArtifact} from '../helpers/artifact'
import * as T from '../../shared/test-ids'

// Typography and Markdown are the __DEV__-only debug pages: long scrolling
// catalogs. The harness screenshots AFTER each test, so covering a whole page
// means one test per screenful — each opens the page and scrolls to its own
// offset, ending on the state it wants shot.

// Upper bounds. A test whose predecessor already reached the bottom skips
// itself, so these can stay ahead of the pages growing without piling up
// duplicate shots of the last screen.
const MARKDOWN_SCREENS = 8
const TYPOGRAPHY_SCREENS = 8

// Text on the final screenful of each page — the bottom sentinel.
const MARKDOWN_END = 'english control'
const TYPOGRAPHY_END = 'italic bold italic italic'

// Text on the first screenful — the top sentinel scrollToTop rewinds to.
const MARKDOWN_TOP = 'Inline'
const TYPOGRAPHY_TOP = 'Background'

// First entry is the page's default sample — the reset below cycles back to it.
const sampleStrings = [
  'Hamburgefontsiv',
  'Hxpxgy',
  '0123456789',
  'gjpqy ÁÉÍÓÚ ÅÄÖ',
  'The quick brown fox',
] as const

// EXACT-label control, unlike byText's CONTAINS: the decoration buttons are
// 'underline' and 'underline+strikethrough', and the section headers repeat the
// same words, so a contains-match picks the wrong element.
const control = (label: string) =>
  browser.isAndroid
    ? browser.$(`//*[@text="${label}" or @content-desc="${label}"]`)
    : browser.$(`-ios predicate string:label == "${label}" OR name == "${label}"`)

// Scroll the debug page's own content column.
//
// Two traps here. The shared scrollDownToText/scrollToTestID helpers swipe at
// x=15% of the window — that column is the tablet settings LeftNav, so on these
// pages they scroll the nav while the content sits still. And driving the
// ScrollView with `mobile: scroll` press-drags, which on these pages (every
// sample is selectable={true}) summons the copy/Select-All edit menu instead of
// scrolling. A slow drag at the content column does neither.
const CONTENT_X = 0.7
// One drag per step, covering ~2/3 of the screen: enough overlap that nothing
// lands in a seam, while keeping the swipe count (which grows with the screen
// index) low enough that the last tests don't crawl.
const SWIPES_PER_SCREEN = 1
const FROM_Y = 0.85
const TO_Y = 0.18
// A fast swipe flicks: momentum carries the list several screens past where the
// finger stopped, so screen 3 already showed the end of the page. Dragging
// slowly and holding still before lift kills the momentum, making one swipe
// worth its own travel (~45% of the screen) and nothing more.
const DRAG_MS = 600
const HOLD_MS = 250

async function swipeContent(direction: 'up' | 'down', times: number): Promise<void> {
  if (times <= 0) return
  const {width, height} = await browser.getWindowRect()
  const x = Math.round(width * CONTENT_X)
  // 'up' = finger up = content moves toward its end.
  const from = Math.round(height * (direction === 'up' ? FROM_Y : TO_Y))
  const to = Math.round(height * (direction === 'up' ? TO_Y : FROM_Y))
  for (let i = 0; i < times; i++) {
    await browser
      .action('pointer')
      .move({x, y: from})
      .down()
      .move({duration: DRAG_MS, x, y: to})
      .pause(HOLD_MS)
      .up()
      .perform()
  }
}

// Rewind to the top of the page. Phones pop these pages between tests (fresh
// mount, already at the top — this exits after zero swipes), but the tablet
// two-pane keeps the page mounted with its offset, so a screenful index would
// otherwise mean something different on each.
async function scrollToTop(topMarker: string): Promise<void> {
  for (let i = 0; i < 25; i++) {
    if (await byText(topMarker).isDisplayed().catch(() => false)) return
    await swipeContent('down', 2)
  }
}

// Open a dev debug page from the settings root. Returns false in a production
// build, where the row is gated behind __DEV__ and never renders.
async function openDebugPage(row: string, marker: string): Promise<boolean> {
  await escapeToTabs()
  await navigateToMore()
  await waitForTestID(T.SETTINGS_ACCOUNT, 3000)
  await scrollDownToText(row).catch(() => {})
  if (!(await byText(row).isExisting().catch(() => false))) return false
  await tapSettingsRow(row)
  await waitForTestID(marker, 5000)
  await scrollToTop(marker === T.SETTINGS_TYPOGRAPHY ? TYPOGRAPHY_TOP : MARKDOWN_TOP)
  if (marker === T.SETTINGS_TYPOGRAPHY) await resetTypographyControls()
  return true
}

// Put the typography controls back to their defaults (light background,
// strikethrough, first sample). State survives between tests wherever the page
// stays mounted, and every sample row below the controls reflects it. A test
// can't clean up after itself — the harness screenshots when the test ENDS —
// so normalization runs on entry.
async function resetTypographyControls(): Promise<void> {
  const dark = control('Dark')
  // The switch reports its state through the label's accessibility value.
  if ((await dark.getAttribute('value').catch(() => '')) === '1') await dark.click()
  await control('strikethrough').click().catch(() => {})
  // sampleIdx only counts up, so cycle forward until the default sample is back.
  for (const _ of sampleStrings) {
    if (await byText(sampleStrings[0]).isExisting().catch(() => false)) return
    await control('Next').click()
  }
}

// Scroll to screenful `index`, stopping one short first: if the page bottom was
// already on screen there, this index shows nothing new, so the test suppresses
// its report card instead of duplicating the last screen.
async function scrollToScreen(index: number, endMarker: string): Promise<void> {
  if (index === 0) return
  await swipeContent('up', (index - 1) * SWIPES_PER_SCREEN)
  if (await byText(endMarker).isDisplayed().catch(() => false)) {
    skipArtifact()
    return
  }
  await swipeContent('up', SWIPES_PER_SCREEN)
}

describe('settings debug pages', () => {
  for (let i = 0; i < MARKDOWN_SCREENS; i++) {
    it(`markdown debug page screen ${i + 1}`, async () => {
      if (!(await openDebugPage('Markdown', T.SETTINGS_MARKDOWN))) return skipArtifact()
      await expect(el(T.SETTINGS_MARKDOWN)).toExist()
      await scrollToScreen(i, MARKDOWN_END)
    })
  }

  for (let i = 0; i < TYPOGRAPHY_SCREENS; i++) {
    it(`typography debug page screen ${i + 1}`, async () => {
      if (!(await openDebugPage('Typography', T.SETTINGS_TYPOGRAPHY))) return skipArtifact()
      await expect(el(T.SETTINGS_TYPOGRAPHY)).toExist()
      await scrollToScreen(i, TYPOGRAPHY_END)
    })
  }

  // The typography controls change every sample row below them, so the
  // non-default states get their own shots.
  it('typography debug page dark background', async () => {
    if (!(await openDebugPage('Typography', T.SETTINGS_TYPOGRAPHY))) return
    await control('Dark').click()
  })

  it('typography debug page underline decoration', async () => {
    if (!(await openDebugPage('Typography', T.SETTINGS_TYPOGRAPHY))) return
    await control('underline').click()
  })

  it('typography debug page next sample', async () => {
    if (!(await openDebugPage('Typography', T.SETTINGS_TYPOGRAPHY))) return
    await control('Next').click()
  })
})

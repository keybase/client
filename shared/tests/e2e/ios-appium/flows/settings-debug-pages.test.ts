// Typography and Markdown are the dev-only debug pages (their More rows render under __DEV__, and the
// gate runs a dev build): long scrolling catalogs, one test per screenful, each opening the page fresh
// and scrolling to its own screenful. Every screenful test also checks the page still has exactly
// the count below: the page's last line is drawn on its last screenful and on no screenful before it,
// so a page that grows or shrinks fails and says which count to set. The typography controls (the
// Dark background, a decoration, the next sample) change every sample row below them, so each
// non-default state has a test of its own; the afterEach puts the controls back while the page is up
// (each read off its testID first, so it only acts on what is changed), and the page then leaves.
import * as T from '../../shared/test-ids'
import {settingShown} from '../gate/persisted-lib.ts'
import {step} from '../gate/step'
import {el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {check, labelledElement} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {openSettingsPage} from '../helpers/settings'

// Screenfuls of each page on the gate's phone, as the desktop gate counts them for its window.
const MARKDOWN_SCREENS = 10
const TYPOGRAPHY_SCREENS = 6

type DebugPage = {
  // the More list row, the page's route and testID
  row: string
  route: string
  marker: string
  // a line on the first screenful, and the page's last line (a part of its label)
  top: string
  end: string
  screens: number
  // the constant that holds `screens`, for the count's error
  constName: string
}

const MARKDOWN: DebugPage = {
  constName: 'MARKDOWN_SCREENS',
  end: 'english control',
  marker: T.SETTINGS_MARKDOWN,
  route: 'settingsTabs.markdownTab',
  row: 'Markdown',
  screens: MARKDOWN_SCREENS,
  top: 'Inline',
}

const TYPOGRAPHY: DebugPage = {
  constName: 'TYPOGRAPHY_SCREENS',
  end: 'italic bold italic italic',
  marker: T.SETTINGS_TYPOGRAPHY,
  route: 'settingsTabs.typographyTab',
  row: 'Typography',
  screens: TYPOGRAPHY_SCREENS,
  top: 'Background',
}

// The typography page's samples, in the order Next steps through them (settings/typography.tsx)
const SAMPLES = 5

// The one control drawn with exactly `label`: the decoration buttons are 'underline' and
// 'underline+strikethrough', and the section headers repeat the same words, so a contains-match
// would pick the wrong one. Bound: one read 1.
const control = async (label: string) =>
  labelledElement(`-ios predicate string:label == ${JSON.stringify(label)} AND visible == 1`, label, `the ${label} control`)

// Scroll the debug page's own content column.
//
// Driving the ScrollView with `mobile: scroll` press-drags, which on these pages (every sample is
// selectable) summons the copy/Select All edit menu instead of scrolling. A slow drag at the content
// column does not. A fast swipe flicks: momentum carries the list on past where the finger stopped.
// Dragging slowly and holding still before lifting kills the momentum, so one drag moves the page by
// its own travel and nothing more.
const CONTENT_X = 0.7
const FROM_Y = 0.85
const TO_Y = 0.18
const DRAG_MS = 600
const HOLD_MS = 250

// One drag toward the page's end. Bound: the drag 1.
const dragTowardEnd = async () => {
  const {width, height} = await browser.getWindowRect()
  const x = Math.round(width * CONTENT_X)
  await browser
    .action('pointer')
    .move({x, y: Math.round(height * FROM_Y)})
    .down()
    .move({duration: DRAG_MS, x, y: Math.round(height * TO_Y)})
    .pause(HOLD_MS)
    .up()
    .perform()
}

// Whether a text holding `part` in its label is on screen. Bound: one read 1.
const shown = async (part: string) =>
  (await browser.$$(`-ios predicate string:label CONTAINS ${JSON.stringify(part)} AND visible == 1`).length) > 0

// The index of the sample the typography page shows, read off its Next button. Bound: one read 1.
const sampleShown = async () => {
  const found = await browser.$$(`-ios predicate string:name BEGINSWITH "${T.SETTINGS_TYPOGRAPHY_NEXT_PREFIX}"`).getElements()
  check(found.length === 1, `${found.length} typography Next buttons drawn, not one`)
  const id = (await found[0]!.getAttribute('name')) ?? ''
  const at = Number(id.slice(T.SETTINGS_TYPOGRAPHY_NEXT_PREFIX.length))
  check(id.startsWith(T.SETTINGS_TYPOGRAPHY_NEXT_PREFIX) && Number.isInteger(at), "the typography Next button's testID holds no sample")
  return at
}

const DARK = T.SETTINGS_TYPOGRAPHY_DARK
const decoration = (d: string) => `${T.SETTINGS_TYPOGRAPHY_DECORATION_PREFIX}${d}`

// Waits for the control `base` to show `want`. Bound: 5s of reads, overrun by one 1 = 6.
const expectShown = async (base: string, want: 'on' | 'off', what: string) =>
  waitFor(`${what} to show ${want}`, async () => ((await settingShown(base)) === want ? true : undefined), {interval: 250, timeout: 5_000})

// Waits for the page to show sample `want`. Bound: 6.
const expectSample = async (want: number, what: string) =>
  waitFor(what, async () => ((await sampleShown()) === want ? true : undefined), {interval: 250, timeout: 5_000})

describe('settings debug pages', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openDebugPage 142 (escapeToTabs 30, the More tab 20, the row 54 and its tap 1, the
  //             screen 11, its marker 10, the top line 10 and its read 1, the controls 5)
  //   drag      one drag 1, then a read 1;  control  a control read 1 and its tap 1;  shown  6
  //   step      2 (its 1s settle and the attach)

  // The typography controls a test changed, put back while the page is still up: each read off its
  // testID and tapped only when it is not the default (a page that is not drawn holds nothing: its
  // controls are the page's own state, which a fresh open starts at the defaults).
  // Bound: the Dark switch read 1, its tap 2 and shown 6; strikethrough 1, 2, 6; the samples (a read
  // 1, then up to SAMPLES - 1 taps of 2) 9 and shown 6 = 34.
  const restoreTypography = async () => {
    if (!(await el(T.SETTINGS_TYPOGRAPHY).isExisting())) return
    if ((await settingShown(DARK)) === 'on') {
      await (await control('Dark')).click()
      await expectShown(DARK, 'off', 'the Dark background put back')
    }
    if ((await settingShown(decoration('strikethrough'))) !== 'on') {
      await (await control('strikethrough')).click()
      await expectShown(decoration('strikethrough'), 'on', 'the strikethrough decoration put back')
    }
    // Next only steps forward, so it goes on around to the first sample
    const at = await sampleShown()
    if (at !== 0) {
      for (let i = at; i < SAMPLES; i++) await (await control('Next')).click()
      await expectSample(0, 'the first sample put back')
    }
  }

  // Worst case (s): restoreTypography 34, escapeToTabs 30 = 64.
  afterEach(async function () {
    this.timeout(90_000)
    await restoreTypography()
    await escapeToTabs()
  })

  // The debug page from the More list, freshly opened at its first screenful; the typography page
  // with its controls at the defaults. Bound: open 142.
  const openDebugPage = async (page: DebugPage) => {
    await openSettingsPage(page.row, page.route, page.marker)
    await waitFor(`the ${page.row} page's first screenful`, async () => ((await shown(page.top)) ? true : undefined), {
      interval: 250,
      timeout: 10_000,
    })
    if (page !== TYPOGRAPHY) return
    check((await settingShown(DARK)) === 'off', 'the typography page opened with a dark background')
    check((await settingShown(decoration('strikethrough'))) === 'on', 'the typography page opened with another decoration')
    check((await sampleShown()) === 0, 'the typography page opened on another sample')
  }

  // Screenful `index` (from 0): `index` drags from the top, with the page's last line drawn there
  // only on its last screenful. Bound: open 142, a drag 1 and its read 1 per screenful, the end read
  // 1, step 2.
  const screenTests = (page: DebugPage) => {
    for (let i = 0; i < page.screens; i++) {
      it(`${page.row.toLowerCase()} debug page screen ${i + 1}`, async function () {
        // worst case (s): open 142, 2 per drag (at most 7) 14, the end read 1, step 2 = 159
        this.timeout(180_000)
        await openDebugPage(page)
        for (let d = 0; d < i; d++) {
          check(!(await shown(page.end)), `the ${page.row} page ends on screenful ${d + 1}: set ${page.constName} to ${d + 1}`)
          await dragTowardEnd()
        }
        const last = i === page.screens - 1
        const atEnd = await shown(page.end)
        if (last) check(atEnd, `the ${page.row} page goes on past screenful ${page.screens}: set ${page.constName} to its count`)
        else check(!atEnd, `the ${page.row} page ends on screenful ${i + 1}: set ${page.constName} to ${i + 1}`)
        await step(`${page.row} debug page screen ${i + 1}`, {card: true})
      })
    }
  }

  screenTests(MARKDOWN)
  screenTests(TYPOGRAPHY)

  it('typography debug page dark background', async function () {
    // worst case (s): open 142, control 2, shown 6, step 2 = 152
    this.timeout(180_000)
    await openDebugPage(TYPOGRAPHY)
    await (await control('Dark')).click()
    await expectShown(DARK, 'on', 'the Dark background')
    await step('Typography dark background', {card: true})
  })

  it('typography debug page underline decoration', async function () {
    // worst case (s): open 142, control 2, shown 6 x2, step 2 = 158
    this.timeout(180_000)
    await openDebugPage(TYPOGRAPHY)
    await (await control('underline')).click()
    await expectShown(decoration('underline'), 'on', 'the underline decoration')
    await expectShown(decoration('strikethrough'), 'off', 'the strikethrough decoration')
    await step('Typography underline decoration', {card: true})
  })

  it('typography debug page next sample', async function () {
    // worst case (s): open 142, control 2, shown 6, step 2 = 152
    this.timeout(180_000)
    await openDebugPage(TYPOGRAPHY)
    await (await control('Next')).click()
    await expectSample(1, 'the next sample')
    await step('Typography next sample', {card: true})
  })
})

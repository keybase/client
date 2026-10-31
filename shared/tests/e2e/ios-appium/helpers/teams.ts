// Helpers for the iOS Teams flows: the Teams tab, a team page opened from its row and checked by its
// route's team id, a team page's tabs and header, a view backed out of without submitting it, and
// the check before a tap that writes. Team, channel and account names are compared in memory, so
// none goes into a selector or an error.
import {loadE2EAccounts} from '../../accounts/env'
import {maskAccounts} from '../../accounts/sweep-lib.ts'
import * as T from '../../shared/test-ids'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {innermost, type Rect} from '../gate/chat-lib.ts'
import {sourceElements} from '../gate/page-source-lib.ts'
import {retriedNavigation} from '../gate/step.ts'
import {el, tapForTestID} from './elements'
import {BUTTONS, expectScreen, filesRowNamed, onScreen, onScreenID, press, visibleScreen} from './files'
import {check, elementLabelledIn, elementWithLabelPart, elementWithLabelPartIn, labelledElement} from './menus'
import {waitFor} from './lifecycle'
import {escapeToTabs, goBack, tabTo} from './navigate'

// what a text a flow reads or taps can be drawn as: its own text, a pressable text (a link), or a
// tappable box merging its texts
export const TEXTS =
  '-ios predicate string:(type == "XCUIElementTypeStaticText" OR type == "XCUIElementTypeLink" OR type == "XCUIElementTypeOther") AND label != "" AND visible == 1'
// what a header's text action (Skip) can be drawn as: a native bar button, or a pressable text
const HEADER_ACTIONS =
  '-ios predicate string:(type == "XCUIElementTypeButton" OR type == "XCUIElementTypeStaticText" OR type == "XCUIElementTypeLink") AND label != "" AND visible == 1'

// Runs a host read or setup `f`; an error it throws names the test accounts and the e2e team by role
// only (a CLI or service error can quote a team's name; a subteam keeps its stamped part).
export const masked = async <R,>(f: () => Promise<R>): Promise<R> => {
  try {
    return await f()
  } catch (e) {
    if (isAttemptOver(e)) throw e
    const {secondUser, smokeUser, team} = loadE2EAccounts()
    const msg = e instanceof Error ? e.message : String(e)
    // no cause: the original message is the one with the names in it
    // eslint-disable-next-line preserve-caught-error
    throw new Error(maskAccounts(msg, {team, users: {second: secondUser, smoke: smokeUser}}))
  }
}

// The Teams tab's root. Bound: escapeToTabs 30, tabTo 15 (three taps and 4s waits), the screen 11
// = 56.
export const openTeamsRoot = async () => {
  await escapeToTabs()
  await tabTo('Teams', T.TEAMS_LIST)
  await expectScreen("the Teams tab's root", 'teamsRoot')
}

// Waits for the team page of `teamID`. Bound: 20s, one read 1 = 21.
export const expectTeamPage = async (what: string, teamID: string) => expectScreen(what, 'team', p => p['teamID'] === teamID, 20_000)

// The team `name` opened from its row in the Teams tab, the list dragged until that row shows (never
// another row: the list holds every team of the account), and checked to be the team `teamID`.
// Bound: root 56, the row 31 (30, one drag 1), its tap 1, the page 21 = 109.
export const openTeamFromList = async (name: string, teamID: string) => {
  await openTeamsRoot()
  const row = await filesRowNamed(name, 'the team row', {testID: T.TEAMS_ROW})
  await press(row.e, 'the team row')
  await expectTeamPage('the team page of the row tapped', teamID)
}

const rectOf = async (e: WebdriverIO.Element) => {
  const at = await e.getLocation()
  const size = await e.getSize()
  return {...at, ...size}
}

const drag = async (from: {x: number; y: number}, to: {x: number; y: number}) =>
  browser
    .action('pointer', {parameters: {pointerType: 'touch'}})
    .move({x: Math.round(from.x), y: Math.round(from.y)})
    .down()
    .move({duration: 300, x: Math.round(to.x), y: Math.round(to.y)})
    .pause(200)
    .up()
    .perform()

// Taps the team page's tab `button` and waits for its body `body`. A tab scrolled out of the tab row
// (the phone's row scrolls sideways) is dragged into it first. Bound: up to three drags and their
// reads 6, tapForTestID 18 (three taps 1 and waits 5) = 24.
export const openTeamTab = async (button: string, body: string) => {
  for (let i = 0; i < 3 && !(await onScreenID(button)); i++) {
    const row = await rectOf(await el(T.TEAMS_TABS).getElement())
    const at = await el(button).getLocation().catch(() => undefined)
    const y = row.y + row.height / 2
    const left = {x: row.x + row.width * 0.2, y}
    const right = {x: row.x + row.width * 0.8, y}
    // a tab past the row's right end comes in by dragging the row left, one before its start right
    await (!at || at.x > row.x + row.width / 2 ? drag(right, left) : drag(left, right))
  }
  await tapForTestID(button, body)
}

// Scrolls the team page back to its top until its header (marked by its "..." menu button) is on
// screen. Bound: up to four drags and their reads 8.
export const revealTeamHeader = async () => {
  for (let i = 0; i < 4 && !(await onScreenID(T.TEAMS_HEADER_MENU_BUTTON)); i++) {
    const {height, width} = await browser.getWindowRect()
    await drag({x: width / 2, y: height * 0.35}, {x: width / 2, y: height * 0.75})
  }
  check(await onScreenID(T.TEAMS_HEADER_MENU_BUTTON), "the team page's header is not on screen")
}

// Refuses, before a tap that writes, unless the screen up is `name` and `ok` takes its params (the
// throwaway subteam's team id, a conversation of it, or its name). Bound: one read 1.
export const requireOnSubteam = async (what: string, name: string, ok: (params: Record<string, unknown>) => boolean) => {
  const s = await visibleScreen()
  check(s?.name === name && ok(s.params ?? {}), `${what} is not aimed at the throwaway subteam: not tapping`)
}

// One step back from the screen on top. A modal's bar holds its Cancel or Close; a pushed page's, its
// Back. The tree keeps the bars of the screens under a modal too (in no fixed order), and a modal's
// elements can read visible=false, so goBack's pick (the leftmost visible bar button) can land on the
// page under the modal and pop the page the flow means to come back to. So a Cancel or Close in any
// bar wins over a Back (one under the top modal sits at the same frame, so its tap lands on the top
// one's); among those, a visible one, else the lowest (a modal sheet's bar sits below a page's). Never
// a bar's submit (Save, Done). Bound: the reads 3, the click 1, the route leaving 3 and the slide-out
// 1 = 8 (goBack's 3 when there is none).
const backOnce = async () => {
  const pick = async (labels: ReadonlyArray<string>) => {
    const found: Array<{e: WebdriverIO.Element; visible: boolean; y: number}> = []
    for (const label of labels) {
      for (const e of await browser
        .$$(`-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton[\`label == "${label}"\`]`)
        .getElements()) {
        const y = (await e.getLocation().catch(() => undefined))?.y ?? -1
        found.push({e, visible: (await e.getAttribute('visible').catch(() => null)) === 'true', y})
      }
    }
    // a modal sheet's bar sits below a full-screen page's
    return (found.find(f => f.visible) ?? [...found].sort((p, q) => q.y - p.y)[0])?.e
  }
  const button = (await pick(['Cancel', 'Close'])) ?? (await pick(['Back']))
  if (!button) return goBack()
  // a click: a bar button takes one even when it reads visible=false, and a modal's frames are not
  // where its window draws them
  const before = (await visibleScreen())?.name
  await button.click()
  // the modal or page goes before the next read: a tab tapped while it still slides out can miss, and
  // a drag then can pop the page under it. Its route leaves first, then its slide-out ends.
  await waitFor('the screen to go', async () => ((await visibleScreen())?.name !== before ? true : undefined), {
    interval: 200,
    timeout: 3_000,
  }).catch((e: unknown) => {
    if (isAttemptOver(e)) throw e
  })
  await browser.pause(1_000)
}

// Backs out of a view opened from the team page of `teamID` without submitting it (its header's
// Cancel or back), until that page is up again. Bound: 30s of tries, overrun by one (backOnce 8,
// the page 5 and its read 1) = 44.
export const backToTeamPage = async (what: string, teamID: string) =>
  retriedNavigation(
    `back from ${what} to the team page`,
    async () => {
      const s = await visibleScreen()
      if (!(s?.name === 'team' && s.params?.['teamID'] === teamID)) await backOnce()
      await expectScreen('the team page', 'team', p => p['teamID'] === teamID, 5_000)
    },
    {intervals: [500], timeout: 30_000}
  )

// Backs out of a screen opened from the Teams tab's root until the root is up again. Bound: as
// backToTeamPage, 39.
export const backToTeamsRoot = async (what: string) =>
  retriedNavigation(
    `back from ${what} to the Teams tab`,
    async () => {
      if ((await visibleScreen())?.name !== 'teamsRoot') await backOnce()
      await expectScreen("the Teams tab's root", 'teamsRoot', () => true, 5_000)
    },
    {intervals: [500], timeout: 30_000}
  )

// The one text drawn holding `part` as a part of its label (a tappable box merges its texts, so a card
// reads "<title>, <subtitle>"), once it is drawn. Bound: `timeout`, plus one read 1.
export const textPartShown = async (part: string, what: string, timeout = 5_000) =>
  waitFor(what, async () => elementWithLabelPartIn(TEXT_TYPES, part, what), {interval: 250, timeout})

// what TEXTS finds, as element types, for a read off one page source (an attribute call per element
// of every labelled box on a screen took minutes)
const TEXT_TYPES = ['XCUIElementTypeStaticText', 'XCUIElementTypeLink', 'XCUIElementTypeOther']

// The one text drawn reading exactly `label`, once it is drawn. Bound: `timeout`, plus one read 1.
export const textShown = async (label: string, what: string, timeout = 5_000) =>
  waitFor(what, async () => elementLabelledIn(TEXT_TYPES, label, what), {interval: 250, timeout})

// Taps the Teams tab's card `label` ("Create a team", "Join a team"): a tappable box whose label
// merges its texts, not a button. Bound: 5s, the tap 1.
export const tapTeamsCard = async (label: string, what: string) => {
  const card = await waitFor(
    what,
    async () =>
      elementWithLabelPart(`-ios predicate string:type == "XCUIElementTypeOther" AND label CONTAINS ${JSON.stringify(label)} AND visible == 1`, label, what),
    {interval: 250, timeout: 5_000}
  )
  await card.click()
}

// Taps the header's text action `label` (a native bar button, or a pressable text). Bound: 5s, the
// tap 1.
export const tapHeaderAction = async (label: string, what: string) => {
  const action = await waitFor(what, async () => labelledElement(HEADER_ACTIONS, label, what), {interval: 250, timeout: 5_000})
  await action.click()
}

// Taps the team header's Add/Invite people: a page with no other members draws a second one lower
// down, in its empty members list, so the header's is the upper of those on screen. Bound: 5s, the
// tap 1.
export const tapHeaderAddInvite = async () => {
  const button = await waitFor(
    "the header's Add/Invite people",
    async () => {
      const found: Array<{e: WebdriverIO.Element; y: number}> = []
      for (const e of await browser.$$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add/Invite people"').getElements()) {
        if (!(await onScreen(e))) continue
        found.push({e, y: (await e.getLocation()).y})
      }
      return found.sort((a, b) => a.y - b.y)[0]?.e
    },
    {interval: 250, timeout: 5_000}
  )
  await button.click()
}

// The one field of `type` on screen (TextField for a line, TextView for a multi-line field), found by
// its type so a placeholder holding a name never goes into a selector: the one reported visible, else
// (a modal whose elements XCUITest reports visible=false now and then) the one in the tree.
// Throws unless there is exactly one. Bound: 10s, one read 1.
export const onlyField = async (type: 'TextField' | 'TextView', what: string) => {
  const any = `-ios predicate string:type == "XCUIElementType${type}"`
  const visible = `${any} AND visible == 1`
  await waitFor(what, async () => ((await browser.$$(any).length) > 0 ? true : undefined), {interval: 250, timeout: 10_000})
  const selector = (await browser.$$(visible).length) > 0 ? visible : any
  const n = await browser.$$(selector).length
  check(n === 1, `${n} of ${what} on screen, not one`)
  return () => browser.$(selector)
}

// The one element of TEXTS' or BUTTONS' types whose label, split at its ", " joins, holds `part`,
// drawn with its middle inside `rect` (a row, a popup), the innermost of nested matches: a label
// repeated elsewhere on screen (a role behind the role picker) is not it. Read off one page source
// (an attribute call per labelled box took minutes) and compared in memory: the visible matches, or
// when XCUITest reports none of them visible (a popup it reports invisible now and then) every one in
// the rect; then fetched by its type and frame. `what` names it. Throws when none or more than one is.
// Bound: one read 2.
export const labelPartInside = async (rect: Rect, selector: string, part: string, what: string) => {
  const types = selector === BUTTONS ? ['XCUIElementTypeButton'] : TEXT_TYPES
  const inRect = sourceElements(await browser.getPageSource())
    .filter(e => types.includes(e.type) && (e.attrs['label'] ?? '') !== '')
    .filter(e => (e.attrs['label'] ?? '').replace(/\u00a0/g, ' ').split(', ').some(p => p.trim() === part))
    .map(e => ({e, r: {height: Number(e.attrs['height']), width: Number(e.attrs['width']), x: Number(e.attrs['x']), y: Number(e.attrs['y'])}}))
    .filter(({r}) => {
      const x = r.x + r.width / 2
      const y = r.y + r.height / 2
      return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
    })
  const shown = inRect.filter(({e}) => e.attrs['visible'] === 'true')
  const found = shown.length ? shown : inRect
  const inner = innermost(found.map(f => f.r))
  check(inner.length === 1, `${inner.length} of ${what} drawn, not one`)
  const {e, r} = found[inner[0]!]!
  const at = `rect.x == ${r.x} AND rect.y == ${r.y} AND rect.width == ${r.width} AND rect.height == ${r.height}`
  const el = (await browser.$$(`-ios predicate string:type == "${e.type}" AND ${at}`).getElements()).at(-1)
  if (!el) throw new Error(`no element at the frame of ${what}`)
  return el
}

// Waits for labelPartInside to find the element. Bound: `timeout`, plus one read 1.
export const shownInside = async (rect: Rect, selector: string, part: string, what: string, timeout = 5_000) =>
  waitFor(what, async () => labelPartInside(rect, selector, part, what), {interval: 250, timeout})

// The open role picker's rect, once it is drawn. Bound: 10s, its read 1.
const rolePicker = async () => {
  await waitFor('the role picker', async () => ((await onScreenID(T.TEAMS_ROLE_PICKER)) ? true : undefined), {interval: 250, timeout: 10_000})
  return rectOf(await el(T.TEAMS_ROLE_PICKER).getElement())
}

// Picks `role` (as the picker titles it: "Reader", "Writer") in the open role picker, then runs
// `beforeSave` (the check before a write), taps Save and waits for the picker to close. Bound: the
// picker 11, the role 6 and its tap 1, Save 6, `beforeSave`, its tap 1, the picker gone 10 = 35 plus
// `beforeSave`.
export const pickRole = async (role: string, beforeSave: () => Promise<void>) => {
  const picker = await rolePicker()
  await press(await shownInside(picker, TEXTS, role, `the role picker's ${role}`), `the role picker's ${role}`)
  const save = await shownInside(picker, BUTTONS, 'Save', "the role picker's Save")
  await beforeSave()
  await save.click()
  await el(T.TEAMS_ROLE_PICKER).waitForExist({reverse: true, timeout: 10_000})
}

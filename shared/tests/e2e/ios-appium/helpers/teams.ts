// Helpers for the iOS Teams flows: the Teams tab, a team page opened from its row and checked by its
// route's team id, a team page's tabs and header, a view backed out of without submitting it, and
// the check before a tap that writes. Team, channel and account names are compared in memory, so
// none goes into a selector or an error.
import {loadE2EAccounts} from '../../accounts/env'
import {maskAccounts} from '../../accounts/sweep-lib.ts'
import * as T from '../../shared/test-ids'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {retriedNavigation} from '../gate/step.ts'
import {el, tapForTestID} from './elements'
import {BUTTONS, expectScreen, filesRowNamed, visibleScreen} from './files'
import {check, labelledElement} from './menus'
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
  await row.e.click()
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
  for (let i = 0; i < 3 && !(await el(button).isDisplayed().catch(() => false)); i++) {
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
  for (let i = 0; i < 4 && !(await el(T.TEAMS_HEADER_MENU_BUTTON).isDisplayed().catch(() => false)); i++) {
    const {height, width} = await browser.getWindowRect()
    await drag({x: width / 2, y: height * 0.35}, {x: width / 2, y: height * 0.75})
  }
  check(await el(T.TEAMS_HEADER_MENU_BUTTON).isDisplayed().catch(() => false), "the team page's header is not on screen")
}

// Refuses, before a tap that writes, unless the screen up is `name` and `ok` takes its params (the
// throwaway subteam's team id, a conversation of it, or its name). Bound: one read 1.
export const requireOnSubteam = async (what: string, name: string, ok: (params: Record<string, unknown>) => boolean) => {
  const s = await visibleScreen()
  check(s?.name === name && ok(s.params ?? {}), `${what} is not aimed at the throwaway subteam: not tapping`)
}

// Backs out of a view opened from the team page of `teamID` without submitting it (its header's
// Cancel or back), until that page is up again. Bound: 30s of tries, overrun by one (the back 3,
// the page 5 and its read 1) = 39.
export const backToTeamPage = async (what: string, teamID: string) =>
  retriedNavigation(
    `back from ${what} to the team page`,
    async () => {
      const s = await visibleScreen()
      if (!(s?.name === 'team' && s.params?.['teamID'] === teamID)) await goBack()
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
      if ((await visibleScreen())?.name !== 'teamsRoot') await goBack()
      await expectScreen("the Teams tab's root", 'teamsRoot', () => true, 5_000)
    },
    {intervals: [500], timeout: 30_000}
  )

// The one text drawn reading exactly `label`, once it is drawn. Bound: `timeout`, plus one read 1.
export const textShown = async (label: string, what: string, timeout = 5_000) =>
  waitFor(what, async () => labelledElement(TEXTS, label, what), {interval: 250, timeout})

// The one button drawn labelled `label`, once it is drawn. Bound: 5s, plus one read 1.
export const buttonShown = async (label: string, what: string) =>
  waitFor(what, async () => labelledElement(BUTTONS, label, what), {interval: 250, timeout: 5_000})

// Taps the header's text action `label` (a native bar button, or a pressable text). Bound: 5s, the
// tap 1.
export const tapHeaderAction = async (label: string, what: string) => {
  const action = await waitFor(what, async () => labelledElement(HEADER_ACTIONS, label, what), {interval: 250, timeout: 5_000})
  await action.click()
}

// The one field of `type` on screen (TextField for a line, TextView for a multi-line field), found by
// its type so a placeholder holding a name never goes into a selector. Throws unless there is
// exactly one. Bound: 10s, one read 1.
export const onlyField = async (type: 'TextField' | 'TextView', what: string) => {
  const selector = `-ios predicate string:type == "XCUIElementType${type}" AND visible == 1`
  await waitFor(what, async () => ((await browser.$$(selector).length) > 0 ? true : undefined), {interval: 250, timeout: 10_000})
  const n = await browser.$$(selector).length
  check(n === 1, `${n} of ${what} on screen, not one`)
  return () => browser.$(selector)
}

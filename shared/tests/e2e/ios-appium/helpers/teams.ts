// Helpers for the iOS Teams flows: the Teams tab, a team page opened from its row and checked by its
// route's team id, a team page's tabs and header, a view backed out of without submitting it, and
// the check before a tap that writes. Team, channel and account names are compared in memory, so
// none goes into a selector or an error.
import {randomBytes} from 'crypto'
import {loadE2EAccounts, loadE2EEnv} from '../../accounts/env'
import {parseStampedName, stampedTeamName} from '../../accounts/run-id'
import {maskE2E} from '../../accounts/sweep-lib.ts'
import {createThrowawaySubteam, retryTransient} from '../../shared/chat-data'
import {ensurePeer, runKeybase} from '../../shared/peer-service'
import {e2eRunId} from '../../shared/run-marker'
import {deleteSubteamIfPresent, memberRoles, requireThisRunSubteam, teamID as hostTeamID} from '../../shared/teams.ts'
import * as T from '../../shared/test-ids'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {innermost, type Rect} from '../gate/chat-lib.ts'
import {framePredicate, labelHas, sourceElements, sourceRect} from '../gate/page-source-lib.ts'
import {retriedNavigation} from '../gate/step.ts'
import {el, tapForTestID} from './elements'
import {filesRowNamed} from './files'
import {expectScreen, visibleScreen} from '../gate/screens'
import {
  BUTTON_ELEMENTS,
  check,
  dragBetween,
  type DrawnOptions,
  elementLabelledIn,
  elementWithLabelPart,
  elementWithLabelPartIn,
  frameOf,
  NAMED_ELEMENT_TYPES,
  onScreen,
  onScreenID,
  press,
} from './menus'
import {waitFor} from './lifecycle'
import {backUntil, barButton, goBack, openTabRoot} from './navigate'

// The visible texts a flow reads or taps, drawn as menus' NAMED_ELEMENT_TYPES: its own text, a
// pressable text (a link), or a tappable box merging its texts. A read of many goes off one page
// source by those types instead (an attribute call per element of every labelled box on a screen took
// minutes).
export const TEXTS = `-ios predicate string:(${NAMED_ELEMENT_TYPES.map(t => `type == "${t}"`).join(' OR ')}) AND label != "" AND visible == 1`
// what a header's text action (Skip) can be drawn as: a native bar button, or a pressable text
const HEADER_ACTION_TYPES = ['XCUIElementTypeButton', 'XCUIElementTypeStaticText', 'XCUIElementTypeLink']

// Runs a host read or setup `f`; an error it throws names the test accounts and the e2e team by role
// only (a CLI or service error can quote a team's name; a subteam keeps its stamped part).
export const masked = async <R,>(f: () => Promise<R>): Promise<R> => {
  try {
    return await f()
  } catch (e) {
    if (isAttemptOver(e)) throw e
    // no cause: the original message is the one with the names in it
    // eslint-disable-next-line preserve-caught-error
    throw new Error(maskE2E(e))
  }
}

// -- host setup and reads ------------------------------------------------------------------------

// Cleans up each subteam name in `made` with `f` (deleteSubteamIfPresent by default), its errors
// masked, dropping each name from `made` once its cleanup is done: one that throws stops there and
// leaves itself and the rest in `made`. Bound: f's, a name.
export const drainMade = async (made: Set<string>, f: (name: string) => Promise<unknown> = deleteSubteamIfPresent) => {
  for (const name of [...made]) {
    await masked(async () => f(name))
    made.delete(name)
  }
}

// The second account's role in a subteam ('none' when it is not in it), and whether the same read
// has the smoke account in it (the anchor for its absence). Bound: one CLI read 255.
export const secondRoleIn = async (name: string) => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  const roles = await memberRoles(name)
  return {anchored: smokeUser in roles, second: roles[secondUser] ?? 'none'}
}

// A subteam of the e2e team made by the host for one test, its name added to `made` (what the flow's
// afterEach deletes) before the make, so a test timed out during it still has it deleted. `prefix` is
// up to 3 characters. Bound: 600 (two CLI calls of up to four tries of 60 with 5s pauses, 255 each,
// then its general channel listed 90).
export const makeOwnSubteam = async (prefix: string, made: Set<string>) => {
  const label = `${prefix}${randomBytes(2).toString('hex')}`
  const name = `${loadE2EAccounts().team}.${stampedTeamName(label, e2eRunId())}`
  requireThisRunSubteam(name)
  made.add(name)
  const {generalConvID} = await masked(async () => createThrowawaySubteam(label))
  return {generalConvID, name}
}

// makeOwnSubteam, then the subteam's team id. Bound: 600, the id 315 = 915.
export const makeOwnSubteamWithID = async (prefix: string, made: Set<string>) => {
  const subteam = await makeOwnSubteam(prefix, made)
  return {...subteam, teamID: await masked(async () => hostTeamID(subteam.name))}
}

// Polls a host read until `ok` takes it. Bound: 30s, overrun by one read.
export const expectHost = async <V,>(what: string, read: () => Promise<V>, ok: (v: V) => boolean) =>
  masked(async () =>
    waitFor(`the host to read ${what}`, async () => (ok(await read()) ? true : undefined), {interval: 1_000, timeout: 30_000})
  )

// Takes the second account out of a subteam of this run while it is in it, through the CLI.
// Bound: its roles 255, the removal 255 = 510.
export const removeSecond = async (name: string) => {
  const {secondUser} = loadE2EAccounts()
  if (!(secondUser in (await memberRoles(name)))) return
  requireThisRunSubteam(name)
  await retryTransient(
    async () => runKeybase(['team', 'remove-member', name, `--user=${secondUser}`, '--force'], {timeoutMs: 60_000}),
    /not a member|not found/i
  )
}

// The subteams of this run the second account is in, read on its own peer, and whether that read
// lists the e2e team (the anchor: an empty read of the wrong account lists nothing). Bound: one
// peer call 60.
const secondMemberships = async (peer: Awaited<ReturnType<typeof ensurePeer>>) => {
  const {team} = loadE2EAccounts()
  const out = await peer.cli(['team', 'list-memberships', '-j'], 60_000)
  const names = ((JSON.parse(out) as {teams?: Array<{fq_name: string}> | null}).teams ?? []).map(t => t.fq_name)
  const runId = e2eRunId()
  const inRun = names.filter(n => {
    const part = n.startsWith(`${team}.`) ? n.slice(team.length + 1) : ''
    return !part.includes('.') && parseStampedName(part, 'team')?.runId === runId
  })
  return {anchored: names.includes(team), inRun}
}

// Waits for the second account to be in none of this run's subteams. Bound: the peer 70, then 30s of
// reads, overrun by one 60 = 160.
export const secondInNoSubteam = async () =>
  masked(async () => {
    const peer = await ensurePeer('second', loadE2EEnv())
    await waitFor(
      "the second account's memberships to hold none of this run's subteams",
      async () => {
        const {anchored, inRun} = await secondMemberships(peer)
        return anchored && inRun.length === 0 ? true : undefined
      },
      {interval: 2_000, timeout: 30_000}
    )
  })

// -- the app's team pages ------------------------------------------------------------------------

// The Teams tab's root. Bound: escapeToTabs 30, tabTo 15 (three taps and 4s waits), the screen 11
// = 56.
export const openTeamsRoot = async () => openTabRoot('Teams', T.TEAMS_LIST, 'teamsRoot')

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

// Taps the team page's tab `button` and waits for its body `body`. A tab scrolled out of the tab row
// (the phone's row scrolls sideways) is dragged into it first. Bound: up to three drags and their
// reads 6, tapForTestID 18 (three taps 1 and waits 5) = 24.
export const openTeamTab = async (button: string, body: string) => {
  for (let i = 0; i < 3 && !(await onScreenID(button)); i++) {
    const row = await frameOf(await el(T.TEAMS_TABS).getElement(), "the team page's tab row")
    const at = await el(button).getLocation().catch(() => undefined)
    const y = row.y + row.height / 2
    const left = {x: row.x + row.width * 0.2, y}
    const right = {x: row.x + row.width * 0.8, y}
    // a tab past the row's right end comes in by dragging the row left, one before its start right
    await (!at || at.x > row.x + row.width / 2 ? dragBetween(right, left) : dragBetween(left, right))
  }
  await tapForTestID(button, body)
}

// The subteam's page opened from the Teams tab on its tab `tab` until `ready` passes on it: the app
// loads a team's members, invites, requests, channels and settings afresh when its page opens, so a
// host change (or a subteam the host made) shows on a reopen. Bound: 60s of tries, overrun by one
// (team 109, tab 24, `ready`).
export const openSubteamUntil = async (
  what: string,
  name: string,
  teamID: string,
  tab: {body: string; button: string},
  ready: () => Promise<unknown>
) =>
  retriedNavigation(
    what,
    async () => {
      await openTeamFromList(name, teamID)
      await openTeamTab(tab.button, tab.body)
      await ready()
    },
    {intervals: [2_000], timeout: 60_000}
  )

// Scrolls the team page back to its top until its header (marked by its "..." menu button) is on
// screen. Bound: up to four drags and their reads 8.
export const revealTeamHeader = async () => {
  for (let i = 0; i < 4 && !(await onScreenID(T.TEAMS_HEADER_MENU_BUTTON)); i++) {
    const {height, width} = await browser.getWindowRect()
    await dragBetween({x: width / 2, y: height * 0.35}, {x: width / 2, y: height * 0.75})
  }
  check(await onScreenID(T.TEAMS_HEADER_MENU_BUTTON), "the team page's header is not on screen")
}

// Refuses, before a tap that writes, unless the screen up is `name` and `ok` takes its params (the
// throwaway subteam's team id, a conversation of it, or its name). Bound: one read 1.
export const requireOnSubteam = async (what: string, name: string, ok: (params: Record<string, unknown>) => boolean) => {
  const s = await visibleScreen()
  check(s?.name === name && ok(s.params ?? {}), `${what} is not aimed at the throwaway subteam: not tapping`)
}

// One step back from the screen on top: barButton's pick, a modal's Cancel or Close over a pushed
// page's Back (one under the top modal sits at the same frame, so its tap lands on the top one's).
// goBack's pick (the leftmost visible bar button) can land on the page under a modal, whose elements
// can read visible=false, and pop the page the flow means to come back to. Bound: barButton 2, the
// screen read 1, the click 1, the route leaving 3 and the slide-out 1 = 8 (goBack's 3 when there is
// none).
const backOnce = async () => {
  const button = await barButton()
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
  backUntil(`back from ${what} to the team page`, 'team', p => p['teamID'] === teamID, backOnce)

// Backs out of a screen opened from the Teams tab's root until the root is up again. Bound: as
// backToTeamPage, 39.
export const backToTeamsRoot = async (what: string) => backUntil(`back from ${what} to the Teams tab`, 'teamsRoot', () => true, backOnce)

// The one visible text holding `part` as a part of its label (a tappable box merges its texts, so a
// card reads "<title>, <subtitle>"), once it is drawn; `opts` as drawnElementIn's (forTap for a text
// about to be tapped). Bound: `timeout`, plus one read 1.
export const textPartShown = async (part: string, what: string, timeout = 5_000, opts?: DrawnOptions) =>
  waitFor(what, async () => elementWithLabelPartIn(NAMED_ELEMENT_TYPES, part, what, opts), {interval: 250, timeout})


// The one visible text reading exactly `label`, once it is drawn; `opts` as textPartShown's. Bound:
// `timeout`, plus one read 1.
export const textShown = async (label: string, what: string, timeout = 5_000, opts?: DrawnOptions) =>
  waitFor(what, async () => elementLabelledIn(NAMED_ELEMENT_TYPES, label, what, opts), {interval: 250, timeout})

// Taps the Teams tab's card `label` ("Create a team", "Join a team"): a tappable box whose label
// merges its texts, not a button. Bound: 5s, the tap 1.
export const tapTeamsCard = async (label: string, what: string) => {
  const card = await waitFor(
    what,
    async () =>
      elementWithLabelPart(`-ios predicate string:type == "XCUIElementTypeOther" AND label CONTAINS ${JSON.stringify(label)} AND visible == 1`, label, what, {
        forTap: true,
      }),
    {interval: 250, timeout: 5_000}
  )
  await card.click()
}

// Taps the header's text action `label` (a native bar button, or a pressable text), read off one page
// source: an attribute call per element took 19s on the people search with its keyboard up (seen
// live). Bound: 5s, overrun by one read 2, the tap 1.
export const tapHeaderAction = async (label: string, what: string) => {
  const action = await waitFor(what, async () => elementLabelledIn(HEADER_ACTION_TYPES, label, what, {forTap: true}), {interval: 250, timeout: 5_000})
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

// The one element of TEXTS' or BUTTON_ELEMENTS' types whose label, split at its ", " joins, holds `part`,
// drawn with its middle inside `rect` (a row, a popup), the innermost of nested matches: a label
// repeated elsewhere on screen (a role behind the role picker) is not it. Read off one page source
// (an attribute call per labelled box took minutes) and compared in memory: the visible matches, or
// when XCUITest reports none of them visible (a popup it reports invisible now and then) every one in
// the rect; then fetched by its type and frame. `what` names it. Throws when none or more than one is.
// Bound: one read 2.
export const labelPartInside = async (rect: Rect, selector: string, part: string, what: string) => {
  const types = selector === BUTTON_ELEMENTS ? ['XCUIElementTypeButton'] : NAMED_ELEMENT_TYPES
  const inRect = sourceElements(await browser.getPageSource())
    .filter(e => types.includes(e.type) && (e.attrs['label'] ?? '') !== '')
    .filter(e => labelHas(e.attrs['label'] ?? '', part))
    .map(e => ({e, r: sourceRect(e.attrs)}))
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
  const el = (await browser.$$(`-ios predicate string:type == "${e.type}" AND ${framePredicate(r)}`).getElements()).at(-1)
  if (!el) throw new Error(`no element at the frame of ${what}`)
  return el
}

// Waits for labelPartInside to find the element. Bound: `timeout`, plus one read 1.
export const shownInside = async (rect: Rect, selector: string, part: string, what: string, timeout = 5_000) =>
  waitFor(what, async () => labelPartInside(rect, selector, part, what), {interval: 250, timeout})

// The open role picker's rect, once it is drawn. Bound: 10s, its read 1.
const rolePicker = async () => {
  await waitFor('the role picker', async () => ((await onScreenID(T.TEAMS_ROLE_PICKER)) ? true : undefined), {interval: 250, timeout: 10_000})
  return frameOf(await el(T.TEAMS_ROLE_PICKER).getElement(), 'the role picker')
}

// Picks `role` (as the picker titles it: "Reader", "Writer") in the open role picker, then runs
// `beforeSave` (the check before a write), taps Save and waits for the picker to close. Bound: the
// picker 11, the role 6 and its tap 1, Save 6, `beforeSave`, its tap 1, the picker gone 10 = 35 plus
// `beforeSave`.
export const pickRole = async (role: string, beforeSave: () => Promise<void>) => {
  const picker = await rolePicker()
  await press(await shownInside(picker, TEXTS, role, `the role picker's ${role}`), `the role picker's ${role}`)
  const save = await shownInside(picker, BUTTON_ELEMENTS, 'Save', "the role picker's Save")
  await beforeSave()
  await save.click()
  await el(T.TEAMS_ROLE_PICKER).waitForExist({reverse: true, timeout: 10_000})
}

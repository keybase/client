// Pieces of the iOS chat and row helpers (helpers/chat.ts, helpers/menus.ts), kept apart so they can be
// unit-tested: pure, but for rectOf and elementInRow, which read the screen through `browser`.
import {isDeepStrictEqual} from 'util'
import {
  CHAT_INBOX_BIG_TEAM_HEADER,
  CHAT_INBOX_BIG_TEAMS_DIVIDER,
  CHAT_INBOX_CHANNEL_ROW,
  CHAT_INBOX_ROW,
  CHAT_INBOX_UNREAD_SHORTCUT,
} from '../../shared/test-ids.ts'
import {labelHas, type SourceElement} from './page-source-lib.ts'

// Whether an inbox row's accessibility label is the row of `name`. A small conversation's row reads
// "<name>, <time>, <snippet>" (after the pin's glyph when pinned), so the name is its whole first field (a name holding ", " spans
// several): a row of a longer name that starts with `name` is not it. A big team's channel row reads
// "# <channel>" and is asked for as "#<channel>".
export const inboxRowMatches = (label: string, name: string) => {
  if (!name) return false
  // a pinned row draws its pin icon first: a field of icon-font glyphs (Unicode private use) before
  // the name
  const l = label.replace(/^[\uE000-\uF8FF]+, /, '').replace(/^# /, '#')
  return l === name || l.startsWith(`${name}, `)
}

// Whether a forward picker result's accessibility label is the conversation named `name`: the row
// reads its avatars' labels, if any, then the name, each a field of its own, so a longer name that
// holds `name` is not it.
export const forwardResultMatches = (label: string, name: string) => !!name && labelHas(label, name)

// Why a value read back after a relaunch is not the one wanted, or undefined when it is.
export const persistedMismatch = (what: string, got: unknown, want: unknown) =>
  isDeepStrictEqual(got, want) ? undefined : `${what} after a relaunch: ${JSON.stringify(got)}, want ${JSON.stringify(want)}`

// A vertical stretch of the window, in window points.
export type Span = {bottom: number; top: number}

// What the inbox draws: small conversation rows, big team channel rows, and big team headers, each
// named by its team-name text's label (undefined when it was not read). A channel row belongs to the
// nearest header drawn above it.
export type DrawnInboxItem =
  | {kind: 'small'; label: string; span: Span}
  | {kind: 'channel'; label: string; span: Span}
  | {kind: 'header'; span: Span; team: string | undefined}

const byTop = (items: ReadonlyArray<DrawnInboxItem>) =>
  items.map((item, i) => ({i, item})).sort((a, b) => a.item.span.top - b.item.span.top)

// The indexes of the drawn rows whose labels name `name` (inboxRowMatches). A "#channel" is looked for
// only among the channel rows of `team`'s section, so a same-named channel of another team is never
// it; any other name only among small conversation rows. Rows above the first drawn header are in the
// `carried` team's section (carriedTeam of the drawing before the last drag); an unknown carried team
// is no team's.
export const inboxRowCandidates = (
  items: ReadonlyArray<DrawnInboxItem>,
  name: string,
  team: string,
  carried: string | undefined
) => {
  const wantChannel = name.startsWith('#')
  let section = carried
  const found: Array<number> = []
  for (const {i, item} of byTop(items)) {
    if (item.kind === 'header') {
      section = item.team
      continue
    }
    if (wantChannel !== (item.kind === 'channel') || (wantChannel && section !== team)) continue
    if (inboxRowMatches(item.label, name)) found.push(i)
  }
  return found
}

// The index of the drawn row named `name` (inboxRowCandidates) that `accept` also takes, or undefined
// when none is drawn. A label can't tell a one-on-one row from a group row whose first participant is
// `name`, so a small row's lookup passes an `accept` built from the app's own rows (isOneOnOneRow).
// Throws when more than one row is left.
export const findInboxRow = (
  items: ReadonlyArray<DrawnInboxItem>,
  name: string,
  team: string,
  carried: string | undefined,
  accept: (item: DrawnInboxItem) => boolean = () => true
) => {
  const found = inboxRowCandidates(items, name, team, carried).filter(i => accept(items[i]!))
  if (found.length > 1) throw new Error(`more than one inbox row matches the name asked for (${found.length} drawn)`)
  return found[0]
}

// A small conversation row as the app draws it: its frame (the inbox is in the main window, so the
// app's frame is the screen's), its participants other than the account (the account alone for its
// own conversation), and whether it is a team's.
export type AppSmallRow = {bottom: number; participants: ReadonlyArray<string>; team: boolean; top: number}

// Whether a drawn small row is the app's one-on-one row with `name` (or the account's own, named by the
// account): the app row at its frame has that one participant and is no team's. A row the app has no
// row at is not taken.
export const isOneOnOneRow = (rows: ReadonlyArray<AppSmallRow>, name: string) => (item: DrawnInboxItem) => {
  const row = rows.find(r => Math.abs(r.top - item.span.top) < 1 && Math.abs(r.bottom - item.span.bottom) < 1)
  return !!row && !row.team && row.participants.length === 1 && row.participants[0] === name
}

// The team whose section runs at the list's top (`listTop`), for the drawing after the next drag:
// the lowest drawn header at or above it, by name, or `carried` when none is drawn there.
export const carriedTeam = (items: ReadonlyArray<DrawnInboxItem>, listTop: number, carried: string | undefined) => {
  let team = carried
  for (const {item} of byTop(items)) {
    if (item.span.top > listTop) break
    if (item.kind === 'header') team = item.team
  }
  return team
}

const spanOf = (a: Record<string, string>): Span | undefined => {
  const y = Number(a['y'])
  const h = Number(a['height'])
  return a['y'] === undefined || a['height'] === undefined || !Number.isFinite(y) || !Number.isFinite(h)
    ? undefined
    : {bottom: y + h, top: y}
}

const overlaps = (a: Span, b: Span) => a.top < b.bottom && b.top < a.bottom

// What the inbox draws, read off one page source: small rows and channel rows by their labels, big
// team headers named by the text nearest the middle of their gear's row (RN draws a pressable Text as
// a StaticText or a Button), and what floats over the list (the unread shortcut, the floating Big
// teams divider, the tab bar). `signature` changes when what is drawn changes. Team names stay in
// memory: they are never printed.
export const inboxIn = (els: ReadonlyArray<SourceElement>) => {
  const items: Array<DrawnInboxItem> = []
  const covers: Array<Span> = []
  const texts: Array<{label: string; span: Span}> = []
  const gears: Array<Span> = []
  for (const {attrs, type} of els) {
    const span = spanOf(attrs)
    if (!span) continue
    const name = attrs['name']
    const label = attrs['label']
    if (name === CHAT_INBOX_ROW || name === CHAT_INBOX_CHANNEL_ROW) {
      if (label !== undefined) items.push({kind: name === CHAT_INBOX_ROW ? 'small' : 'channel', label, span})
    } else if (name === CHAT_INBOX_BIG_TEAM_HEADER) {
      gears.push(span)
    } else if (name === CHAT_INBOX_UNREAD_SHORTCUT || name === CHAT_INBOX_BIG_TEAMS_DIVIDER || type === 'XCUIElementTypeTabBar') {
      covers.push(span)
    } else if ((type === 'XCUIElementTypeStaticText' || type === 'XCUIElementTypeButton') && label) {
      texts.push({label, span})
    }
  }
  for (const g of gears) {
    const mid = (g.top + g.bottom) / 2
    const near = texts
      .filter(t => overlaps(t.span, g))
      .sort((x, y) => Math.abs((x.span.top + x.span.bottom) / 2 - mid) - Math.abs((y.span.top + y.span.bottom) / 2 - mid))
    items.push({kind: 'header', span: g, team: near[0]?.label})
  }
  const signature = items.map(i => `${i.kind}:${i.kind === 'header' ? (i.team ?? '') : i.label}`).join('\n')
  return {covers, items, signature}
}

// The labels of the items an open bottom sheet shows, read off one page source: the visible labelled
// elements of type Other whose middles lie inside the sheet ("Bottom Sheet") and the window, in
// document order. Undefined when no sheet is visible.
export const sheetItemLabels = (els: ReadonlyArray<SourceElement>): Array<string> | undefined => {
  const app = els.find(e => e.type === 'XCUIElementTypeApplication')
  const sheet = els.find(e => e.attrs['label'] === 'Bottom Sheet' && e.attrs['visible'] === 'true')
  const span = sheet && spanOf(sheet.attrs)
  if (!span) return undefined
  const bottom = Math.min(span.bottom, app ? Number(app.attrs['height']) || Infinity : Infinity)
  const out: Array<string> = []
  for (const {attrs, type} of els) {
    const label = attrs['label']
    if (type !== 'XCUIElementTypeOther' || !label || label === 'Bottom Sheet' || attrs['visible'] !== 'true') continue
    const s = spanOf(attrs)
    if (!s) continue
    const mid = (s.top + s.bottom) / 2
    if (mid >= span.top && mid <= bottom) out.push(label)
  }
  return out
}

// The part of the inbox list rows are seen through: the list less what floats over it (the floating
// Big teams divider, the unread shortcut, the tab bar). A cover over the lower half of the list cuts
// the band above it, one over the upper half below it; one off the list changes nothing.
export const visibleBand = (list: Span, covers: ReadonlyArray<Span>): Span => {
  const mid = (list.top + list.bottom) / 2
  let {bottom, top} = list
  for (const c of covers) {
    if (c.top >= list.bottom || c.bottom <= list.top) continue
    if ((c.top + c.bottom) / 2 >= mid) bottom = Math.min(bottom, c.top)
    else top = Math.max(top, c.bottom)
  }
  return {bottom, top}
}

// Whether a row sits wholly in the band, at least `margin` points inside both its edges.
export const wholly = (row: Span, band: Span, margin: number) =>
  row.top >= band.top + margin && row.bottom <= band.bottom - margin

// How far to drag the inbox (positive: the content down) to bring a row partly out of the band into
// it, with some room past the margin; 0 for a row already wholly in it.
export const shiftIntoBand = (row: Span, band: Span, margin: number) => {
  if (row.top < band.top + margin) return band.top + margin * 4 - row.top
  if (row.bottom > band.bottom - margin) return band.bottom - margin * 4 - row.bottom
  return 0
}

// Whether `frame` has a size and lies wholly inside `rect` (to within a point: XCUITest rounds frames
// to whole points), and on a screen `screenHeight` tall when given: where a tap at its middle lands on it.
export const frameInside = (frame: Rect, rect: Rect, screenHeight = Infinity) =>
  frame.width > 0 &&
  frame.height > 0 &&
  frame.x >= rect.x - 1 &&
  frame.y >= rect.y - 1 &&
  frame.x + frame.width <= rect.x + rect.width + 1 &&
  frame.y + frame.height <= rect.y + rect.height + 1 &&
  frame.y >= 0 &&
  frame.y + frame.height <= screenHeight

// The index of the drawn big team header of `team`, by its exact name, or undefined when none is
// drawn. A header whose name was not read is never it. Throws when more than one header matches.
export const findInboxHeader = (items: ReadonlyArray<DrawnInboxItem>, team: string) => {
  const found = items.flatMap((item, i) => (item.kind === 'header' && !!team && item.team === team ? [i] : []))
  if (found.length > 1) throw new Error(`more than one inbox team header matches the team asked for (${found.length} drawn)`)
  return found[0]
}

// A rectangle in window points.
export type Rect = {height: number; width: number; x: number; y: number}

// XCUITest rounds frames to whole points, so a text can read a point past the box that holds it
const ROUNDING = 1
const contains = (outer: Rect, inner: Rect) =>
  outer.x <= inner.x + ROUNDING &&
  outer.y <= inner.y + ROUNDING &&
  outer.x + outer.width + ROUNDING >= inner.x + inner.width &&
  outer.y + outer.height + ROUNDING >= inner.y + inner.height

// The indexes of the rects that hold no other rect of the list: where several nested elements expose
// the same label (a pressable box and its text), the innermost is the one drawn. Two rects within
// ROUNDING of each other each contain the other: the smaller area is the inner one, and of equal areas
// (the same frame, a text in a text, or one shifted by the rounding) the first stands for both.
export const innermost = (rects: ReadonlyArray<Rect>) => {
  const area = (r: Rect) => r.width * r.height
  // whether `o` (at j) is inside `r` (at i), so `r` is not the innermost
  const holds = (r: Rect, i: number, o: Rect, j: number) => {
    if (j === i || !contains(r, o)) return false
    if (!contains(o, r)) return true
    return area(o) < area(r) || (area(o) === area(r) && j < i)
  }
  return rects.flatMap((r, i) => (rects.some((o, j) => holds(r, i, o, j)) ? [] : [i]))
}

// The inbox search's name hits among `matches` (rects of elements that read the asked-for text): those
// below the "Chats" section's header and above the next section's header, if one is drawn below it.
// The other sections (open teams, bots, messages) can show the same conversation again.
export const inNameSection = (matches: ReadonlyArray<Rect>, chatsHeader: Rect, laterHeaders: ReadonlyArray<Rect>) => {
  const top = chatsHeader.y + chatsHeader.height
  const bottom = Math.min(Infinity, ...laterHeaders.filter(h => h.y >= top).map(h => h.y))
  return matches.flatMap((m, i) => {
    const mid = m.y + m.height / 2
    return mid > top && mid < bottom ? [i] : []
  })
}

// The info panel choice a group's notification settings stand for, as the service keys them
// (NotificationKind generic '0', atmention '1'): on any activity, only when @mentioned, or never.
type NotifyKinds = Record<string, boolean> | null | undefined
export const notifyChoiceOf = (kinds: NotifyKinds): 'never' | 'onAnyActivity' | 'onWhenAtMentioned' =>
  kinds?.['0'] ? 'onAnyActivity' : kinds?.['1'] ? 'onWhenAtMentioned' : 'never'

// The index of the one rect of `rects` whose middle lies inside `row`: a testID repeated once per row
// (a row's menu button), as drawn in that row. Throws when none or more than one does; `what` names it.
export const inRow = (row: Rect, rects: ReadonlyArray<Rect>, what: string) => {
  const inside = rects.flatMap((r, i) => {
    const x = r.x + r.width / 2
    const y = r.y + r.height / 2
    return x >= row.x && x <= row.x + row.width && y >= row.y && y <= row.y + row.height ? [i] : []
  })
  if (inside.length !== 1) throw new Error(`${inside.length} of ${what} in the row, not one`)
  return inside[0]!
}

// `e`'s frame in window points, or undefined when it has none (it left the tree). Reads the screen
// through `browser`.
export const rectOf = async (e: WebdriverIO.Element): Promise<Rect | undefined> => {
  const at = await e.getLocation().catch(() => undefined)
  const size = await e.getSize().catch(() => undefined)
  return at && size ? {...at, ...size} : undefined
}

// The element with `testID` drawn inside the row at `rowRect` (window points), of those the testID
// repeats on, one per row. Throws when none or more than one lies in it.
export const elementInRow = async (rowRect: Rect, testID: string) => {
  const found: Array<{e: WebdriverIO.Element; rect: Rect}> = []
  for (const e of await browser.$$(`~${testID}`).getElements()) {
    const rect = await rectOf(e)
    if (rect) found.push({e, rect})
  }
  return found[inRow(rowRect, found.map(f => f.rect), testID)]!.e
}

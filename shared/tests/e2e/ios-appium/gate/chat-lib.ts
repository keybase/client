// Pure pieces of the iOS chat helpers (helpers/chat.ts), kept apart so they can be unit-tested.
import {isDeepStrictEqual} from 'util'

// Whether an inbox row's accessibility label is the row of `name`. A small conversation's row reads
// "<name>, <time>, <snippet>", so the name is its whole first field (a name holding ", " spans
// several): a row of a longer name that starts with `name` is not it. A big team's channel row reads
// "# <channel>" and is asked for as "#<channel>".
export const inboxRowMatches = (label: string, name: string) => {
  if (!name) return false
  const l = label.replace(/^# /, '#')
  return l === name || l.startsWith(`${name}, `)
}

// Whether a forward picker result's accessibility label is the conversation named `name`: the row
// reads its avatars' labels, if any, then the name, each a field of its own, so a longer name that
// holds `name` is not it.
export const forwardResultMatches = (label: string, name: string) => !!name && label.split(', ').includes(name)

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

// The index of the drawn row named `name` (inboxRowMatches), or undefined when none is drawn. A
// "#channel" is looked for only among the channel rows of `team`'s section, so a same-named channel
// of another team is never it; any other name only among small conversation rows. Rows above the
// first drawn header are in the `carried` team's section (carriedTeam of the drawing before the
// last drag); an unknown carried team is no team's. Throws when more than one row matches.
export const findInboxRow = (
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
  if (found.length > 1) throw new Error(`more than one inbox row matches the name asked for (${found.length} drawn)`)
  return found[0]
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

// The index of the drawn big team header of `team`, by its exact name, or undefined when none is
// drawn. A header whose name was not read is never it. Throws when more than one header matches.
export const findInboxHeader = (items: ReadonlyArray<DrawnInboxItem>, team: string) => {
  const found = items.flatMap((item, i) => (item.kind === 'header' && !!team && item.team === team ? [i] : []))
  if (found.length > 1) throw new Error(`more than one inbox team header matches the team asked for (${found.length} drawn)`)
  return found[0]
}

// A rectangle in window points.
export type Rect = {height: number; width: number; x: number; y: number}

const contains = (outer: Rect, inner: Rect) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height

// The indexes of the rects that hold no other rect of the list: where several nested elements expose
// the same label (a pressable box and its text), the innermost is the one drawn.
export const innermost = (rects: ReadonlyArray<Rect>) =>
  rects.flatMap((r, i) => (rects.some((o, j) => j !== i && contains(r, o) && !contains(o, r)) ? [] : [i]))

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
export type NotifyKinds = Record<string, boolean> | null | undefined
export const notifyChoiceOf = (kinds: NotifyKinds): 'never' | 'onAnyActivity' | 'onWhenAtMentioned' =>
  kinds?.['0'] ? 'onAnyActivity' : kinds?.['1'] ? 'onWhenAtMentioned' : 'never'

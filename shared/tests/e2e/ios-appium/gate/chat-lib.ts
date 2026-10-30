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

// Why a value read back after a relaunch is not the one wanted, or undefined when it is.
export const persistedMismatch = (what: string, got: unknown, want: unknown) =>
  isDeepStrictEqual(got, want) ? undefined : `${what} after a relaunch: ${JSON.stringify(got)}, want ${JSON.stringify(want)}`

// A vertical stretch of the window, in window points.
export type Span = {bottom: number; top: number}

// What the inbox draws, top to bottom: small conversation rows, big team channel rows, and big team
// headers (`ours`: the header of KB_E2E_TEAM). A channel row belongs to the nearest header above it.
export type DrawnInboxItem =
  | {kind: 'small'; label: string; span: Span}
  | {kind: 'channel'; label: string; span: Span}
  | {kind: 'header'; ours: boolean; span: Span}

// The index of the drawn row named `name` (inboxRowMatches), or undefined when none is drawn. A
// "#channel" is looked for only among the channel rows of KB_E2E_TEAM's section, so a same-named
// channel of another team is never it; any other name only among small conversation rows.
// `carriedOurs`: whether the section that runs on above the first drawn header is KB_E2E_TEAM's
// (sectionAfter of the drawing before the last scroll down). Throws when more than one row matches.
export const findInboxRow = (items: ReadonlyArray<DrawnInboxItem>, name: string, carriedOurs: boolean) => {
  const wantChannel = name.startsWith('#')
  const sorted = items.map((item, i) => ({i, item})).sort((a, b) => a.item.span.top - b.item.span.top)
  let ours = carriedOurs
  const found: Array<number> = []
  for (const {i, item} of sorted) {
    if (item.kind === 'header') {
      ours = item.ours
      continue
    }
    if (wantChannel !== (item.kind === 'channel') || (wantChannel && !ours)) continue
    if (inboxRowMatches(item.label, name)) found.push(i)
  }
  if (found.length > 1) throw new Error(`more than one inbox row matches the name asked for (${found.length} drawn)`)
  return found[0]
}

// Whether the section that runs on below the drawn rows is KB_E2E_TEAM's: the lowest drawn header's,
// or the carried one when no header is drawn.
export const sectionAfter = (items: ReadonlyArray<DrawnInboxItem>, carriedOurs: boolean) => {
  let lowest: {ours: boolean; top: number} | undefined
  for (const item of items) {
    if (item.kind === 'header' && (!lowest || item.span.top > lowest.top)) lowest = {ours: item.ours, top: item.span.top}
  }
  return lowest ? lowest.ours : carriedOurs
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

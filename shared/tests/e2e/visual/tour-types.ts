import type {SealField} from './seal.mts'

export type Platform = 'desktop' | 'phone'
export type Theme = 'light' | 'dark'
export type SetupStep =
  | {kind: 'openPopup'; testID: string}
  | {kind: 'switchSubTab'; testID: string}
  | {kind: 'scrollIntoView'; testID: string}
  | {kind: 'hover'; testID: string} // desktop only
export type Mask = {testID: string; reason: string}
export type ParamRef = {
  ref: 'teamID' | 'teamname' | 'teamFolder' | 'privateFolder' | 'username' | 'secondUser' | 'conversationIDKey' | 'deviceID'
  channel?: string
  // a path under teamFolder or privateFolder
  sub?: string
}
// Navigation is data, never code: a tab plus an optional route to append, so a tour entry can't
// call arbitrary app functions. `tab` is a name from constants/tabs.tsx (e.g. 'tabs.chatTab'); the
// driver maps it to switchTab, `append` to navigateAppend({name, params}), and `thread` (a
// conversationIDKey ref) to navigateToThread, the path an inbox row click takes: desktop selects the
// conversation beside the inbox, phone pushes it.
// A param value: a literal, a ref, or plain objects and arrays of them (a route whose param is a
// state object, like the team wizards').
export type ParamValue = ParamRef | string | number | boolean | null | ReadonlyArray<ParamValue> | {readonly [k: string]: ParamValue}
export type Nav = {
  tab: string
  append?: {name: string; params?: Record<string, ParamValue>}
  thread?: ParamRef
}
export type TourEntry = {
  id: string
  nav: Nav
  ready: string // testID that must be visible once navigation and setup are done
  platforms: ReadonlyArray<Platform>
  setup?: ReadonlyArray<SetupStep>
  masks?: ReadonlyArray<Mask>
  seal: ReadonlyArray<SealField>
  // Desktop: setup opens a popup that is no route (a floating menu), so it stays open while its
  // screen stays mounted, which survives Escape and a tab switch. The desktop reset pops only the
  // next entry's tab, so the next desktop entry must reset this one's: the same tab, and on chat
  // another conversation (the chat root keeps the thread). See popupFollowerProblems. iOS needs no
  // follower: its reset pops the current tab's stack before switching, unmounting the popup's owner.
  leavesPopup?: true
}

const sameRef = (a: ParamRef | undefined, b: ParamRef | undefined) =>
  a?.ref === b?.ref && a?.channel === b?.channel && a?.sub === b?.sub

// The desktop entry captured after each entry: the next one, or the first after the last (aa and
// gate capture the list again from the top).
export const nextDesktopEntry = (entries: ReadonlyArray<TourEntry>, e: TourEntry): TourEntry | undefined => {
  const on = entries.filter(x => x.platforms.includes('desktop'))
  const i = on.indexOf(e)
  return i < 0 || on.length < 2 ? undefined : on[(i + 1) % on.length]
}

// Desktop entries that leave a popup open without a follower that closes it.
export const popupFollowerProblems = (entries: ReadonlyArray<TourEntry>): Array<string> => {
  const problems: Array<string> = []
  for (const e of entries) {
    if (!e.leavesPopup || !e.platforms.includes('desktop')) continue
    const next = nextDesktopEntry(entries, e)
    if (!next) {
      problems.push(`${e.id}: leaves a popup open and no desktop entry follows it`)
    } else if (next.nav.tab !== e.nav.tab) {
      problems.push(`${e.id}: leaves a popup open on ${e.nav.tab}, but ${next.id} resets ${next.nav.tab}`)
    } else if (e.nav.thread && (!next.nav.thread || sameRef(next.nav.thread, e.nav.thread))) {
      problems.push(`${e.id}: leaves a popup open in its conversation, but ${next.id} opens no other conversation`)
    }
  }
  return problems
}

export const SETUP_KINDS: ReadonlySet<string> = new Set(['openPopup', 'switchSubTab', 'scrollIntoView', 'hover'])

export function validateEntry(e: TourEntry): Array<string> {
  const problems: Array<string> = []
  if (!e.id) problems.push('entry has no id')
  if (!e.ready) problems.push(`${e.id}: ready testID is empty`)
  if (!e.nav.tab) problems.push(`${e.id}: nav.tab is empty`)
  if (e.nav.append && e.nav.thread) problems.push(`${e.id}: nav has both append and thread`)
  if (e.nav.thread && e.nav.thread.ref !== 'conversationIDKey') {
    problems.push(`${e.id}: nav.thread must be a conversationIDKey ref`)
  }
  if (e.platforms.length === 0) problems.push(`${e.id}: no platforms`)
  for (const s of e.setup ?? []) {
    if (!SETUP_KINDS.has(s.kind)) {
      problems.push(`${e.id}: setup step '${s.kind}' is not allowed`)
      continue
    }
    if (s.kind === 'hover' && e.platforms.includes('phone')) problems.push(`${e.id}: hover is desktop only`)
    if (!s.testID) problems.push(`${e.id}: setup step '${s.kind}' needs a testID`)
  }
  for (const m of e.masks ?? []) {
    if (!m.reason.trim()) problems.push(`${e.id}: mask ${m.testID} needs a reason`)
  }
  return problems
}

export function matchEntries(entries: ReadonlyArray<TourEntry>, pattern: string): Array<TourEntry> {
  if (!pattern.includes('*')) return entries.filter(e => e.id === pattern)
  const re = new RegExp(
    '^' +
      pattern
        .split('*')
        .map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$'
  )
  return entries.filter(e => re.test(e.id))
}

import type {SealField} from './seal.mts'
import {FIXTURES, isFixtureName} from './fixtures/names.ts'
import * as TID from '../shared/test-ids.ts'

export type Platform = 'desktop' | 'phone'
export type Theme = 'light' | 'dark'
export type SetupStep =
  | {kind: 'openPopup'; testID: string}
  | {kind: 'switchSubTab'; testID: string}
  | {kind: 'scrollIntoView'; testID: string}
  | {kind: 'hover'; testID: string} // desktop only
  // presses a control that only changes what this screen shows (CLICK_TARGETS)
  | {kind: 'click'; testID: string}
  // types into a local input (TYPE_TARGETS); `enter` presses Enter after it, only where Enter
  // stays local (ENTER_TARGETS)
  | {kind: 'type'; testID: string; text: string; enter?: true}
  // opens the open conversation's thread search on a query, as its search field would: a route
  // param, the way the app opens it
  | {kind: 'searchThread'; query: string}

// The tour never sends, saves, confirms or deletes anything. A click or type step may only target a
// control listed here, each one checked to change nothing but the screen's own state: no RPC that
// writes, nothing kept after the screen goes. Add to these only after reading what the control does.
export const CLICK_TARGETS: ReadonlySet<string> = new Set([
  // expands the emoji picker's skin tones; picking one would save it, which no step does
  TID.CHAT_SKIN_TONE_BUTTON,
  // opens the unpin prompt; the testID is only there while the click asks first
  TID.CHAT_PINNED_UNPIN,
  // adds an unsaved new folder row; nothing is made until its Create button
  TID.FILES_NEW_FOLDER,
  // selects a member for the bulk actions bar
  TID.TEAMS_MEMBER_CHECK,
])
export const TYPE_TARGETS: ReadonlySet<string> = new Set([
  // the unsaved new folder row's name; its Enter would make the folder
  TID.FILES_EDITING_ROW,
  // thread search's field; its Enter searches
  TID.CHAT_THREAD_SEARCH_INPUT,
])
export const ENTER_TARGETS: ReadonlySet<string> = new Set([TID.CHAT_THREAD_SEARCH_INPUT])
export type Mask = {testID: string; reason: string}
export type ParamRef = {
  ref:
    | 'teamID'
    | 'teamname'
    | 'teamFolder'
    | 'privateFolder'
    | 'otherPrivateFolder'
    | 'username'
    | 'secondUser'
    | 'conversationIDKey'
    | 'deviceID'
  channel?: string
  // a path under teamFolder, privateFolder or otherPrivateFolder
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
// The app's other windows, each its own renderer (desktop/remote). An entry with a window captures
// that window instead of the main one; the main window is only reset to nav.tab. The driver opens
// the window through the main window's preload functions and remote actions, as the app does:
//   menubar         the tray widget. The main window's proxy (menubar/remote-proxy) already sends
//                   its props; the driver only makes the window (the e2e launch has no tray).
//   pinentry,       open only on a service request (secretUi.getPassphrase, rekeyUI.refresh), so
//   unlock-folders  the driver sends `props` itself, standing in for the proxy.
//   tracker         a trackerLoad remote action with forceDisplay, as the tracker's own reload
//                   button sends: the proxy identifies `username` and opens the window.
// `size` is the window's content size, which the capture emulates like the main viewport.
export type WindowSize = {width: number; height: number}
export type RemoteWindow =
  | {component: 'menubar'; size: WindowSize}
  | {component: 'pinentry' | 'unlock-folders'; size: WindowSize; props: {readonly [k: string]: ParamValue}}
  | {component: 'tracker'; size: WindowSize; username: ParamRef; reason: string}
// A dev-only fixture (fixtures/) the app runs while the entry is captured: server-picked content
// replaced with data the fixture supplies. `args` are params like nav's, refs resolved first.
export type EntryFixture = {name: string; args?: {readonly [k: string]: ParamValue}}
export type TourEntry = {
  id: string
  nav: Nav
  fixture?: EntryFixture
  window?: RemoteWindow
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

// Fixture entries run after every live entry, so a fixture that leaks can't change a live capture.
export const fixtureOrderProblems = (entries: ReadonlyArray<TourEntry>): Array<string> => {
  const problems: Array<string> = []
  for (const platform of ['desktop', 'phone'] as const) {
    const on = entries.filter(e => e.platforms.includes(platform))
    const first = on.findIndex(e => e.fixture)
    if (first < 0) continue
    for (const e of on.slice(first)) {
      if (!e.fixture) problems.push(`${e.id} (${platform}): a live entry after the fixture entry ${on[first]!.id}`)
    }
  }
  return problems
}

export const SETUP_KINDS: ReadonlySet<string> = new Set(['openPopup', 'switchSubTab', 'scrollIntoView', 'hover', 'click', 'type', 'searchThread'])

const stepProblems = (e: TourEntry, s: SetupStep): Array<string> => {
  switch (s.kind) {
    case 'searchThread':
      if (!s.query) return [`${e.id}: searchThread needs a query`]
      if (!e.nav.thread) return [`${e.id}: searchThread needs a conversation opened with nav.thread`]
      return []
    case 'click':
      if (!CLICK_TARGETS.has(s.testID)) return [`${e.id}: click ${s.testID} is not in CLICK_TARGETS`]
      return []
    case 'type': {
      const problems: Array<string> = []
      if (!TYPE_TARGETS.has(s.testID)) problems.push(`${e.id}: type into ${s.testID} is not in TYPE_TARGETS`)
      if (/[\r\n]/.test(s.text)) problems.push(`${e.id}: type text has a line break; use enter, where allowed`)
      if (s.enter && !ENTER_TARGETS.has(s.testID)) problems.push(`${e.id}: Enter in ${s.testID} is not in ENTER_TARGETS`)
      return problems
    }
    case 'hover':
      return e.platforms.includes('phone') ? [`${e.id}: hover is desktop only`] : []
    case 'openPopup':
    case 'switchSubTab':
    case 'scrollIntoView':
      return []
  }
}

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
    if (s.kind !== 'searchThread' && !s.testID) problems.push(`${e.id}: setup step '${s.kind}' needs a testID`)
    problems.push(...stepProblems(e, s))
  }
  for (const m of e.masks ?? []) {
    if (!m.reason.trim()) problems.push(`${e.id}: mask ${m.testID} needs a reason`)
  }
  if (e.fixture) {
    const {name} = e.fixture
    if (!isFixtureName(name)) problems.push(`${e.id}: unknown fixture ${name}`)
    // the fixture replaces what a mask would hide, so the entry is compared and counts for coverage
    else if (!(FIXTURES[name].ready as ReadonlyArray<string>).includes(e.ready)) {
      problems.push(`${e.id}: ready ${e.ready} is not a testID only fixture ${name}'s state shows (${FIXTURES[name].ready.join(', ')})`)
    }
    if (e.masks?.length) problems.push(`${e.id}: a fixture entry has no masks`)
    if (e.window) problems.push(`${e.id}: a window entry runs no fixture`)
  }
  if (e.window) {
    if (e.platforms.some(p => p !== 'desktop')) problems.push(`${e.id}: a window entry is desktop only`)
    if (e.nav.append || e.nav.thread) problems.push(`${e.id}: a window entry only resets the main window to nav.tab`)
    // the window closes after the capture, and its popup with it
    if (e.leavesPopup) problems.push(`${e.id}: a window entry leaves no popup open`)
    const {width, height} = e.window.size
    if (!(width > 0 && height > 0)) problems.push(`${e.id}: window size must be positive`)
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

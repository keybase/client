// Where the thread should be scrolled right now. decideScroll is pure: each list adapter reports what
// happened as an event, gets back one directive, and carries it out with its own measuring and
// correcting. The decision rules live here once; how a list reaches the end or a centred row stays
// with that list.
import * as React from 'react'
import type * as T from '@/constants/types'
import sortedIndexOf from 'lodash/sortedIndexOf'

// The centring bookkeeping below belongs to the current dataset: a centred load clears the thread and
// refills it under a new key, and that is a new list as far as scrolling is concerned.
export type ScrollTargetState = {
  // Whether the end still belongs to the list (hold the newest message in view) or to the reader,
  // who took it by scrolling away or by asking for a centred target. Nothing that scrolls to the end
  // on the list's own account may yank a reader who holds it.
  endOwner: 'list' | 'reader'
  // The last header size the list reported, whatever the dataset. The list reports the header only
  // when its size changes, never for a new dataset, so the size from before a clear is still the one
  // the new dataset builds its position on: only a later, different size counts as growth.
  headerSize: number | undefined
  // The target already centred in this dataset. Centring happens once per target: scrolling up
  // prepends older messages, which moves the target's index, and re-centring on that would pull
  // the reader back to the hit. Per dataset, not per conversation: re-centring on the ordinal we
  // are already parked on still reloads the thread, so the list has to scroll to it again.
  lastCentered: T.Chat.Ordinal | undefined
  // Whether the list's centring of that target is still under way. It ends when the list reports it
  // settled, and when the reader leaves the target (a wheel, a drag, asking for the bottom). A list
  // hidden while it is under way has its centring cut short, and centres the target afresh.
  settlingCenter: boolean
  // The edit already revealed. Deliberately survives a dataset change.
  lastEditing: T.Chat.Ordinal | undefined
}

// Every list reports the events it can observe, from one vocabulary. Most come from both lists; the
// few that do not say which list reports them and why the other has nothing to report.
export type ScrollEvent =
  // The list laid out a dataset other than the one it last saw.
  | {type: 'datasetChanged'}
  // The level-triggered centre reconcile, sent whenever the centre request or the loaded rows change:
  // it starts centring once the target is loaded, and ends it. targetInData says whether the centred
  // ordinal is in the loaded rows.
  | {
      type: 'threadObserved'
      centeredOrdinal: T.Chat.Ordinal | undefined
      loaded: boolean
      targetInData: boolean
    }
  // The list's own centring finished with the target: it reached the middle, was pinned against an
  // edge, or ran out of tries.
  | {type: 'centerSettled'}
  // The list stopped being shown (hidden under another screen or tab, or unmounted) and dropped
  // everything it had scheduled.
  | {type: 'detached'}
  // A conversation finished its first load, reported after the centre reconcile has seen the same
  // rows. Only a list with no declarative initial position reports it; the desktop list starts at its
  // end or on its target through its own props.
  | {type: 'initialLoad'; hasMessages: boolean}
  // The reader moved the list: anything that moved it other than the list itself (a touch drag; on the
  // desktop a wheel, a key, the scrollbar, autoscroll, find in page alike), or the composer's page keys
  // scrolling on their behalf. Only the desktop composer has page keys: the native one takes its keys
  // from an on-screen keyboard, which has none.
  | {type: 'userScrolled'}
  // The reader's scroll came to rest at the end. The list's own scrolls coming to rest there report
  // nothing.
  | {type: 'readerAtEnd'}
  // The header's size as the list measured it. Only a list whose header comes before its end in
  // scroll order reports it: the native list is inverted, so its header sits at the far, oldest end
  // and growing it never moves the newest.
  | {type: 'headerMeasured'; hasMessages: boolean; size: number}
  // Messages were appended. Only a list whose own anchoring can leave a new message out of view
  // reports it; anchorHidesNewest says whether it would this time. That is the native list with the
  // keyboard up, whose content-position anchor holds the old rows in place and so leaves a new one
  // behind the keyboard. Nothing covers the desktop list's end, and its maintainScrollAtEnd keeps
  // the newest message in view whenever the list is at its end.
  | {type: 'appended'; anchorHidesNewest: boolean}
  // Sent whenever the edit or the loaded rows change. rowFullyVisible says whether the edited row is
  // wholly in view, as each list measures it; measuring can force a layout, so it is asked only when
  // the decision turns on it.
  | {
      type: 'editingChanged'
      ordinal: T.Chat.Ordinal | undefined
      rowFullyVisible: () => boolean
      targetInData: boolean
    }
  // The reader asked for the newest messages: the composer, the keyboard or jump to recent.
  // centeredOrdinal is the centre request as it stands.
  | {type: 'scrollToBottomRequested'; centeredOrdinal: T.Chat.Ordinal | undefined}

// Every list carries out every directive; how is its own.
export type ScrollDirective =
  // Bring the newest message into view and hold it there. How, and when, is the list's own: it knows
  // what it can scroll now and what it must wait out.
  | {type: 'pinEnd'; stopCentering: boolean}
  // Bring the ordinal to the middle of the viewport and settle it there, measuring the rows as they
  // are at each step, so rows changing under it need no directive of their own. Its budget (steps,
  // time) is the target's, however often the rows change.
  | {type: 'center'; ordinal: T.Chat.Ordinal}
  // Bring the ordinal, not wholly in view, to the middle of the viewport.
  | {type: 'reveal'; ordinal: T.Chat.Ordinal}
  | {type: 'leaveAlone'; stopCentering: boolean}

export type ScrollDecision = {directive: ScrollDirective; state: ScrollTargetState}

export const initialScrollTargetState: ScrollTargetState = {
  endOwner: 'list',
  headerSize: undefined,
  lastCentered: undefined,
  lastEditing: undefined,
  settlingCenter: false,
}

const leaveAlone: ScrollDirective = {stopCentering: false, type: 'leaveAlone'}
const pinEnd: ScrollDirective = {stopCentering: false, type: 'pinEnd'}

export const decideScroll = (state: ScrollTargetState, event: ScrollEvent): ScrollDecision => {
  switch (event.type) {
    case 'datasetChanged':
      // The end and the centred target start over with a new dataset; the header does not. A
      // centring under way belongs to the old rows, so it stops: a target still wanted is centred
      // again once it is in the new ones, and one cleared in the same commit (jump to recent) would
      // otherwise go on pulling the reader toward it.
      return {
        directive: {stopCentering: true, type: 'leaveAlone'},
        state: {
          ...state,
          endOwner: 'list',
          lastCentered: undefined,
          settlingCenter: false,
        },
      }
    case 'threadObserved': {
      const {centeredOrdinal, loaded, targetInData} = event
      if (centeredOrdinal === undefined) {
        if (state.lastCentered === undefined) return {directive: leaveAlone, state}
        // Leaving a centred target stops centring and leaves the reader where they are, and the end
        // with whoever holds it: the reader, unless they asked for the bottom.
        return {
          directive: {stopCentering: true, type: 'leaveAlone'},
          state: {...state, lastCentered: undefined, settlingCenter: false},
        }
      }
      // Centring happens once per target and dataset.
      const newTarget = state.lastCentered !== centeredOrdinal
      if (!loaded || !targetInData) {
        // A centre takes the end from the list as soon as it is requested, as it turns the list's own
        // end anchor off (listAnchorsEnd): nothing may scroll to the end on the list's account while
        // the target is on its way.
        return {directive: leaveAlone, state: newTarget ? {...state, endOwner: 'reader'} : state}
      }
      if (!newTarget) return {directive: leaveAlone, state}
      return {
        directive: {ordinal: centeredOrdinal, type: 'center'},
        state: {...state, endOwner: 'reader', lastCentered: centeredOrdinal, settlingCenter: true},
      }
    }
    case 'centerSettled':
      // Settled like a wheel or a drag leaves it: later changes to the rows around the target leave it be.
      return {directive: leaveAlone, state: {...state, settlingCenter: false}}
    case 'detached':
      // A target still settling had its move cut short, so if the list comes back it is new again.
      return {
        directive: {stopCentering: true, type: 'leaveAlone'},
        state: state.settlingCenter ? {...state, lastCentered: undefined, settlingCenter: false} : state,
      }
    case 'initialLoad':
      // A centred load is left to the centre reconcile, whose request has taken the end, and so is a
      // reader who has taken it.
      return {
        directive: event.hasMessages && state.endOwner === 'list' ? pinEnd : leaveAlone,
        state,
      }
    case 'userScrolled':
      // However the reader scrolls, and whichever way, they have taken over: centring stops rather
      // than pull them back, and the end is theirs until a scroll comes to rest there (readerAtEnd).
      return {
        directive: {stopCentering: true, type: 'leaveAlone'},
        state: {...state, endOwner: 'reader', settlingCenter: false},
      }
    case 'readerAtEnd':
      return {directive: leaveAlone, state: {...state, endOwner: 'list'}}
    case 'headerMeasured': {
      const previous = state.headerSize
      const next = {...state, headerSize: event.size}
      if (previous === undefined || previous === event.size) return {directive: leaveAlone, state: next}
      // The header frequently settles while the thread is still empty, and there is no end to hold yet.
      if (state.endOwner !== 'list' || !event.hasMessages) return {directive: leaveAlone, state: next}
      return {directive: pinEnd, state: next}
    }
    case 'appended':
      // Only an end the list holds is re-pinned: a reader in history, or on a centred target, stays.
      return {
        directive: event.anchorHidesNewest && state.endOwner === 'list' ? pinEnd : leaveAlone,
        state,
      }
    case 'editingChanged': {
      const {ordinal, rowFullyVisible, targetInData} = event
      if (state.lastEditing === ordinal) return {directive: leaveAlone, state}
      if (!ordinal) return {directive: leaveAlone, state: {...state, lastEditing: ordinal}}
      // An edit whose row is not loaded waits for it: the list reports again as its rows change.
      if (!targetInData) return {directive: leaveAlone, state}
      // A row already in view stays where it is: bringing it to the middle would only move the list
      // off its end.
      if (rowFullyVisible()) return {directive: leaveAlone, state: {...state, lastEditing: ordinal}}
      // Any other reveal moves the list, off its end if it was there, and leaves the reader on the
      // edited message as their own scroll would: nothing may scroll back to the end on the list's
      // account.
      return {directive: {ordinal, type: 'reveal'}, state: {...state, endOwner: 'reader', lastEditing: ordinal}}
    }
    case 'scrollToBottomRequested':
      // The reader has left the target as surely as with a drag. It stays centred until the thread
      // reconcile sees the centre cleared, but nothing may pull the reader back to it meanwhile, not
      // even its arrival: a target still loading counts as centred already.
      return {
        directive: {stopCentering: true, type: 'pinEnd'},
        state: {...state, endOwner: 'list', lastCentered: event.centeredOrdinal, settlingCenter: false},
      }
  }
}

export const ownsEnd = (state: ScrollTargetState) => state.endOwner === 'list'

// One list's scroll target: its state, moved only by the decisions it makes. The list adapters and
// the test driver each drive one.
export type ScrollTarget = {
  decide: (event: ScrollEvent) => ScrollDirective
  readonly state: ScrollTargetState
}

export const makeScrollTarget = (): ScrollTarget => {
  let state = initialScrollTargetState
  return {
    decide: event => {
      const decision = decideScroll(state, event)
      state = decision.state
      return decision.directive
    },
    get state() {
      return state
    },
  }
}

// The list's scroll target for as long as it is mounted. Its identity never changes, so the list's
// own loops can report back to it while the directives they carry out come from it too.
export const useScrollTarget = () => React.useState(makeScrollTarget)[0]

// Ordinals are sorted oldest first; -1 when the ordinal is not loaded.
export const indexOfOrdinal = (ordinals: ReadonlyArray<T.Chat.Ordinal>, ordinal: T.Chat.Ordinal) =>
  sortedIndexOf(ordinals as unknown as Array<number>, ordinal as unknown as number)

// Where a freshly laid out dataset starts: on the centred target when it is loaded, otherwise at
// the end.
export const initialScrollTarget = (
  ordinals: ReadonlyArray<T.Chat.Ordinal>,
  centeredOrdinal: T.Chat.Ordinal | undefined
) => {
  const index = centeredOrdinal !== undefined ? indexOfOrdinal(ordinals, centeredOrdinal) : -1
  return index >= 0 ? ({index, viewPosition: 0.5} as const) : undefined
}

// The list's own end anchor holds the newest message in view. It stays off while a target is
// centred, even one that is not loaded, so new messages don't pull the reader away from it, and
// while the thread holds a window of history without the newest message, whose end is only the
// newest row loaded: a page of newer rows landing there would carry the reader along with it.
// heldLatest is whether the rows now shown are held at the newest message (useHeldLatest), so the
// page that brings the newest message lands as a page too.
export const listAnchorsEnd = (centeredOrdinal: T.Chat.Ordinal | undefined, heldLatest: boolean) =>
  centeredOrdinal === undefined && heldLatest

// Whether the rows now shown hold the newest message as a thread that already held it: false for the
// page of newer rows that brings it into a window of history, which is laid out as the page it is,
// and true again from the next rows on. Rows refilling a cleared thread, or a new dataset, are no
// window of history, so they are held at once. Decided from the rows themselves, once per change to
// them, so it holds however React schedules the render.
export const useHeldLatest = (containsLatest: boolean, datasetKey: string, rows: ReadonlyArray<unknown>) => {
  const [seen, setSeen] = React.useState({containsLatest, datasetKey, heldLatest: containsLatest, rows})
  if (seen.rows === rows && seen.datasetKey === datasetKey && seen.containsLatest === containsLatest) {
    return seen.heldLatest
  }
  const bringsLatest =
    containsLatest && !seen.containsLatest && seen.datasetKey === datasetKey && seen.rows.length > 0
  const next = {containsLatest, datasetKey, heldLatest: containsLatest && !bringsLatest, rows}
  setSeen(next)
  return next.heldLatest
}

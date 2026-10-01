// Where the thread should be scrolled right now. Each list adapter reports what happened as an event
// and carries out the one directive it gets back with its own measuring and correcting.
import type * as T from '@/constants/types'
import sortedIndexBy from 'lodash/sortedIndexBy'
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
  // The edit already revealed, or found in view. Deliberately survives a dataset change.
  lastEditing: T.Chat.Ordinal | undefined
  // Whether the list still holds that edit in view, where its reveal put it or where it already was:
  // either is judged against the viewport as it is when the edit starts, and the viewport changes
  // around an edit (the composer growing for it, the keyboard rising for it). Held until the reader
  // moves the list, the edit ends, or something else takes the list somewhere.
  holdingEdit: boolean
}

// Every list reports the events it can observe, from one vocabulary. Most come from both lists; the
// few that do not say which list reports them and why the other has nothing to report.
export type ScrollEvent =
  // The list laid out a dataset other than the one it last saw.
  | {type: 'datasetChanged'}
  // The level-triggered centre reconcile, sent whenever the centre request or the loaded rows change:
  // it starts centring once the target is loaded, and ends it. targetInData says whether the centred
  // ordinal is in the loaded rows. atNewest says whether the list rests at its end with the newest
  // message loaded; measuring can force a layout, so it is asked only when the centre clears.
  | {
      type: 'threadObserved'
      atNewest: () => boolean
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
  // rows, and again (retry) when a pin it decided asks for it. Only a list with no declarative initial
  // position reports it; the desktop list starts at its end or on its target through its own props.
  | {type: 'initialLoad'; hasMessages: boolean; retry: boolean}
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
  // The part of the list in view changed height: the composer growing or shrinking (typed lines, the
  // edit or reply banner), a window resize, the keyboard rising or falling over the list's bottom.
  // anchorsEnd is whether the list's own end anchor is on (listAnchorsEnd) and the end moves with the
  // viewport: the native list's end stays over the keyboard through its keyboard scroll view, so it
  // reports false. rowFullyVisible says whether the ordinal's row is wholly in view as the list now
  // measures it, asked only when the decision turns on it.
  | {type: 'viewportResized'; anchorsEnd: boolean; rowFullyVisible: (ordinal: T.Chat.Ordinal) => boolean}
  // A row changed size after the list laid it out (a late measure, a re-measure: an image or a font
  // landing). anchorsEnd as for viewportResized. Only a list whose end moves with its rows reports it:
  // the native list is inverted, so its newest row sits on its bottom edge and grows away from it.
  | {type: 'rowResized'; anchorsEnd: boolean}
  // Messages were appended. Only a list whose own anchoring can leave a new message out of view
  // reports it; anchorHidesNewest says whether it would this time. That is the native list with the
  // keyboard up, whose content-position anchor holds the old rows in place and so leaves a new one
  // behind the keyboard. Nothing covers the desktop list's end, and its maintainScrollAtEnd keeps
  // the newest message in view whenever the list is at its end.
  | {type: 'appended'; anchorHidesNewest: boolean}
  // Sent whenever the edit or the loaded rows change. rowFullyVisible says whether the edited row is
  // wholly in the part of the list in view (clear of the keyboard, on the native list) where the list
  // holds itself, as each list measures it: at its end while its own end anchor holds it there, which
  // keeps it there through a change to the viewport (the composer growing for this very edit) the list
  // may not have caught up with yet. Measuring can force a layout, so it is asked only when the
  // decision turns on it.
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
  // what it can scroll now and what it must wait out. verify: a size change moved the end, and the
  // list's own end anchor may already be re-pinning it, so confirm the end held once the list has
  // settled rather than scroll now. retry: report initialLoad again (retry: true) a moment later,
  // with the rows as they are then, so a centre requested in between is not undone by this pin.
  | {type: 'pinEnd'; retry: boolean; stopCentering: boolean; verify: boolean}
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
  holdingEdit: false,
  lastCentered: undefined,
  lastEditing: undefined,
  settlingCenter: false,
}

const leaveAlone: ScrollDirective = {stopCentering: false, type: 'leaveAlone'}
type PinEnd = Extract<ScrollDirective, {type: 'pinEnd'}>
const pinEnd: PinEnd = {retry: false, stopCentering: false, type: 'pinEnd', verify: false}
const verifyEnd: PinEnd = {...pinEnd, verify: true}

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
          holdingEdit: false,
          lastCentered: undefined,
          settlingCenter: false,
        },
      }
    case 'threadObserved': {
      const {centeredOrdinal, loaded, targetInData} = event
      if (centeredOrdinal === undefined) {
        if (state.lastCentered === undefined) return {directive: leaveAlone, state}
        // Leaving a centred target stops centring and leaves the list where it is, and the end with
        // whoever holds it: the reader, unless they asked for the bottom, or the list already rests at
        // the newest message, where new messages are followed as on any thread at its end.
        const endOwner = state.endOwner === 'reader' && event.atNewest() ? 'list' : state.endOwner
        return {
          directive: {stopCentering: true, type: 'leaveAlone'},
          state: {...state, endOwner, lastCentered: undefined, settlingCenter: false},
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
        state: {
          ...state,
          endOwner: 'reader',
          holdingEdit: false,
          lastCentered: centeredOrdinal,
          settlingCenter: true,
        },
      }
    }
    case 'centerSettled':
      // Settled like a wheel or a drag leaves it: later changes to the rows around the target leave it be.
      return {directive: leaveAlone, state: {...state, settlingCenter: false}}
    case 'detached': {
      // A target still settling had its move cut short, so if the list comes back it is new again. A
      // list coming back is laid out afresh, and holds no reveal.
      const next = state.holdingEdit ? {...state, holdingEdit: false} : state
      return {
        directive: {stopCentering: true, type: 'leaveAlone'},
        state: next.settlingCenter ? {...next, lastCentered: undefined, settlingCenter: false} : next,
      }
    }
    case 'initialLoad':
      // A centred load is left to the centre reconcile, whose request has taken the end, and so is a
      // reader who has taken it.
      if (!event.hasMessages || state.endOwner !== 'list') return {directive: leaveAlone, state}
      return {directive: event.retry ? pinEnd : {...pinEnd, retry: true}, state}
    case 'userScrolled':
      // However the reader scrolls, and whichever way, they have taken over: centring stops rather
      // than pull them back, and the end is theirs until a scroll comes to rest there (readerAtEnd).
      // It arrives on every scroll event, and most find it so already, with nothing left to stop.
      if (state.endOwner === 'reader' && !state.settlingCenter && !state.holdingEdit) {
        return {directive: leaveAlone, state}
      }
      return {
        directive: {stopCentering: true, type: 'leaveAlone'},
        state: {...state, endOwner: 'reader', holdingEdit: false, settlingCenter: false},
      }
    case 'readerAtEnd':
      return {directive: leaveAlone, state: {...state, endOwner: 'list'}}
    case 'headerMeasured': {
      const previous = state.headerSize
      const next = {...state, headerSize: event.size}
      if (previous === undefined || previous === event.size) return {directive: leaveAlone, state: next}
      // The header frequently settles while the thread is still empty, and there is no end to hold yet.
      if (state.endOwner !== 'list' || !event.hasMessages) return {directive: leaveAlone, state: next}
      return {directive: verifyEnd, state: next}
    }
    case 'viewportResized':
      // Whatever the list holds, it holds through the change: an edit in view, revealed again if the
      // change covered it, which moves the list off its end as any reveal does; otherwise its end,
      // while it owns the end.
      if (state.holdingEdit && state.lastEditing !== undefined && !event.rowFullyVisible(state.lastEditing)) {
        return {directive: {ordinal: state.lastEditing, type: 'reveal'}, state: {...state, endOwner: 'reader'}}
      }
      return {directive: state.endOwner === 'list' && event.anchorsEnd ? verifyEnd : leaveAlone, state}
    case 'rowResized':
      // Rows growing around a reader, or around a centred target, are left to the list's
      // content-position anchor, which holds what is in view where it is.
      return {directive: state.endOwner === 'list' && event.anchorsEnd ? verifyEnd : leaveAlone, state}
    case 'appended':
      // Only an end the list holds is re-pinned: a reader in history, or on a centred target, stays.
      return {
        directive: event.anchorHidesNewest && state.endOwner === 'list' ? pinEnd : leaveAlone,
        state,
      }
    case 'editingChanged': {
      const {ordinal, rowFullyVisible, targetInData} = event
      if (state.lastEditing === ordinal) return {directive: leaveAlone, state}
      if (!ordinal) return {directive: leaveAlone, state: {...state, holdingEdit: false, lastEditing: ordinal}}
      // An edit whose row is not loaded waits for it: the list reports again as its rows change. The
      // edit held so far is not this one.
      if (!targetInData) {
        return {directive: leaveAlone, state: state.holdingEdit ? {...state, holdingEdit: false} : state}
      }
      // A row already in view stays where it is: bringing it to the middle would only move the list
      // off its end.
      if (rowFullyVisible()) {
        return {directive: leaveAlone, state: {...state, holdingEdit: true, lastEditing: ordinal}}
      }
      // Any other reveal moves the list, off its end if it was there, and leaves the reader on the
      // edited message as their own scroll would: nothing may scroll back to the end on the list's
      // account.
      return {
        directive: {ordinal, type: 'reveal'},
        state: {...state, endOwner: 'reader', holdingEdit: true, lastEditing: ordinal},
      }
    }
    case 'scrollToBottomRequested':
      // The reader has left the target as surely as with a drag. It stays centred until the thread
      // reconcile sees the centre cleared, but nothing may pull the reader back to it meanwhile, not
      // even its arrival: a target still loading counts as centred already.
      return {
        directive: {...pinEnd, stopCentering: true},
        state: {
          ...state,
          endOwner: 'list',
          holdingEdit: false,
          lastCentered: event.centeredOrdinal,
          settlingCenter: false,
        },
      }
  }
}

export const ownsEnd = (state: ScrollTargetState) => state.endOwner === 'list'

// One list's scroll target: its state, moved only by the decisions it makes. Its subscribers
// (useSyncExternalStore) hear of every change to its state.
export type ScrollTarget = {
  decide: (event: ScrollEvent) => ScrollDirective
  readonly state: ScrollTargetState
  subscribe: (listener: () => void) => () => void
}

export const makeScrollTarget = (): ScrollTarget => {
  let state = initialScrollTargetState
  const listeners = new Set<() => void>()
  return {
    decide: event => {
      const decision = decideScroll(state, event)
      if (decision.state !== state) {
        state = decision.state
        listeners.forEach(l => l())
      }
      return decision.directive
    },
    get state() {
      return state
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

// Ordinals are sorted oldest first; -1 when the ordinal is not loaded.
export const indexOfOrdinal = (ordinals: ReadonlyArray<T.Chat.Ordinal>, ordinal: T.Chat.Ordinal) =>
  sortedIndexOf(ordinals as unknown as Array<number>, ordinal as unknown as number)

// The same for ordinals held newest first, as the inverted native list holds them.
export const indexOfOrdinalNewestFirst = (ordinals: ReadonlyArray<T.Chat.Ordinal>, ordinal: T.Chat.Ordinal) => {
  const index = sortedIndexBy(ordinals as unknown as Array<number>, ordinal as unknown as number, o => -o)
  return ordinals[index] === ordinal ? index : -1
}

// Where a freshly laid out dataset starts: on the centred target when it is loaded, otherwise at
// the end.
export const initialScrollTarget = (
  ordinals: ReadonlyArray<T.Chat.Ordinal>,
  centeredOrdinal: T.Chat.Ordinal | undefined
) => {
  const index = centeredOrdinal !== undefined ? indexOfOrdinal(ordinals, centeredOrdinal) : -1
  return index >= 0 ? ({index, viewPosition: 0.5} as const) : undefined
}

// The list's own end anchor holds the newest message in view, and only while the list owns the end:
// its own idea of being at the end (within a tenth of the viewport of it, on the desktop) would
// otherwise pull down a reader who has scrolled a little way up. It stays off while a target is
// centred, even one that is not loaded, so new messages don't pull the reader away from it, and
// while the thread holds a window of history without the newest message, whose end is only the
// newest row loaded: a page of newer rows landing there would carry the reader along with it.
// heldLatest is whether the rows now shown are held at the newest message (useHeldLatest), so the
// page that brings the newest message lands as a page too.
export const listAnchorsEnd = (p: {
  centeredOrdinal: T.Chat.Ordinal | undefined
  heldLatest: boolean
  listOwnsEnd: boolean
}) => p.listOwnsEnd && p.centeredOrdinal === undefined && p.heldLatest

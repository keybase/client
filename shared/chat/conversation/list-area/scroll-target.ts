// Where the thread should be scrolled right now. Pure: each list adapter reports what happened as an
// event, gets back one directive, and carries it out with its own measuring and correcting. The
// decision rules live here once; how a list reaches the end or a centred row stays with that list.
import type * as T from '@/constants/types'
import sortedIndexOf from 'lodash/sortedIndexOf'

export type ScrollTargetState = {
  // The dataset the centring and header bookkeeping below belong to. A centred load clears the thread
  // and refills it under a new key, and that is a new list as far as scrolling is concerned.
  datasetKey: string
  // Whether the end still belongs to the list (hold the newest message in view) or to the reader,
  // who took it by scrolling away or by asking for a centred target.
  endOwner: 'list' | 'reader'
  // The last header size reported for this dataset. The first report is the size the list built its
  // initial position from, so only a later, different one counts as growth.
  headerSize: number | undefined
  // The target already centred in this dataset. Centring happens once per target: scrolling up
  // prepends older messages, which moves the target's index, and re-centring on that would pull
  // the reader back to the hit.
  lastCentered: T.Chat.Ordinal | undefined
  // The edit already revealed. Deliberately survives a dataset change.
  lastEditing: T.Chat.Ordinal | undefined
}

export type ScrollEvent =
  | {type: 'datasetChanged'; datasetKey: string}
  // The thread or the centre request changed: the level-triggered reconcile that starts and ends
  // centring. targetInData says whether the centred ordinal is in the loaded messages.
  | {
      type: 'threadObserved'
      centeredOrdinal: T.Chat.Ordinal | undefined
      containsLatestMessage: boolean
      loaded: boolean
      targetInData: boolean
    }
  // A conversation finished its first load, for a list with no declarative initial position.
  | {type: 'initialLoad'; centeredOrdinal: T.Chat.Ordinal | undefined; hasMessages: boolean}
  | {type: 'userScrolled'; how: 'wheel' | 'drag' | 'pageUp' | 'pageDown'}
  | {type: 'headerMeasured'; hasMessages: boolean; size: number}
  // Messages were appended. anchorHidesNewest is true when the list's own anchoring would leave the
  // new message out of view.
  | {type: 'appended'; anchorHidesNewest: boolean}
  | {type: 'editingChanged'; ordinal: T.Chat.Ordinal | undefined; targetInData: boolean}
  | {type: 'scrollToBottomRequested'}
  | {type: 'jumpToRecent'}

export type ScrollDirective =
  // now: scroll to the end. unlessAtEnd: only if not already there, because scrolling an at-end
  // list displaces its own end anchor. whenSettled: once the list has stopped moving, correct any
  // shortfall for as long as the list still owns the end.
  | {type: 'pinEnd'; how: 'now' | 'unlessAtEnd' | 'whenSettled'; stopCentering: boolean}
  // Bring the ordinal to the middle of the viewport, replacing any centring already under way.
  | {type: 'center'; ordinal: T.Chat.Ordinal}
  // Bring the ordinal into view without taking the end from the list.
  | {type: 'reveal'; ordinal: T.Chat.Ordinal}
  | {type: 'leaveAlone'; stopCentering: boolean}

export type ScrollDecision = {directive: ScrollDirective; state: ScrollTargetState}

export const initialScrollTargetState = (datasetKey: string): ScrollTargetState => ({
  datasetKey,
  endOwner: 'list',
  headerSize: undefined,
  lastCentered: undefined,
  lastEditing: undefined,
})

const leaveAlone: ScrollDirective = {stopCentering: false, type: 'leaveAlone'}

export const decideScroll = (state: ScrollTargetState, event: ScrollEvent): ScrollDecision => {
  switch (event.type) {
    case 'datasetChanged':
      // Resets even for a key it has seen: the list re-announces its dataset whenever it lays it out
      // afresh, and the end, the centred target and the header baseline all start over with it.
      return {
        directive: leaveAlone,
        state: {
          ...state,
          datasetKey: event.datasetKey,
          endOwner: 'list',
          headerSize: undefined,
          lastCentered: undefined,
        },
      }
    case 'threadObserved': {
      const {centeredOrdinal, containsLatestMessage, loaded, targetInData} = event
      if (!loaded) return {directive: leaveAlone, state}
      if (centeredOrdinal !== undefined) {
        if (state.lastCentered === centeredOrdinal || !targetInData) return {directive: leaveAlone, state}
        return {
          directive: {ordinal: centeredOrdinal, type: 'center'},
          state: {...state, endOwner: 'reader', lastCentered: centeredOrdinal},
        }
      }
      if (state.lastCentered === undefined) return {directive: leaveAlone, state}
      // Leaving a centred target hands the end back. Without the newest messages loaded there is no
      // end to go to yet; the list anchors it once they arrive.
      return {
        directive: containsLatestMessage
          ? {how: 'now', stopCentering: true, type: 'pinEnd'}
          : {stopCentering: true, type: 'leaveAlone'},
        state: {...state, endOwner: 'list', lastCentered: undefined},
      }
    }
    case 'initialLoad':
      if (event.centeredOrdinal !== undefined) {
        return {
          directive: {ordinal: event.centeredOrdinal, type: 'center'},
          state: {...state, endOwner: 'reader', lastCentered: event.centeredOrdinal},
        }
      }
      return {
        directive: event.hasMessages ? {how: 'now', stopCentering: false, type: 'pinEnd'} : leaveAlone,
        state,
      }
    case 'userScrolled':
      // Paging toward the end does not claim it back, even when it arrives there.
      if (event.how === 'pageDown') return {directive: leaveAlone, state}
      // A wheel or a drag is the reader taking over, so centring stops rather than pull them back.
      // Paging up hands over the end but leaves a centring under way to finish.
      return {
        directive: {stopCentering: event.how !== 'pageUp', type: 'leaveAlone'},
        state: {...state, endOwner: 'reader'},
      }
    case 'headerMeasured': {
      const previous = state.headerSize
      const next = {...state, headerSize: event.size}
      if (previous === undefined || previous === event.size) return {directive: leaveAlone, state: next}
      // The header frequently settles while the thread is still empty, and there is no end to hold yet.
      if (state.endOwner !== 'list' || !event.hasMessages) return {directive: leaveAlone, state: next}
      return {directive: {how: 'whenSettled', stopCentering: false, type: 'pinEnd'}, state: next}
    }
    case 'appended':
      return {
        directive: event.anchorHidesNewest ? {how: 'now', stopCentering: false, type: 'pinEnd'} : leaveAlone,
        state,
      }
    case 'editingChanged': {
      const {ordinal, targetInData} = event
      if (state.lastEditing === ordinal) return {directive: leaveAlone, state}
      const next = {...state, lastEditing: ordinal}
      if (!ordinal || !targetInData) return {directive: leaveAlone, state: next}
      return {directive: {ordinal, type: 'reveal'}, state: next}
    }
    case 'scrollToBottomRequested':
    case 'jumpToRecent':
      return {
        directive: {how: 'unlessAtEnd', stopCentering: false, type: 'pinEnd'},
        state: {...state, endOwner: 'list'},
      }
  }
}

export const ownsEnd = (state: ScrollTargetState) => state.endOwner === 'list'

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

// The list's own end anchor stays off while a target is centred, even one that is not loaded,
// so new messages don't pull the reader away from it.
export const listAnchorsEnd = (centeredOrdinal: T.Chat.Ordinal | undefined) => centeredOrdinal === undefined

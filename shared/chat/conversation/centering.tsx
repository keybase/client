import * as React from 'react'
import type * as T from '@/constants/types'
import {consumeInputIntent, useInputIntentState} from './input-intent-store'
import {getOrdinalForMessageIDInSnapshot} from './thread-load'
import {produce} from 'immer'
import sortedIndexOf from 'lodash/sortedIndexOf'
import {useChatThreadRouteParams} from './thread-search-route'
import {useRequestWindow} from './thread-window'
import {
  type ConversationThreadState,
  useConversationThreadSelector,
  useConversationThreadSetMarkReadBlocked,
  useConversationThreadStore,
} from './thread-context'

// What centering can end up doing. 'clamped' is a real outcome, not a failure: a hit within half a
// viewport of either end of the thread cannot be put in the middle, and neither can one the reader
// scrolls away from while we are still correcting. 'not-found' means the thread came back without
// the message at all - the only outcome a caller should read as "this hit is unreachable".
export type CenterOutcome = 'centered' | 'clamped' | 'not-found'

// Where the target sits relative to the middle of the viewport, as the list can see it.
export type CenterMeasurement =
  // `offBy` is in scroller pixels, already damped by whatever this list needs to converge without
  // oscillating; `scroll` is the offset it was measured at; `tolerance` is how close this list can
  // realistically get, below which chasing the remainder only fights the list's own adjustments.
  | {kind: 'measured'; offBy: number; scroll: number; tolerance: number}
  // No trustworthy frame of reference yet: the row has not mounted, or the list has not reported
  // the geometry the measurement is taken against. The corrector answers with the coarse anchor -
  // scrollToIndex - and re-polls, so this is the signal that asks to be put in the neighbourhood
  // before anything tries to measure a remainder.
  | {kind: 'needs-anchor'}
  // Measurable, but not against anything current: the list has not reported a fresh position since
  // the last correction, and correcting off a stale one overshoots.
  | {kind: 'pending'}

// Everything the corrector needs from a list. Two implementations, one per platform list, both in
// list-area: LegendList on desktop and FlatList on native.
export type CenterScrollAdapter = {
  // Only a list that can report its own end takes part in the end anchor. The native list cannot,
  // and never ran that correction.
  endAnchor?: {
    read: () => {isAtEnd: boolean; scroll: number} | undefined
    scrollToEnd: () => void
  }
  // How many corrections this list may issue before giving up. Left unset the loop is bounded by
  // its settle, clamp and timeout checks alone.
  maxCorrections?: number
  measureTarget: (ordinal: T.Chat.Ordinal) => CenterMeasurement
  // Coarse: it lands at the wrong offset for variable-height rows, but it gets the row mounted so
  // measureTarget can see it.
  scrollToIndex: (ordinal: T.Chat.Ordinal) => void
  scrollToOffset: (offset: number) => void
}

// Closed loop, not one shot: rows enter at an estimated size and only settle as they measure, so the
// first scroll lands off by however wrong the estimates above the target were. Measure the row's
// real offset from the viewport centre and correct until it holds still, then get out of the way -
// the list's own maintain-visible-content-position owns the offset from then on, and two controllers
// fighting over one scroll offset oscillate.
const centerTimeoutMs = 3000
const measurePollMs = 50
const mountPollMs = 100
// Three readings inside the deadband, not one: a single one can be the frame before a row above the
// target re-measures and moves it again.
const settledChecks = 3
// A hit near either end of the thread cannot be centred: the offset we ask for gets clamped and the
// row never reaches the middle. Three corrections that moved the scroll position not at all mean we
// are pinned against an edge - stop rather than spin.
const pinnedChecksToClamp = 3

// The native list cannot measure a row's offset directly (inverted list + custom keyboard
// scrollview + tall variable-height image rows all make scrollToItem land wrong), so it measures in
// index space - the reported viewable range against the target's index - and converts to pixels with
// the average row height. Pure, and separated from the refs that feed it, because every way this
// arithmetic can be fed nothing useful ends in the same silent failure: an `offBy` and a `tolerance`
// that are both zero read as "already centred" to the corrector, which then settles without ever
// scrolling and reports 'centered' for a row nobody moved to.
const nativeCenterDamping = 0.9
export const measureNativeCenter = (p: {
  contentHeight: number
  first: number | null | undefined
  last: number | null | undefined
  num: number
  scroll: number
  targetIdx: number
}): CenterMeasurement => {
  const {contentHeight, first, last, num, scroll, targetIdx} = p
  // The row is not in the window, so there is no index to measure against.
  if (!num || targetIdx < 0) return {kind: 'needs-anchor'}
  const avgH = contentHeight / num
  // No content height means no scale, and at zero the deadband collapses onto the offset, so every
  // reading would come back as already centred. This is also the state the list is left in on first
  // mount and whenever the window is dropped, which is what puts the coarse anchor back in play at
  // exactly the two moments an index-space measurement has nothing trustworthy to stand on.
  if (!(avgH > 0)) return {kind: 'needs-anchor'}
  // Scale but no range: the list reports an empty viewable set for a frame whenever a scroll lands
  // somewhere its cells have not rendered yet. That is a gap to wait out, not a reason to re-anchor
  // - answering it with the coarse scroll would throw away a correction that may be one reading away
  // from settling and yank the thread back to the middle of nowhere.
  if (first == null || last == null) return {kind: 'pending'}
  const centerIdx = (first + last) / 2
  const diff = targetIdx - centerIdx
  return {
    kind: 'measured',
    // higher index = older = higher offset, damped to avoid overshoot/oscillation
    offBy: diff * avgH * nativeCenterDamping,
    scroll,
    // half a row, expressed through the same damping so the deadband stays the index-space half-row
    // it has always been
    tolerance: 0.5 * avgH * nativeCenterDamping,
  }
}

export const runCenterCorrection = async (p: {
  adapter: CenterScrollAdapter
  ordinal: T.Chat.Ordinal
  signal: {cancelled: boolean}
  sleep: (ms: number) => Promise<void>
}): Promise<CenterOutcome> => {
  const {adapter, ordinal, signal, sleep} = p
  let settled = 0
  let pinnedChecks = 0
  let corrections = 0
  let scrollAtLastRequest: number | undefined
  for (let elapsed = 0; elapsed < centerTimeoutMs && !signal.cancelled; ) {
    const measurement = adapter.measureTarget(ordinal)
    if (measurement.kind === 'needs-anchor') {
      adapter.scrollToIndex(ordinal)
      settled = 0
      pinnedChecks = 0
      await sleep(mountPollMs)
      elapsed += mountPollMs
      continue
    }
    if (measurement.kind === 'pending') {
      await sleep(measurePollMs)
      elapsed += measurePollMs
      continue
    }
    const {offBy, scroll, tolerance} = measurement
    if (Math.abs(offBy) <= tolerance) {
      pinnedChecks = 0
      // Only the iteration right after a correction can diagnose a clamp.
      scrollAtLastRequest = undefined
      if (++settled >= settledChecks) {
        return 'centered'
      }
    } else if (scroll === scrollAtLastRequest) {
      if (++pinnedChecks >= pinnedChecksToClamp) {
        return 'clamped'
      }
    } else if (adapter.maxCorrections !== undefined && corrections >= adapter.maxCorrections) {
      return 'clamped'
    } else {
      corrections += 1
      pinnedChecks = 0
      scrollAtLastRequest = scroll
      adapter.scrollToOffset(scroll + offBy)
    }
    await sleep(measurePollMs)
    elapsed += measurePollMs
  }
  return 'clamped'
}

// The list resolves its initial end target from the header size it has measured so far, and the
// thread's intro content (retention notice, new-chat card, the "digging" spinner) lands after that.
// The list re-pins on a data, item, footer or viewport layout change but has no header trigger, so a
// header that grows after the target resolved leaves the list short by exactly that growth with
// nothing to correct it.
//
// Closed loop rather than a correction fired straight from the size change: the header often settles
// while the thread is still empty, and a scroll-to-end issued against that near-empty content
// becomes the target the list then abandons its own bootstrap for, landing anywhere. Wait for the
// scroll offset to hold still, so the list has finished its own initial scroll, and only then
// correct what it left on the table.
const endAnchorTimeoutMs = 2000
// Two corrections is the whole budget: one for the header, one for whatever re-measured alongside
// it. Past that we would be fighting something that owns the offset.
const maxEndAnchorCorrections = 2

export const runEndAnchorCorrection = async (p: {
  endAnchor: NonNullable<CenterScrollAdapter['endAnchor']>
  holdsEndAnchor: () => boolean
  signal: {cancelled: boolean}
  sleep: (ms: number) => Promise<void>
}): Promise<void> => {
  const {endAnchor, holdsEndAnchor, signal, sleep} = p
  let previousScroll: number | undefined
  let corrections = 0
  for (let elapsed = 0; elapsed < endAnchorTimeoutMs && !signal.cancelled && holdsEndAnchor(); ) {
    await sleep(measurePollMs)
    elapsed += measurePollMs
    const state = endAnchor.read()
    if (!state) {
      continue
    }
    if (state.isAtEnd) {
      return
    }
    // Only a scroll offset that held still across two checks means the list is done moving.
    if (state.scroll === previousScroll) {
      if (++corrections > maxEndAnchorCorrections) {
        return
      }
      endAnchor.scrollToEnd()
      previousScroll = undefined
    } else {
      previousScroll = state.scroll
    }
  }
}

// Who owns the scroll offset. The end anchor and the centering loop both drive it, and a reader who
// touches the list takes it from both - a correction that yanks someone away from where they landed
// is the failure both loops are bounded to avoid.
type ScrollOwner = 'center' | 'end' | 'reader'

type CenterTarget = {highlightMode: T.Chat.CenterOrdinalHighlightMode; messageID: T.Chat.MessageID}

type CenterState = {
  target: CenterTarget | undefined
  threadSearchVisible: boolean
}

type CenterStateContextType = {
  centeredHighlightOrdinal: T.Chat.Ordinal | undefined
  centeredOrdinal: T.Chat.Ordinal | undefined
  hasCenter: boolean
}

type CenterActionsContextType = {
  centerOn: (
    messageID: T.Chat.MessageID,
    highlightMode: T.Chat.CenterOrdinalHighlightMode
  ) => Promise<CenterOutcome>
  clearCenter: () => void
  jumpToRecent: () => void
}

// What a list registers so the module can steer it, plus the end-anchor state that used to sit
// beside it as free refs.
type CenterScrollContextType = {
  endMayHaveMoved: () => void
  holdsEndAnchor: () => boolean
  readerTookScroll: () => void
  registerAdapter: (adapter: CenterScrollAdapter | undefined) => void
  takeEndAnchor: () => void
}

const ordinalInWindow = (snapshot: ConversationThreadState, messageID: T.Chat.MessageID) => {
  const found = getOrdinalForMessageIDInSnapshot(snapshot, messageID)
  if (found === null) {
    return undefined
  }
  const ordinals = snapshot.messageOrdinals
  return ordinals && sortedIndexOf(ordinals as unknown as number[], found as unknown as number) >= 0
    ? found
    : undefined
}

const missingContext = () => {
  throw new Error('Missing ConversationCenteringProvider in the tree')
}

// Split contexts: the state changes when centering/highlighting, the actions stay
// stable. Per-row consumers that only dispatch (e.g. reply-quote click) subscribe
// to actions only, so a highlight change doesn't re-render every row.
const CenterStateContext = React.createContext<CenterStateContextType>({
  centeredHighlightOrdinal: undefined,
  centeredOrdinal: undefined,
  hasCenter: false,
})
CenterStateContext.displayName = 'ConversationCenterStateContext'

const CenterActionsContext = React.createContext<CenterActionsContextType>({
  centerOn: missingContext,
  clearCenter: missingContext,
  jumpToRecent: missingContext,
})
CenterActionsContext.displayName = 'ConversationCenterActionsContext'

const CenterScrollContext = React.createContext<CenterScrollContextType>({
  endMayHaveMoved: missingContext,
  holdsEndAnchor: missingContext,
  readerTookScroll: missingContext,
  registerAdapter: missingContext,
  takeEndAnchor: missingContext,
})
CenterScrollContext.displayName = 'ConversationCenterScrollContext'

export const useConversationCenter = () => React.useContext(CenterStateContext)
export const useConversationCenterActions = () => React.useContext(CenterActionsContext)
export const useConversationCenterScroll = () => React.useContext(CenterScrollContext)

// The other half of the input-intent bus's type split: the input provider claims the other four
// types (input-area/input-state.tsx). Neither may claim the other's or whichever mounts first
// silently eats it.
const centerInputIntentTypes = ['highlight'] as const

const stateForThreadSearchVisible = (state: CenterState, threadSearchVisible: boolean): CenterState =>
  produce(state, draft => {
    if (draft.threadSearchVisible === threadSearchVisible) {
      return
    }
    draft.threadSearchVisible = threadSearchVisible
    if (threadSearchVisible && draft.target) {
      draft.target.highlightMode = 'none'
    } else {
      draft.target = undefined
    }
  })

const sleep = async (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// The in-flight centring request, if a caller is waiting on its outcome. `corrected` is what keeps
// the not-found watchdog from answering for a request the corrector has already taken over.
type PendingCenter = {
  corrected: boolean
  messageID: T.Chat.MessageID
  settle: (outcome: CenterOutcome) => void
}

type ScrollControl = {
  adapter: CenterScrollAdapter | undefined
  correction: {cancelled: boolean} | undefined
  endAnchor: {cancelled: boolean} | undefined
  owner: ScrollOwner
  pending: PendingCenter | undefined
}

export const ConversationCenteringProvider = function ConversationCenteringProvider(p: {
  children: React.ReactNode
  id: T.Chat.ConversationIDKey
}) {
  const {children, id} = p
  const routeParams = useChatThreadRouteParams()
  const threadSearchVisible = !!routeParams?.threadSearch
  const requestWindow = useRequestWindow()
  const setMarkReadBlocked = useConversationThreadSetMarkReadBlocked()
  const store = useConversationThreadStore()
  const [centerState, setCenterState] = React.useState<CenterState>(() => ({
    target: undefined,
    threadSearchVisible,
  }))

  const currentCenterState = stateForThreadSearchVisible(centerState, threadSearchVisible)
  const target = currentCenterState.target

  // The one messageID -> ordinal resolution. A message you sent keeps the fractional ordinal it had
  // in the outbox, so the ordinal it lives at is not the number its server ID makes; asking the
  // window is the only way to get the right one. The row has to be in the window as well as in the
  // map: a message the thread holds but does not render has nothing to scroll to, and reporting its
  // ordinal would send the corrector after a row that never mounts.
  const centeredOrdinal = useConversationThreadSelector(s =>
    target ? ordinalInWindow(s, target.messageID) : undefined
  )

  const scrollRef = React.useRef<ScrollControl>({
    adapter: undefined,
    correction: undefined,
    endAnchor: undefined,
    owner: 'end',
    pending: undefined,
  })

  const settlePending = React.useEffectEvent((outcome: CenterOutcome) => {
    const scroll = scrollRef.current
    const pending = scroll.pending
    if (!pending) {
      return
    }
    scroll.pending = undefined
    pending.settle(outcome)
  })
  const takeCentering = React.useEffectEvent(() => {
    const scroll = scrollRef.current
    scroll.owner = 'center'
    if (scroll.pending) {
      scroll.pending.corrected = true
    }
  })
  const abortCorrection = React.useEffectEvent(() => {
    const {correction} = scrollRef.current
    if (correction) {
      correction.cancelled = true
    }
  })
  const abortEverything = React.useEffectEvent(() => {
    const scroll = scrollRef.current
    if (scroll.correction) {
      scroll.correction.cancelled = true
    }
    if (scroll.endAnchor) {
      scroll.endAnchor.cancelled = true
    }
    settlePending('clamped')
  })
  React.useEffect(() => () => abortEverything(), [])

  const endMayHaveMoved = React.useEffectEvent(() => {
    const scroll = scrollRef.current
    const endAnchor = scroll.adapter?.endAnchor
    // Only once there are messages: the header frequently settles while the thread is still empty,
    // and there is no end to hold yet.
    if (!endAnchor || scroll.owner !== 'end' || !store.getState().messageOrdinals?.length) {
      return
    }
    if (scroll.endAnchor) {
      scroll.endAnchor.cancelled = true
    }
    const signal = {cancelled: false}
    scroll.endAnchor = signal
    void runEndAnchorCorrection({
      endAnchor,
      holdsEndAnchor: () => scrollRef.current.owner === 'end',
      signal,
      sleep,
    })
  })
  const holdsEndAnchor = React.useEffectEvent(() => scrollRef.current.owner === 'end')
  const readerTookScroll = React.useEffectEvent(() => {
    const scroll = scrollRef.current
    scroll.owner = 'reader'
    if (scroll.correction) {
      scroll.correction.cancelled = true
    }
  })
  const registerAdapter = React.useEffectEvent((adapter: CenterScrollAdapter | undefined) => {
    scrollRef.current.adapter = adapter
  })
  const takeEndAnchor = React.useEffectEvent(() => {
    scrollRef.current.owner = 'end'
  })
  const [scrollActions] = React.useState<CenterScrollContextType>(() => ({
    endMayHaveMoved: () => {
      endMayHaveMoved()
    },
    holdsEndAnchor: () => holdsEndAnchor(),
    readerTookScroll: () => {
      readerTookScroll()
    },
    registerAdapter: (adapter: CenterScrollAdapter | undefined) => {
      registerAdapter(adapter)
    },
    takeEndAnchor: () => {
      takeEndAnchor()
    },
  }))

  const setTarget = React.useEffectEvent(
    (messageID: T.Chat.MessageID, highlightMode: T.Chat.CenterOrdinalHighlightMode) => {
      setCenterState(state =>
        produce(stateForThreadSearchVisible(state, threadSearchVisible), draft => {
          draft.target = {highlightMode, messageID}
        })
      )
    }
  )

  const clearTarget = React.useEffectEvent(() => {
    setCenterState(state =>
      produce(stateForThreadSearchVisible(state, threadSearchVisible), draft => {
        draft.target = undefined
      })
    )
  })

  // Poll rather than subscribe: the two things waited on - the message landing in the window and the
  // list registering itself - settle at different times under different owners, and the corrector
  // that follows is a poll anyway.
  const waitForAdapter = async () => {
    for (let elapsed = 0; elapsed <= centerTimeoutMs; elapsed += measurePollMs) {
      const {adapter} = scrollRef.current
      if (adapter) {
        return adapter
      }
      await sleep(measurePollMs)
    }
    return undefined
  }

  // Started here rather than by whoever asked for it, so a list that mounts - or remounts, after a
  // freeze/thaw - onto a target that resolved long ago is still steered onto it. A "last corrected"
  // ordinal rather than a "did it change" flag, so the correction still runs when the thread finishes
  // loading after the target was set.
  const lastCorrectedRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)
  // Names the current centering request. Everything below that can resume after an await checks it
  // before touching shared state.
  const centerRequestRef = React.useRef(0)
  const correctOnto = React.useEffectEvent(async (ordinal: T.Chat.Ordinal) => {
    // Bound to the request that started it. Waiting for the adapter can park this for the whole
    // timeout, long enough for a newer centerOn to install its own pending and its own correction -
    // and a stale resumption checking only `correction === signal` would pass that check by
    // overwriting the newer signal on its way through, then answer the newer request with this
    // one's outcome and cancel the correction actually steering the list.
    const request = centerRequestRef.current
    const adapter = await waitForAdapter()
    if (centerRequestRef.current !== request) {
      return
    }
    if (!adapter) {
      settlePending('clamped')
      return
    }
    abortCorrection()
    const signal = {cancelled: false}
    scrollRef.current.correction = signal
    const outcome = await runCenterCorrection({adapter, ordinal, signal, sleep})
    if (centerRequestRef.current !== request) {
      return
    }
    if (scrollRef.current.correction === signal) {
      scrollRef.current.correction = undefined
      settlePending(outcome)
    }
  })
  React.useEffect(() => {
    if (centeredOrdinal === undefined) {
      lastCorrectedRef.current = undefined
      return
    }
    if (lastCorrectedRef.current === centeredOrdinal) {
      return
    }
    lastCorrectedRef.current = centeredOrdinal
    takeCentering()
    void correctOnto(centeredOrdinal)
    // `target` is a dep as well as the ordinal: re-centering on the row the reader is already
    // parked on leaves the ordinal unchanged, and that request still has to be steered.
  }, [centeredOrdinal, target])

  // The other side of that effect: once the centre is gone the end belongs to the list again.
  const returnEndToTheList = React.useEffectEvent(() => {
    const scroll = scrollRef.current
    if (scroll.correction) {
      scroll.correction.cancelled = true
    }
    scroll.owner = 'end'
    if (!store.getState().moreToLoadForward) {
      scroll.adapter?.endAnchor?.scrollToEnd()
    }
  })
  const hadCenterRef = React.useRef(false)
  React.useEffect(() => {
    const hadCenter = hadCenterRef.current
    hadCenterRef.current = !!target
    if (hadCenter && !target) {
      returnEndToTheList()
    }
  }, [target])

  // The thread came back without the message: nothing is going to correct onto it, so answer for the
  // request rather than leaving the caller waiting on a row that will never render.
  //
  // Judged on the reload this request asked for having finished, not on elapsed time. 'not-found' is
  // the one outcome a caller reads as "this hit is unreachable" - search hands its counter back on
  // it - so reporting it off a stopwatch would mean a slow RPC retracts a hit that is about to
  // arrive. If the window never settles at all, the honest answer is not 'not-found': say 'clamped'
  // and leave the caller's optimistic answer standing.
  const watchForMissingMessage = React.useEffectEvent(async (pending: PendingCenter) => {
    const generationAtRequest = store.getState().generation
    for (let elapsed = 0; elapsed <= centerTimeoutMs; elapsed += measurePollMs) {
      if (scrollRef.current.pending !== pending || pending.corrected) {
        return
      }
      const snapshot = store.getState()
      // The window this request asked for, done loading.
      if (snapshot.generation !== generationAtRequest && snapshot.loaded) {
        if (ordinalInWindow(snapshot, pending.messageID) === undefined) {
          settlePending('not-found')
        }
        // Otherwise the row is here and the correction owns it from now on.
        return
      }
      await sleep(measurePollMs)
    }
    settlePending('clamped')
  })

  const runCenterOn = React.useEffectEvent(
    async (messageID: T.Chat.MessageID, highlightMode: T.Chat.CenterOrdinalHighlightMode) => {
      centerRequestRef.current += 1
      settlePending('clamped')
      abortCorrection()
      takeCentering()
      // Re-centering on the row the reader is already parked on still reloads the thread, so the
      // list has to be steered onto it again.
      lastCorrectedRef.current = undefined
      setTarget(messageID, highlightMode)
      requestWindow({anchor: {centeredOn: messageID}, reason: 'centered'})
      return new Promise<CenterOutcome>(resolve => {
        const pending: PendingCenter = {corrected: false, messageID, settle: resolve}
        scrollRef.current.pending = pending
        void watchForMissingMessage(pending)
      })
    }
  )
  const runJumpToRecent = React.useEffectEvent(() => {
    centerRequestRef.current += 1
    clearTarget()
    requestWindow({anchor: 'newest', reason: 'jump to recent'})
  })

  const [actions] = React.useState<CenterActionsContextType>(() => ({
    centerOn: async (messageID: T.Chat.MessageID, highlightMode: T.Chat.CenterOrdinalHighlightMode) =>
      runCenterOn(messageID, highlightMode),
    clearCenter: () => {
      clearTarget()
    },
    jumpToRecent: () => {
      runJumpToRecent()
    },
  }))

  React.useEffect(() => {
    setMarkReadBlocked(threadSearchVisible)
    return () => {
      setMarkReadBlocked(false)
    }
  }, [setMarkReadBlocked, threadSearchVisible])

  const applyHighlight = React.useEffectEvent((messageID: T.Chat.MessageID) => {
    setMarkReadBlocked(true)
    void actions.centerOn(messageID, 'flash')
  })
  // Same two delivery moments as ConversationInputProvider: consume whatever was written before
  // we mounted, then a registered subscription for later writes. Not a selector hook - that would
  // re-render this subtree, and enableFreeze defers render-driven subscriptions on mobile while a
  // registered callback still runs. Delete-on-consume is the dedupe, so jumping twice to the same
  // messageID centers twice.
  React.useEffect(() => {
    const consume = () => {
      const intent = consumeInputIntent(id, centerInputIntentTypes)
      if (intent) {
        applyHighlight(intent.messageID)
      }
    }
    consume()
    return useInputIntentState.subscribe(consume)
  }, [id])

  const centeredHighlightOrdinal = target && target.highlightMode !== 'none' ? centeredOrdinal : undefined
  const stateValue = {
    centeredHighlightOrdinal,
    centeredOrdinal,
    hasCenter: !!target,
  }

  return (
    <CenterActionsContext value={actions}>
      <CenterScrollContext value={scrollActions}>
        <CenterStateContext value={stateValue}>{children}</CenterStateContext>
      </CenterScrollContext>
    </CenterActionsContext>
  )
}

// Native adapter for the thread scroll target: turns what the inverted FlatList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API: coarse
// scrollToItem reasserts, then a closed-loop corrector against the viewable range.
import * as React from 'react'
import type * as T from '@/constants/types'
import noop from 'lodash/noop'
import sortedIndexBy from 'lodash/sortedIndexBy'
import {ThreadRefsContext} from '../normal/context'
import {useComposerAnchor} from '../composer-viewport-context'
import {restingScrollOffset} from '../composer-geometry'
import {makeOwnScrolls} from './own-scrolls'
import {KeyboardEvents} from 'react-native-keyboard-controller'
import {
  indexOfOrdinalNewestFirst,
  listAnchorsEnd,
  ownsEnd,
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'
import {useHeldLatest, useScrollTarget} from './use-scroll-target'
import {withinPageLoad} from './paging'
import {makeSchedule, useSchedule, type Scheduled} from './schedule'

export type NativeListRef = {
  scrollToOffset: (opts: {animated: boolean; offset: number}) => void
  scrollToItem: (opts: {animated: boolean; item: unknown; viewOffset?: number; viewPosition?: number}) => void
}

// The maintainVisibleContentPosition prop must ALWAYS be set (never toggled to undefined):
// RN Fabric only re-snapshots the MVP anchor while the prop is set, so an unset->set
// transition adjusts contentOffset against a stale anchor frame from before the prop was
// unset — a spurious jump + autoscroll animation of the whole list (seen after dismissing
// the keyboard following a send). Instead we swap between two configs:
// - closed (keyboard hidden): autoscrollToTopThreshold=1 so new messages at the bottom
//   auto-reveal when the user is pinned there.
// - noAutoscroll (keyboard open, or centered on a search hit, or a window of history, or the
//   reader holding the end, or empty list): MVP still anchors content, but autoscroll-to-top is
//   off because:
//   1. with the keyboard open contentOffset.y = -(K-insets.bottom) <= 1, so the threshold
//      would fire on insert and scroll to y=0, hiding new messages behind the keyboard.
//   2. while centered on a search hit, autoscroll yanks the centered row.
//   3. in a window of history (listAnchorsEnd), a page of newer rows loading at the bottom would
//      carry the reader down with it.
//   4. a reader who holds the end has scrolled away from it, and stays where they are.
//   With the keyboard open, MVP's insert adjustment briefly holds old content in place;
//   the deferred re-pin on append below re-pins the newest message.
const maintainVisibleContentPositionClosed = {
  autoscrollToTopThreshold: 1,
  minIndexForVisible: 0,
}
const maintainVisibleContentPositionNoAutoscroll = {
  minIndexForVisible: 0,
}

// An offset within this many points of the resting offset is at the end.
const endTolerance = 8
// A row overhanging the part of the list in view by no more than this is wholly in view.
const rowEdgeTolerance = 1
// Each end waits out a second after the rows last changed, so a page landing is not taken for the
// reader nearing the new end, and a second after it last asked, so a page on its way is not asked for
// again.
const pageLoadGate = 1000
// What a scroll to a row is for: a centre, or a reveal.
type ItemScroll = 'center' | 'reveal'
// The list moving by less than this has not moved.
const stillPoints = 1

export const useNativeThreadScroll = (p: {
  // Newest first, as the inverted list holds them.
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  centeredOrdinal: T.Chat.Ordinal | undefined
  containsLatestMessage: boolean
  conversationIDKey: T.Chat.ConversationIDKey
  // Changes with the conversation and with every clear of its thread (a centred reload, jump to
  // recent): each is a new list as far as scrolling is concerned.
  datasetKey: string
  editingOrdinal: T.Chat.Ordinal | undefined
  isKeyboardVisible: boolean
  listRef: React.RefObject<NativeListRef | null>
  loadNewer: () => void
  loadOlder: () => void
  loaded: boolean
}) => {
  const {centeredOrdinal, containsLatestMessage, conversationIDKey, datasetKey, editingOrdinal} = p
  const {isKeyboardVisible, loadNewer, loadOlder} = p
  const {listRef, loaded, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length

  const {bottomInset, keyboardHeight} = useComposerAnchor()
  // The offset the list rests at with its newest message in view, below which it does not scroll:
  // negative while the keyboard is up. Read through a ref so every scroll uses the inset and keyboard
  // as they are when it runs, and nothing that scrolls changes identity with the inset.
  const anchorRef = React.useRef({bottomInset, keyboardHeight})
  React.useLayoutEffect(() => {
    anchorRef.current = {bottomInset, keyboardHeight}
  }, [bottomInset, keyboardHeight])
  const [restingOffset] = React.useState(
    () => () => restingScrollOffset(anchorRef.current.bottomInset, anchorRef.current.keyboardHeight.value)
  )
  // Resting at the end: over the keyboard as it is now.
  const [atEnd] = React.useState(() => (offset: number) => offset <= restingOffset() + endTolerance)

  // Read by timers and list callbacks as they fire, so they see the target and rows as they are now.
  const centeredRef = React.useRef(centeredOrdinal)
  React.useEffect(() => {
    centeredRef.current = centeredOrdinal
  }, [centeredOrdinal])
  const ordsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    ordsRef.current = messageOrdinals
  }, [messageOrdinals])

  const {listOwnsEnd, scrollTarget} = useScrollTarget()
  const [own] = React.useState(makeOwnScrolls)
  const heldLatest = useHeldLatest(containsLatestMessage, datasetKey, messageOrdinals)

  // What the list has reported of itself, undefined until it does. The list is keyed by conversation,
  // so a switch brings a new list that starts unmeasured, and the old one's figures say nothing of it.
  const metricsRef = React.useRef<{content?: number; offset?: number; viewport?: number}>({})
  const vFirstRef = React.useRef<number | null | undefined>(undefined)
  const vLastRef = React.useRef<number | null | undefined>(undefined)
  // Where each row sits in the content, as the list last laid it out.
  const rowFramesRef = React.useRef(new Map<T.Chat.Ordinal, {height: number; y: number}>())
  // The oldest row the list has laid out in this dataset. The list sizes its content only as far as the
  // rows it has laid out, so rows loaded past this one are not in the content size yet.
  const oldestLaidOutRef = React.useRef<T.Chat.Ordinal | undefined>(undefined)

  // Every scroll the list makes itself goes through these, saying where it is going, so the movement
  // toward there and the rest that follows are its own.
  const [scrollToOffset] = React.useState(() => (offset: number) => {
    own.issued(metricsRef.current.offset, offset, false)
    listRef.current?.scrollToOffset({animated: false, offset})
  })
  // Where a row lands is not known ahead, only which way it lies from the middle of the view, once the
  // list has reported what is in view: older rows sit at higher offsets. Until then the scroll heads
  // nowhere known, and the movement after it is the reader's. A centre's coarse scroll puts the row in
  // the middle of the whole scroll view, where its corrector, reading the list's viewability, settles
  // it. A reveal, animated, puts it in the middle of the part of the view nothing covers: the keyboard
  // (and the composer riding it) covers the bottom of the scroll view by as much as the resting offset
  // sits below 0, so the row is lifted by half of that. Which way that lies is read from the row
  // itself when the list has laid it out, as the lift can turn a row just past the middle of the view.
  const [scrollToItem] = React.useState(() => (item: T.Chat.Ordinal, kind: ItemScroll) => {
    const animated = kind === 'reveal'
    const index = indexOfOrdinalNewestFirst(ordsRef.current, item)
    const first = vFirstRef.current
    const last = vLastRef.current
    const {offset, viewport} = metricsRef.current
    const lift = kind === 'reveal' ? -restingOffset() / 2 : 0
    const frame = rowFramesRef.current.get(item)
    if (lift && frame && offset !== undefined && viewport !== undefined) {
      own.issued(offset, frame.y + (frame.height - viewport) / 2 - lift, animated)
    } else if (first != null && last != null && index >= 0) {
      own.issued(offset, index >= (first + last) / 2 ? Infinity : -Infinity, animated)
    }
    listRef.current?.scrollToItem({animated, item, viewOffset: lift, viewPosition: 0.5})
  })

  // Every delayed scroll (coarse reasserts, the corrector's schedule, scroll-to-index retries, the
  // first load's retry, the append re-pin) runs through here, so stopping centring, a new dataset or
  // the list going away cancels whatever is pending, and a reader's drag is never followed by a jump.
  // Stopped by the detached cleanup below, not by useSchedule's, which would run first and hide
  // whether the first load's retry was still pending.
  const [timers] = React.useState(makeSchedule)

  // coarse: scrollToItem lands at the wrong offset for tall variable-height rows,
  // but it gets the target area rendered. The closed-loop corrector below
  // refines from there using the real viewable index range.
  const moveToward = React.useCallback(
    (target: T.Chat.Ordinal) => {
      const reassert = (delay: number) =>
        timers.after(delay, () => {
          if (centeredRef.current !== target) {
            return
          }
          scrollToItem(target, 'center')
        })
      ;[50, 250].forEach(reassert)
    },
    [scrollToItem, timers]
  )

  // Closed-loop centering corrector. scrollToItem/scrollToIndex lands at the wrong
  // offset here (inverted list + custom keyboard scrollview + tall variable-height
  // image rows), so instead we read the actual viewable index range each frame and
  // scrollToOffset by the item-delta until the target sits at viewport center.
  // Correcting toward a centered hit, which one, and how many steps taken.
  const correctRef = React.useRef<{active: boolean; iters: number; target?: T.Chat.Ordinal}>({
    active: false,
    iters: 0,
  })
  // The list as its last scroll event reported it, which the next one is compared with.
  const lastScrollRef = React.useRef<{content: number; offset: number; resting: number} | undefined>(undefined)
  // Compared by value, so a freeze/thaw re-mount, which keeps the list, keeps its figures.
  const measuredConvRef = React.useRef(conversationIDKey)
  React.useLayoutEffect(() => {
    if (measuredConvRef.current === conversationIDKey) return
    measuredConvRef.current = conversationIDKey
    metricsRef.current = {}
    lastScrollRef.current = undefined
    vFirstRef.current = undefined
    vLastRef.current = undefined
    rowFramesRef.current = new Map()
    oldestLaidOutRef.current = undefined
  }, [conversationIDKey])
  // The rows asked for by scrollToItem, each asked for by a centre or a reveal, with how many of its
  // failures have been retried: a row outside the rendered window makes the scroll fail, and the
  // retry asks for that same row again once more rows have rendered. A request lasts as long as what
  // asked for it: a centre's ends when it settles, and every one ends when the reader takes over.
  const itemScrollsRef = React.useRef(new Map<T.Chat.Ordinal, {kind: ItemScroll; retries: number}>())
  const [requestItem] = React.useState(() => (item: T.Chat.Ordinal, kind: ItemScroll) => {
    itemScrollsRef.current.set(item, {kind, retries: 0})
  })
  const [stopCentering] = React.useState(() => () => {
    correctRef.current.active = false
    itemScrollsRef.current.clear()
    timers.stop()
  })
  const [settleCenter] = React.useState(() => () => {
    const {active, target} = correctRef.current
    if (!active) return
    correctRef.current.active = false
    if (target !== undefined) itemScrollsRef.current.delete(target)
    // Only ever leaves the list alone.
    scrollTarget.decide({type: 'centerSettled'})
  })
  const [correctCenter] = React.useState(
    () => (first: number | null | undefined, last: number | null | undefined) => {
      const st = correctRef.current
      if (!st.active) return
      const co = centeredRef.current
      const ords = ordsRef.current
      const num = ords.length
      if (co === undefined || !num || first == null || last == null) return
      const targetIdx = indexOfOrdinalNewestFirst(ords, co)
      if (targetIdx < 0) return
      const centerIdx = (first + last) / 2
      const diff = targetIdx - centerIdx
      if (Math.abs(diff) <= 0.5 || st.iters > 12) {
        settleCenter()
        return
      }
      const {content, offset, viewport} = metricsRef.current
      // Nothing to step from until the list has reported where it is and how big.
      if (content === undefined || offset === undefined || viewport === undefined) return
      const avgH = content / num
      const maxOffset = Math.max(0, content - viewport)
      // damp by 0.9 to avoid overshoot/oscillation; higher index = older = higher offset
      const newOffset = Math.min(maxOffset, Math.max(restingOffset(), offset + diff * avgH * 0.9))
      // A target among the newest or oldest rows cannot reach the middle: the step is clamped to the
      // end of the scrollable range and would move nothing, now or on any later try.
      if (Math.abs(newOffset - offset) < 1) {
        settleCenter()
        return
      }
      st.iters += 1
      scrollToOffset(newOffset)
    }
  )

  // The corrector's 50/250/500/900ms schedule, started once per target. With its 13 steps it is the
  // whole budget: the target settles where the last step leaves it.
  const ladderRef = React.useRef<Array<Scheduled>>([])
  const initialRetryRef = React.useRef<Scheduled | undefined>(undefined)
  const dispatchRef = React.useRef<(event: ScrollEvent) => void>(noop)

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) stopCentering()
          // The end is a fixed resting offset, so every pin is the one scroll there: from the end it moves
          // nothing, and there is no bootstrap of the list's own to wait out.
          scrollToOffset(restingOffset())
          if (directive.retry) {
            initialRetryRef.current = timers.after(100, () => {
              dispatchRef.current({hasMessages: ordsRef.current.length > 0, retry: true, type: 'initialLoad'})
            })
          }
          return
        case 'center':
          requestItem(directive.ordinal, 'center')
          moveToward(directive.ordinal)
          correctRef.current = {active: true, iters: 0, target: directive.ordinal}
          ladderRef.current.forEach(t => t.cancel())
          ladderRef.current = [50, 250, 500, 900].map((d, i, ladder) =>
            timers.after(d, () => {
              correctCenter(vFirstRef.current, vLastRef.current)
              if (i === ladder.length - 1) settleCenter()
            })
          )
          return
        case 'reveal':
          requestItem(directive.ordinal, 'reveal')
          scrollToItem(directive.ordinal, 'reveal')
          return
        case 'leaveAlone':
          if (directive.stopCentering) stopCentering()
          return
        default: {
          const unexpected: never = directive
          return unexpected
        }
      }
    },
    [
      correctCenter,
      moveToward,
      requestItem,
      restingOffset,
      scrollToItem,
      scrollToOffset,
      settleCenter,
      stopCentering,
      timers,
    ]
  )

  const dispatch = React.useCallback(
    (event: ScrollEvent) => {
      perform(scrollTarget.decide(event))
    },
    [perform, scrollTarget]
  )
  // Read by the detached cleanup, so it runs only when the list is hidden or unmounted however
  // dispatch's dependencies change, and by the first load's retry, which perform schedules.
  React.useLayoutEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

  // Compared by value, not by the effect re-running: a freeze/thaw of this screen re-mounts effects
  // with nothing changed. Declared ahead of every effect that dispatches, so they see the new
  // dataset's state.
  const datasetRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (datasetRef.current === datasetKey) return
    datasetRef.current = datasetKey
    oldestLaidOutRef.current = undefined
    dispatch({type: 'datasetChanged'})
  }, [datasetKey, dispatch])

  // Center on the search hit once it actually appears in the loaded list. Centering
  // on the raw centeredOrdinal change is unreliable: navigating to a hit reloads the
  // thread centered on it, so messageOrdinals is briefly empty (idx -1) when the
  // ordinal changes. Wait for the target to load, then scroll. A layout effect ahead of the first
  // load's, which relies on a centre request having taken the end already.
  React.useLayoutEffect(() => {
    dispatch({
      atNewest: () => {
        const {offset} = metricsRef.current
        return containsLatestMessage && offset !== undefined && atEnd(offset)
      },
      centeredOrdinal,
      loaded,
      targetInData: centeredOrdinal !== undefined && indexOfOrdinalNewestFirst(messageOrdinals, centeredOrdinal) >= 0,
      type: 'threadObserved',
    })
  }, [atEnd, centeredOrdinal, containsLatestMessage, dispatch, loaded, messageOrdinals])

  // Whether the row is wholly in the part of the list nothing covers: the keyboard, and the composer
  // riding it, cover its bottom by as much as the resting offset sits below 0. The list's own
  // viewability measures against the whole scroll view, covered or not.
  const [rowFullyVisible] = React.useState(() => (ordinal: T.Chat.Ordinal) => {
    const frame = rowFramesRef.current.get(ordinal)
    const {offset, viewport} = metricsRef.current
    if (!frame || offset === undefined || viewport === undefined) return false
    return (
      frame.y >= offset - restingOffset() - rowEdgeTolerance &&
      frame.y + frame.height <= offset + viewport + rowEdgeTolerance
    )
  })

  React.useEffect(() => {
    dispatch({
      ordinal: editingOrdinal,
      rowFullyVisible: () => editingOrdinal !== undefined && rowFullyVisible(editingOrdinal),
      targetInData: editingOrdinal !== undefined && indexOfOrdinalNewestFirst(messageOrdinals, editingOrdinal) >= 0,
      type: 'editingChanged',
    })
  }, [dispatch, editingOrdinal, messageOrdinals, rowFullyVisible])

  // The keyboard rising or falling, or the safe area changing, changes how much of the list is in view.
  // The keyboard's is judged once it has finished moving, and the list with it: the keyboard scroll
  // view carries the rows up as the keyboard rises, so a row near the top is pushed off only by the
  // end of the rise, and whether the keyboard counts as visible flips as it starts. The safe area's is
  // compared by value, so a freeze/thaw re-mount changes nothing.
  React.useEffect(() => {
    const coverChanged = () => dispatch({anchorsEnd: false, rowFullyVisible, type: 'viewportResized'})
    const subscriptions = [
      KeyboardEvents.addListener('keyboardDidShow', coverChanged),
      KeyboardEvents.addListener('keyboardDidHide', coverChanged),
    ]
    return () => subscriptions.forEach(s => s.remove())
  }, [dispatch, rowFullyVisible])
  const coveredInsetRef = React.useRef(bottomInset)
  React.useEffect(() => {
    if (coveredInsetRef.current === bottomInset) return
    coveredInsetRef.current = bottomInset
    dispatch({anchorsEnd: false, rowFullyVisible, type: 'viewportResized'})
  }, [bottomInset, dispatch, rowFullyVisible])

  // When keyboard is open, maintainVisibleContentPosition adjusts contentOffset by the new
  // message height when a message is added, undoing the scrollToBottom from onSubmit.
  // Defer the re-scroll past the native MPV adjustment (which runs on the UI thread after
  // React's commit) so the newest message stays visible.
  // An append is a newer newest message than the dataset already held, arriving while the thread held
  // the newest message. Older rows arriving (scrolling up loads them) leave the newest where it was,
  // a page of newer rows loading into a window of history is not a new message, and the reload that
  // refills a cleared thread has nothing to append to; re-pinning for any of them would yank the
  // reader to the bottom.
  const newestOrdinal = messageOrdinals[0]
  const prevNewestRef = React.useRef(newestOrdinal)
  // The dataset prevNewestRef's baseline belongs to, compared by value so a freeze/thaw re-mount
  // does not reset it.
  const newestBaselineDatasetRef = React.useRef(datasetKey)
  const isKeyboardVisibleRef = React.useRef(isKeyboardVisible)
  React.useLayoutEffect(() => {
    isKeyboardVisibleRef.current = isKeyboardVisible
  })
  React.useLayoutEffect(() => {
    const sameDataset = newestBaselineDatasetRef.current === datasetKey
    newestBaselineDatasetRef.current = datasetKey
    const prev = prevNewestRef.current
    prevNewestRef.current = newestOrdinal
    const isNewer = newestOrdinal !== undefined && prev !== undefined && newestOrdinal > prev
    if (!sameDataset || !isNewer || !heldLatest) return undefined
    // Decided when the re-pin would fire, with the keyboard as it is then: if it closed in between,
    // the list's own anchor already shows the newest message.
    const repin = timers.after(0, () => {
      dispatch({anchorHidesNewest: isKeyboardVisibleRef.current, type: 'appended'})
    })
    return repin.cancel
  }, [datasetKey, dispatch, heldLatest, newestOrdinal, timers])

  // Stores the conversation it last applied to (not a boolean) so a freeze/thaw of this screen —
  // which re-mounts effects without a real conversation change — does not reset it and re-trigger
  // the initial scroll, which would lose the user's scroll position (e.g. returning from the info
  // panel). It resets implicitly when conversationIDKey changes.
  const loadedConvRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && loadedConvRef.current !== conversationIDKey
    if (loaded) {
      loadedConvRef.current = conversationIDKey
    }
    if (!justLoaded) return
    dispatch({hasMessages: numOrdinals > 0, retry: false, type: 'initialLoad'})
  }, [conversationIDKey, dispatch, loaded, numOrdinals])

  // Hidden (a screen pushed over this one) or unmounted: nothing scheduled may scroll a list no
  // longer shown. Work cut short is left to be done again if the list comes back: a target still
  // settling is centred afresh, and a first load whose retry had not fired is treated as not yet
  // scrolled. StrictMode's mount-time effect re-run is the same case.
  React.useEffect(
    () => () => {
      if (initialRetryRef.current?.pending()) loadedConvRef.current = undefined
      dispatchRef.current({type: 'detached'})
    },
    []
  )

  // Waits for more rows to render and asks for the failed row again, six times per request, while the
  // request lasts.
  const [onScrollToIndexFailed] = React.useState(() => (info: {index: number}) => {
    const item = ordsRef.current[info.index]
    const request = item === undefined ? undefined : itemScrollsRef.current.get(item)
    if (item === undefined || !request || request.retries > 5) return
    request.retries += 1
    timers.after(200, () => {
      if (itemScrollsRef.current.get(item) !== request) return
      scrollToItem(item, request.kind)
    })
  })

  // Loads a page as the list comes within pageLoadScreens of either end of the rows loaded, measured
  // from where it is scrolled to: checked as it scrolls, as its content or viewport changes size, and
  // once the gate after new rows has passed, so a short page, or a page landing with the reader still,
  // loads the next without a scroll. The list is inverted: its offset rises toward the oldest row, and
  // the newest rests at the resting offset, where the list sits until it first reports a scroll.
  const loadsRef = React.useRef({newer: loadNewer, older: loadOlder})
  React.useEffect(() => {
    loadsRef.current = {newer: loadNewer, older: loadOlder}
  }, [loadNewer, loadOlder])
  const containsLatestRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestRef.current = containsLatestMessage
  }, [containsLatestMessage])
  const nextLoadRef = React.useRef({newer: 0, older: 0})
  const [loadPages] = React.useState(() => () => {
    const {content, viewport} = metricsRef.current
    const offset = metricsRef.current.offset ?? restingOffset()
    const oldestLaidOut = oldestLaidOutRef.current
    if (content === undefined || viewport === undefined || oldestLaidOut === undefined) return
    // The content ends at the oldest row laid out, which the list keeps within a screen of the view
    // however many rows are loaded past it; those rows count toward the distance at the average height
    // of the rows laid out, or the oldest end would always look a screen away.
    const ords = ordsRef.current
    const notNewer = sortedIndexBy(ords as unknown as Array<number>, oldestLaidOut as unknown as number, o => -o)
    const laidOut = notNewer + (ords[notNewer] === oldestLaidOut ? 1 : 0)
    const notLaidOut = ords.length - laidOut
    const near = (end: 'newer' | 'older', distance: number) => {
      if (!withinPageLoad(distance, viewport)) return
      const now = Date.now()
      if (now <= nextLoadRef.current[end]) return
      nextLoadRef.current[end] = now + pageLoadGate
      loadsRef.current[end]()
    }
    near('older', content - offset - viewport + (notLaidOut * content) / Math.max(laidOut, 1))
    // A thread holding the newest message has nothing newer to load.
    if (!containsLatestRef.current) near('newer', offset - restingOffset())
  })
  // Only new rows schedule a check of their own: a load that brought none leaves nothing more to ask
  // for until the list moves or changes size.
  const pageChecks = useSchedule()
  React.useEffect(() => {
    const next = Date.now() + pageLoadGate
    nextLoadRef.current = {newer: next, older: next}
    return pageChecks.after(pageLoadGate + 1, loadPages).cancel
  }, [loadPages, numOrdinals, pageChecks])

  // Who moved the list is read from how it moved, never from the input that moved it: a drag, the
  // status bar, VoiceOver alike. The list moves itself only by the scrolls it issues (toward where they
  // are going), by its content changing size (its content-position anchor holding the rows in view in
  // place) or its resting offset moving (the keyboard, the safe area), and, while it holds the end, by
  // its anchor bringing a new message into view. Any other movement is the reader's.
  const onScroll = React.useCallback(
    (e: {
      nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}; layoutMeasurement: {height: number}}
    }) => {
      const content = e.nativeEvent.contentSize.height
      const offset = e.nativeEvent.contentOffset.y
      const resting = restingOffset()
      metricsRef.current = {content, offset, viewport: e.nativeEvent.layoutMeasurement.height}
      const last = lastScrollRef.current
      lastScrollRef.current = {content, offset, resting}
      const readerMoved =
        !!last &&
        Math.abs(offset - last.offset) >= stillPoints &&
        content === last.content &&
        resting === last.resting &&
        !own.carries(last.offset, offset) &&
        !(ownsEnd(scrollTarget.state) && Math.abs(offset - resting) < Math.abs(last.offset - resting))
      if (readerMoved) dispatch(own.readerMoved())
      loadPages()
    },
    [dispatch, loadPages, own, restingOffset, scrollTarget]
  )
  const [onContentSizeChange] = React.useState(() => (_w: number, h: number) => {
    metricsRef.current = {...metricsRef.current, content: h}
    loadPages()
  })
  const [onLayout] = React.useState(() => (e: {nativeEvent: {layout: {height: number}}}) => {
    metricsRef.current = {...metricsRef.current, viewport: e.nativeEvent.layout.height}
    loadPages()
  })
  // A drag is the reader's for certain, and is seen before it moves anything.
  const onScrollBeginDrag = React.useCallback(() => {
    dispatch(own.readerMoved())
  }, [dispatch, own])

  // The list coming to rest: the reader letting go, a fling or a status-bar tap's scroll stopping, or
  // (on iOS) a scroll of the list's own ending, which hands nothing back.
  const rested = React.useCallback(
    (e: {nativeEvent: {contentOffset: {y: number}}}) => {
      const handedBack = own.rested(atEnd(e.nativeEvent.contentOffset.y))
      if (handedBack) dispatch(handedBack)
    },
    [atEnd, dispatch, own]
  )
  // Letting go is where the list comes to rest only when the finger lifts still; moving, it flings on,
  // and it comes to rest where the fling ends. On Android a fling's end is reported even after a still
  // lift, and finds the reader's rest already taken.
  const onScrollEndDrag = React.useCallback(
    (e: {nativeEvent: {contentOffset: {y: number}; velocity?: {y: number}}}) => {
      if (e.nativeEvent.velocity?.y) return
      rested(e)
    },
    [rested]
  )

  // Data indices of the first and last viewable rows; the corrector steps from them.
  const [onViewableRange] = React.useState(
    () => (first: number | null | undefined, last: number | null | undefined) => {
      vFirstRef.current = first
      vLastRef.current = last
      correctCenter(first, last)
    }
  )
  const [onCellLayout] = React.useState(() => (item: T.Chat.Ordinal, layout: {height: number; y: number}) => {
    rowFramesRef.current.set(item, {height: layout.height, y: layout.y})
    const oldest = oldestLaidOutRef.current
    if (oldest === undefined || item < oldest) oldestLaidOutRef.current = item
  })

  const requestBottom = React.useCallback(() => {
    dispatch({centeredOrdinal: centeredRef.current, type: 'scrollToBottomRequested'})
  }, [dispatch])

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom: requestBottom, scrollUp: noop})
  }, [requestBottom, setScrollRef])

  const mvpAutoscroll =
    listAnchorsEnd({centeredOrdinal, heldLatest, listOwnsEnd}) && numOrdinals > 0 && !isKeyboardVisible

  return {
    maintainVisibleContentPosition: mvpAutoscroll
      ? maintainVisibleContentPositionClosed
      : maintainVisibleContentPositionNoAutoscroll,
    onCellLayout,
    onContentSizeChange,
    onLayout,
    onScroll,
    onMomentumScrollEnd: rested,
    onScrollBeginDrag,
    onScrollEndDrag,
    onScrollToIndexFailed,
    onScrollToTop: rested,
    onViewableRange,
    scrollToBottom: requestBottom,
  }
}

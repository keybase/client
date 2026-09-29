// Native adapter for the thread scroll target: turns what the inverted FlatList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API: coarse
// scrollToItem reasserts, then a closed-loop corrector against the viewable range.
import * as React from 'react'
import type * as T from '@/constants/types'
import noop from 'lodash/noop'
import {ThreadRefsContext} from '../normal/context'
import {useComposerAnchor} from '../composer-viewport-context'
import {restingScrollOffset} from '../composer-geometry'
import {makeOwnScrolls} from './own-scrolls'
import {
  listAnchorsEnd,
  ownsEnd,
  useHeldLatest,
  useScrollTarget,
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'
import {makeSchedule, type Scheduled} from './schedule'

export type NativeListRef = {
  scrollToOffset: (opts: {animated: boolean; offset: number}) => void
  scrollToItem: (opts: {animated: boolean; item: unknown; viewPosition?: number}) => void
}

// The maintainVisibleContentPosition prop must ALWAYS be set (never toggled to undefined):
// RN Fabric only re-snapshots the MVP anchor while the prop is set, so an unset->set
// transition adjusts contentOffset against a stale anchor frame from before the prop was
// unset — a spurious jump + autoscroll animation of the whole list (seen after dismissing
// the keyboard following a send). Instead we swap between two configs:
// - closed (keyboard hidden): autoscrollToTopThreshold=1 so new messages at the bottom
//   auto-reveal when the user is pinned there.
// - noAutoscroll (keyboard open, or centered on a search hit, or a window of history, or empty
//   list): MVP still anchors content, but autoscroll-to-top is off because:
//   1. with the keyboard open contentOffset.y = -(K-insets.bottom) <= 1, so the threshold
//      would fire on insert and scroll to y=0, hiding new messages behind the keyboard.
//   2. while centered on a search hit, autoscroll yanks the centered row.
//   3. in a window of history (listAnchorsEnd), a page of newer rows loading at the bottom would
//      carry the reader down with it.
//   With the keyboard open, MVP's insert adjustment briefly holds old content in place;
//   the deferred re-pin on append below re-pins the newest message.
const maintainVisibleContentPositionClosed = {
  autoscrollToTopThreshold: 1,
  minIndexForVisible: 0,
}
const maintainVisibleContentPositionNoAutoscroll = {
  minIndexForVisible: 0,
}

// Whether the row at this data index is wholly in view. The viewable range counts rows in view at all,
// so the rows at its edges may be cut off by the viewport, except the newest row (data index 0) with
// the list at its end, which rests wholly above the composer.
const rowFullyVisible = (
  index: number,
  first: number | null | undefined,
  last: number | null | undefined,
  listAtEnd: boolean
) => first != null && last != null && ((index > first && index < last) || (index === 0 && first === 0 && listAtEnd))

// An offset within this many points of the resting offset is at the end.
const endTolerance = 8
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
  loaded: boolean
}) => {
  const {centeredOrdinal, containsLatestMessage, conversationIDKey, datasetKey, editingOrdinal} = p
  const {isKeyboardVisible} = p
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

  const scrollTarget = useScrollTarget()
  const [own] = React.useState(makeOwnScrolls)
  const heldLatest = useHeldLatest(containsLatestMessage)

  // What the list has reported of itself, undefined until it does. The list is keyed by conversation,
  // so a switch brings a new list that starts unmeasured, and the old one's figures say nothing of it.
  const metricsRef = React.useRef<{content?: number; offset?: number; viewport?: number}>({})
  const vFirstRef = React.useRef<number | null | undefined>(undefined)
  const vLastRef = React.useRef<number | null | undefined>(undefined)

  // Every scroll the list makes itself goes through these, saying where it is going, so the movement
  // toward there and the rest that follows are its own.
  const [scrollToOffset] = React.useState(() => (offset: number) => {
    own.issued(metricsRef.current.offset, offset)
    listRef.current?.scrollToOffset({animated: false, offset})
  })
  // Where a row lands is not known ahead, only which way it lies: older rows sit at higher offsets.
  const [scrollToItem] = React.useState(() => (item: T.Chat.Ordinal, animated: boolean) => {
    const index = ordsRef.current.indexOf(item)
    const first = vFirstRef.current
    const last = vLastRef.current
    const to =
      first == null || last == null || index < 0
        ? undefined
        : index > last
          ? Infinity
          : index < first
            ? -Infinity
            : undefined
    own.issued(metricsRef.current.offset, to)
    listRef.current?.scrollToItem({animated, item, viewPosition: 0.5})
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
          scrollToItem(target, false)
        })
      ;[50, 250].forEach(reassert)
    },
    [scrollToItem, timers]
  )

  // Closed-loop centering corrector. scrollToItem/scrollToIndex lands at the wrong
  // offset here (inverted list + custom keyboard scrollview + tall variable-height
  // image rows), so instead we read the actual viewable index range each frame and
  // scrollToOffset by the item-delta until the target sits at viewport center.
  // {active, iters}: correcting toward a centered hit and how many steps taken
  const correctRef = React.useRef({active: false, iters: 0})
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
  }, [conversationIDKey])
  // The rows asked for by scrollToItem, each asked for by a centre or a reveal, with how many of its
  // failures have been retried: a row outside the rendered window makes the scroll fail, and the
  // retry asks for that same row again once more rows have rendered.
  const itemScrollsRef = React.useRef(new Map<T.Chat.Ordinal, {animated: boolean; retries: number}>())
  const [requestItem] = React.useState(() => (item: T.Chat.Ordinal, animated: boolean) => {
    itemScrollsRef.current.set(item, {animated, retries: 0})
  })
  const [stopCentering] = React.useState(() => () => {
    correctRef.current.active = false
    itemScrollsRef.current.clear()
    timers.stop()
  })
  const [settleCenter] = React.useState(() => () => {
    if (!correctRef.current.active) return
    correctRef.current.active = false
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
      const targetIdx = ords.indexOf(co)
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

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) stopCentering()
          // The end is a fixed resting offset, so every pin is the one scroll there: from the end it moves
          // nothing, and there is no bootstrap of the list's own to wait out.
          scrollToOffset(restingOffset())
          return
        case 'center':
          requestItem(directive.ordinal, false)
          moveToward(directive.ordinal)
          correctRef.current = {active: true, iters: 0}
          ladderRef.current.forEach(t => t.cancel())
          ladderRef.current = [50, 250, 500, 900].map((d, i, ladder) =>
            timers.after(d, () => {
              correctCenter(vFirstRef.current, vLastRef.current)
              if (i === ladder.length - 1) settleCenter()
            })
          )
          return
        case 'reveal':
          requestItem(directive.ordinal, true)
          scrollToItem(directive.ordinal, true)
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

  // Compared by value, not by the effect re-running: a freeze/thaw of this screen re-mounts effects
  // with nothing changed. Declared ahead of every effect that dispatches, so they see the new
  // dataset's state.
  const datasetRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (datasetRef.current === datasetKey) return
    datasetRef.current = datasetKey
    dispatch({type: 'datasetChanged'})
  }, [datasetKey, dispatch])

  // Center on the search hit once it actually appears in the loaded list. Centering
  // on the raw centeredOrdinal change is unreliable: navigating to a hit reloads the
  // thread centered on it, so messageOrdinals is briefly empty (idx -1) when the
  // ordinal changes. Wait for the target to load, then scroll. A layout effect ahead of the first
  // load's, which relies on a centre request having taken the end already.
  React.useLayoutEffect(() => {
    dispatch({
      centeredOrdinal,
      loaded,
      targetInData: centeredOrdinal !== undefined && messageOrdinals.includes(centeredOrdinal),
      type: 'threadObserved',
    })
  }, [centeredOrdinal, dispatch, loaded, messageOrdinals])

  React.useEffect(() => {
    const index = editingOrdinal === undefined ? -1 : messageOrdinals.indexOf(editingOrdinal)
    dispatch({
      ordinal: editingOrdinal,
      rowFullyVisible: () =>
        rowFullyVisible(index, vFirstRef.current, vLastRef.current, atEnd(metricsRef.current.offset ?? Infinity)),
      targetInData: index >= 0,
      type: 'editingChanged',
    })
  }, [atEnd, dispatch, editingOrdinal, messageOrdinals])

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
  const initialRetryRef = React.useRef<Scheduled | undefined>(undefined)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && loadedConvRef.current !== conversationIDKey
    if (loaded) {
      loadedConvRef.current = conversationIDKey
    }
    if (!justLoaded) return

    const directive = scrollTarget.decide({hasMessages: numOrdinals > 0, type: 'initialLoad'})
    perform(directive)
    // Once more 100ms on, asking again with the rows as they are then, so a centre requested in
    // between is not undone by a scroll to the end.
    if (directive.type === 'pinEnd') {
      initialRetryRef.current = timers.after(100, () => {
        dispatch({hasMessages: ordsRef.current.length > 0, type: 'initialLoad'})
      })
    }
  }, [conversationIDKey, dispatch, loaded, numOrdinals, perform, scrollTarget, timers])

  // Hidden (a screen pushed over this one) or unmounted: nothing scheduled may scroll a list no
  // longer shown. Work cut short is left to be done again if the list comes back: a target still
  // settling is centred afresh, and a first load whose retry had not fired is treated as not yet
  // scrolled. StrictMode's mount-time effect re-run is the same case. dispatch never changes identity,
  // so this cleanup runs only then.
  React.useEffect(
    () => () => {
      if (initialRetryRef.current?.pending()) loadedConvRef.current = undefined
      dispatch({type: 'detached'})
    },
    [dispatch]
  )

  // Waits for more rows to render and asks for the failed row again, six times per request.
  const [onScrollToIndexFailed] = React.useState(() => (info: {index: number}) => {
    const item = ordsRef.current[info.index]
    const request = item === undefined ? undefined : itemScrollsRef.current.get(item)
    if (item === undefined || !request || request.retries > 5) return
    request.retries += 1
    timers.after(200, () => {
      scrollToItem(item, request.animated)
    })
  })

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
      if (!last || Math.abs(offset - last.offset) < stillPoints) return
      if (content !== last.content || resting !== last.resting) return
      if (own.carries(last.offset, offset)) return
      if (ownsEnd(scrollTarget.state) && Math.abs(offset - resting) < Math.abs(last.offset - resting)) return
      dispatch(own.readerMoved())
    },
    [dispatch, own, restingOffset, scrollTarget]
  )
  const [onContentSizeChange] = React.useState(() => (_w: number, h: number) => {
    metricsRef.current = {...metricsRef.current, content: h}
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

  const requestBottom = React.useCallback(() => {
    dispatch({centeredOrdinal: centeredRef.current, type: 'scrollToBottomRequested'})
  }, [dispatch])

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom: requestBottom, scrollUp: noop})
  }, [requestBottom, setScrollRef])

  const mvpAutoscroll = listAnchorsEnd(centeredOrdinal, heldLatest) && numOrdinals > 0 && !isKeyboardVisible

  return {
    maintainVisibleContentPosition: mvpAutoscroll
      ? maintainVisibleContentPositionClosed
      : maintainVisibleContentPositionNoAutoscroll,
    onContentSizeChange,
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

// Desktop adapter for the thread scroll target: turns what the LegendList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API.
import * as React from 'react'
import type * as T from '@/constants/types'
import type {LegendListRef} from '@/common-adapters'
import {ThreadRefsContext} from '../normal/context'
import {makeOwnScrolls} from './own-scrolls'
import {useSchedule} from './schedule'
import {
  indexOfOrdinal,
  initialScrollTarget,
  listAnchorsEnd,
  type ScrollDirective,
  type ScrollEvent,
} from './scroll-target'
import {useHeldLatest, useScrollTarget} from './use-scroll-target'
import {
  distanceToEnd,
  listMovedItself,
  offsetFromMiddle as rowOffsetFromMiddle,
  pageOffset,
  revealDestination,
  rowWithinView,
  scrollerAtEnd,
  type RectLike,
  type ScrollerLike,
} from './desktop-rules'

type ListenerOptions = {capture: boolean}
type ScrollListener = (e: {target: unknown}) => void
type ListenerTarget = {
  addEventListener: (type: string, listener: ScrollListener, options: ListenerOptions) => void
  removeEventListener: (type: string, listener: ScrollListener, options: ListenerOptions) => void
}
type MeasurableScroller = {
  getBoundingClientRect: () => RectLike
  querySelector: (s: string) => {getBoundingClientRect: () => RectLike} | null
}

// The ordinal's row and the viewport (the scroller, not the wrapper around it, whose padding reaches
// below the view) as laid out now; undefined while the row is not rendered.
const measureRow = (scroller: unknown, ordinal: T.Chat.Ordinal) => {
  const s = scroller as MeasurableScroller | null | undefined
  const el = s?.querySelector(`[data-ordinal="${ordinal}"]`)
  if (!s || !el) return undefined
  return {row: el.getBoundingClientRect(), view: s.getBoundingClientRect()}
}

// Undefined while the row is not rendered.
const offsetFromMiddle = (scroller: unknown, ordinal: T.Chat.Ordinal) => {
  const m = measureRow(scroller, ordinal)
  return m && rowOffsetFromMiddle(m.row, m.view)
}

// With the scroller at its end when atEnd; a row not rendered is not in view.
const rowFullyVisible = (scroller: unknown, ordinal: T.Chat.Ordinal, atEnd: boolean) => {
  const m = measureRow(scroller, ordinal)
  if (!m) return false
  return rowWithinView(m.row, m.view, atEnd ? distanceToEnd(scroller as ScrollerLike) : 0)
}

export const useDesktopThreadScroll = (p: {
  centeredOrdinal: T.Chat.Ordinal | undefined
  containsLatestMessage: boolean
  datasetKey: string
  editingOrdinal: T.Chat.Ordinal | undefined
  listRef: React.RefObject<LegendListRef | null>
  loaded: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  wrapperRef: React.RefObject<HTMLDivElement | null>
}) => {
  const {centeredOrdinal, containsLatestMessage, datasetKey, editingOrdinal} = p
  const {listRef, loaded, messageOrdinals, wrapperRef} = p

  // The list's scrolling element, whether or not its content overflows it.
  const scrollerOf = React.useCallback(
    () => listRef.current?.getScrollableNode() as ScrollerLike | null | undefined,
    [listRef]
  )

  // Read by the loops below as they run, so they see the thread as it is now rather than when they
  // started.
  const messageOrdinalsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    messageOrdinalsRef.current = messageOrdinals
  }, [messageOrdinals])

  const {listOwnsEnd, scrollTarget} = useScrollTarget()
  const [own] = React.useState(makeOwnScrolls)
  const heldLatest = useHeldLatest(containsLatestMessage, datasetKey, messageOrdinals)
  const anchorsEnd = listAnchorsEnd({centeredOrdinal, heldLatest, listOwnsEnd})
  // Read by the list's callbacks, which report after the commit that set it.
  const anchorsEndRef = React.useRef(anchorsEnd)
  React.useLayoutEffect(() => {
    anchorsEndRef.current = anchorsEnd
  }, [anchorsEnd])

  // Every "is the list at its end?" asks the scroller, never the list's own isAtEnd. The list re-reads
  // that flag only when it scrolls or lays out, so it lags both ways: a row or the header growing at
  // the end with nothing scrolling leaves it reading at-end while the scroller is short, and a
  // composer collapse leaves it reading not-at-end while the scroller is at its end.
  const isScrolledToEnd = React.useCallback(() => {
    const scroller = scrollerOf()
    return !!scroller && scrollerAtEnd(scroller)
  }, [scrollerOf])

  // Where the scroller last was, to tell the reader's movements from the list's (onScrollerScroll).
  const lastOffsetRef = React.useRef(0)

  // Outlives re-renders: the rows that make centring accurate arrive after it starts, so no effect
  // cleanup on messageOrdinals may tear it down.
  const centering = useSchedule()

  // The list's scrollToIndex keeps aiming at the target as the rows above it measure, and resolves
  // once it has landed; centring ends there, and maintainVisibleContentPosition holds it after.
  //
  // Through LegendList's own scroll, never scrollIntoView: touching scrollTop directly desyncs
  // LegendList's internal scroll state, and the next time it recomputes item positions it snaps
  // somewhere unrelated.
  const scrollToCentered = React.useCallback(
    (target: T.Chat.Ordinal) => {
      centering.stop()
      centering.start(async sleep => {
        const index = indexOfOrdinal(messageOrdinalsRef.current, target)
        if (index >= 0) await listRef.current?.scrollToIndex({animated: false, index, viewPosition: 0.5})
        // stopped while it scrolled: the reader or a new target took over
        if (!(await sleep(0))) return
        // centerSettled only ever leaves the list alone.
        scrollTarget.decide({type: 'centerSettled'})
      })
    },
    [centering, listRef, scrollTarget]
  )

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) centering.stop()
          void listRef.current?.scrollToEnd({animated: false})
          return
        case 'center': {
          // A centred load lays the cleared thread out again from the top, and the browser reports that
          // jump only after the target has arrived. Taken for the reader's, it stopped the centring
          // whenever the list had not been at the top already (every other reopening of a search).
          const scroller = scrollerOf()
          if (scroller) lastOffsetRef.current = scroller.scrollTop
          scrollToCentered(directive.ordinal)
          return
        }
        case 'reveal': {
          const idx = indexOfOrdinal(messageOrdinalsRef.current, directive.ordinal)
          const scroller = scrollerOf()
          const state = listRef.current?.getState()
          if (idx < 0 || !scroller || !state) return
          // The list records an animated scroll's target only as it arrives, so this one says where it is
          // going itself.
          const from = scroller.scrollTop
          const to = revealDestination({
            from,
            max: scroller.scrollHeight - scroller.clientHeight,
            offBy: offsetFromMiddle(scroller, directive.ordinal),
            rowBeforeRendered: idx < state.start,
          })
          if (own.issued(from, to, true)) {
            void listRef.current?.scrollToIndex({animated: true, index: idx, viewPosition: 0.5})
          }
          return
        }
        case 'leaveAlone':
          if (directive.stopCentering) centering.stop()
          return
        default: {
          const unexpected: never = directive
          return unexpected
        }
      }
    },
    [centering, listRef, own, scrollToCentered, scrollerOf]
  )

  const dispatch = React.useCallback(
    (event: ScrollEvent) => {
      perform(scrollTarget.decide(event))
    },
    [perform, scrollTarget]
  )
  // The detached cleanup reads dispatch through this, so it runs only when the list is hidden or
  // unmounted, however dispatch's dependencies change.
  const dispatchRef = React.useRef(dispatch)
  React.useLayoutEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

  // Compared by value, not by the effect re-running: selecting the chat tab again re-mounts effects
  // hidden under Activity with nothing changed. The end being verified belongs to the old rows.
  const datasetRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (datasetRef.current === datasetKey) return
    datasetRef.current = datasetKey
    dispatch({type: 'datasetChanged'})
  }, [datasetKey, dispatch])

  // Level-triggered on purpose: centring has to start when loaded flips true after the target was
  // already set, and when the target arrives in the thread after the request.
  React.useEffect(() => {
    dispatch({
      atNewest: () => containsLatestMessage && isScrolledToEnd(),
      centeredOrdinal,
      loaded,
      targetInData: centeredOrdinal !== undefined && indexOfOrdinal(messageOrdinals, centeredOrdinal) >= 0,
      type: 'threadObserved',
    })
  }, [centeredOrdinal, containsLatestMessage, dispatch, isScrolledToEnd, loaded, messageOrdinals])

  // Hidden (another tab selected, under Activity) or unmounted: the loops have stopped with the
  // schedules, and a target still settling is centred afresh if the list comes back.
  React.useEffect(() => () => dispatchRef.current({type: 'detached'}), [])

  React.useEffect(() => {
    const targetInData = editingOrdinal !== undefined && indexOfOrdinal(messageOrdinals, editingOrdinal) >= 0
    dispatch({
      ordinal: editingOrdinal,
      rowFullyVisible: () =>
        editingOrdinal !== undefined && rowFullyVisible(scrollerOf(), editingOrdinal, anchorsEndRef.current),
      targetInData,
      type: 'editingChanged',
    })
  }, [dispatch, editingOrdinal, messageOrdinals, scrollerOf])

  // The list's viewport as it last reported it; its first report is where it starts, not a change.
  const viewportRef = React.useRef<number | undefined>(undefined)
  // Reported once the list has recorded the new viewport, so a scroll issued from here aims at it.
  const onLayout = React.useCallback(
    (e: {nativeEvent: {layout: {height: number}}}) => {
      const {height} = e.nativeEvent.layout
      const previous = viewportRef.current
      viewportRef.current = height
      if (previous === undefined || previous === height) return
      dispatch({
        rowFullyVisible: ordinal => rowFullyVisible(scrollerOf(), ordinal, anchorsEndRef.current),
        type: 'viewportResized',
      })
    },
    [dispatch, scrollerOf]
  )

  // Who moved the scroller is read from where it moved to (listMovedItself), never from the input that
  // moved it: the list writes down where it is putting the scroller before it moves it (its initial
  // position, every scrollTo, its end anchor, holding rows in place as they measure), and anything
  // else that moved it is the reader, however they did it.
  const onScrollerScroll = React.useCallback(
    (e: {target: unknown}) => {
      // Scroll events reach the wrapper from anything scrollable inside it; only the list's own counts.
      const scroller = scrollerOf()
      if (!scroller || e.target !== scroller) return
      const now = scroller.scrollTop
      const from = lastOffsetRef.current
      if (now === from) return
      lastOffsetRef.current = now
      if (own.carries(from, now)) return
      const listState = listRef.current?.getState()
      if (!listState) return
      const maxScroll = scroller.scrollHeight - scroller.clientHeight
      if (listMovedItself({from, listScroll: listState.scroll, maxScroll, now})) return
      dispatch(own.readerMoved())
    },
    [dispatch, listRef, own, scrollerOf]
  )

  const onScrollerRest = React.useCallback(
    (e: {target: unknown}) => {
      if (e.target !== scrollerOf()) return
      const handedBack = own.rested(isScrolledToEnd())
      if (handedBack) dispatch(handedBack)
    },
    [dispatch, isScrolledToEnd, own, scrollerOf]
  )

  // Both caught on their way down to the scroller: scrollend does not bubble, and a scroll has to be
  // read before the list's own listener on the scroller writes its new offset down.
  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current as unknown as ListenerTarget | null
    if (!wrapper) return undefined
    // The scroller may have moved while the listeners were off (the list hidden under Activity).
    lastOffsetRef.current = scrollerOf()?.scrollTop ?? 0
    wrapper.addEventListener('scroll', onScrollerScroll, {capture: true})
    wrapper.addEventListener('scrollend', onScrollerRest, {capture: true})
    return () => {
      wrapper.removeEventListener('scroll', onScrollerScroll, {capture: true})
      wrapper.removeEventListener('scrollend', onScrollerRest, {capture: true})
    }
  }, [onScrollerRest, onScrollerScroll, scrollerOf, wrapperRef])

  const scrollToBottom = React.useCallback(() => {
    dispatch({centeredOrdinal, type: 'scrollToBottomRequested'})
  }, [centeredOrdinal, dispatch])

  // The composer's page keys scroll on the reader's behalf. A page that would move nothing (up at the
  // top, down at the end, either way in a thread too short to scroll) is no scroll at all.
  const page = React.useCallback(
    (direction: 'up' | 'down') => {
      const state = listRef.current?.getState()
      const scroller = scrollerOf()
      if (!state || !scroller) return
      if (direction === 'up' ? scroller.scrollTop <= 0 : isScrolledToEnd()) return
      dispatch(own.readerMoved())
      void listRef.current?.scrollToOffset({animated: false, offset: pageOffset(direction, state)})
    },
    [dispatch, isScrolledToEnd, listRef, own, scrollerOf]
  )
  const scrollUp = React.useCallback(() => page('up'), [page])
  const scrollDown = React.useCallback(() => page('down'), [page])

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown, scrollToBottom, scrollUp})
  }, [scrollDown, scrollToBottom, scrollUp, setScrollRef])

  const initialScrollIndex = React.useMemo(
    () => initialScrollTarget(messageOrdinals, centeredOrdinal),
    [messageOrdinals, centeredOrdinal]
  )

  return {
    initialScrollIndex,
    maintainScrollAtEnd: anchorsEnd,
    onLayout,
    scrollToBottom,
  }
}

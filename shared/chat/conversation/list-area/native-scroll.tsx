// Native adapter for the thread scroll target: turns what the inverted FlatList thread sees into
// scroll-target events and carries out each directive with the list's own imperative API: coarse
// scrollToItem reasserts, then a closed-loop corrector against the viewable range.
import * as React from 'react'
import type * as T from '@/constants/types'
import noop from 'lodash/noop'
import {ThreadRefsContext} from '../normal/context'
import {useComposerAnchor} from '../composer-viewport-context'
import {restingScrollOffset} from '../composer-geometry'
import {
  decideScroll,
  initialScrollTargetState,
  listAnchorsEnd,
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
// - noAutoscroll (keyboard open, or centered on a search hit, or empty list): MVP still
//   anchors content, but autoscroll-to-top is off because:
//   1. with the keyboard open contentOffset.y = -(K-insets.bottom) <= 1, so the threshold
//      would fire on insert and scroll to y=0, hiding new messages behind the keyboard.
//   2. while centered on a search hit, autoscroll yanks the centered row.
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

export const useNativeThreadScroll = (p: {
  // Newest first, as the inverted list holds them.
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  centeredOrdinal: T.Chat.Ordinal | undefined
  conversationIDKey: T.Chat.ConversationIDKey
  // Changes with the conversation and with every clear of its thread (a centred reload, jump to
  // recent): each is a new list as far as scrolling is concerned.
  datasetKey: string
  editingOrdinal: T.Chat.Ordinal | undefined
  isKeyboardVisible: boolean
  listRef: React.RefObject<NativeListRef | null>
  loaded: boolean
}) => {
  const {centeredOrdinal, conversationIDKey, datasetKey, editingOrdinal, isKeyboardVisible} = p
  const {listRef, loaded, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length

  const {bottomInset, keyboardHeight} = useComposerAnchor()
  const scrollToBottom = React.useCallback(() => {
    listRef.current?.scrollToOffset({
      animated: false,
      offset: restingScrollOffset(bottomInset, keyboardHeight.value),
    })
  }, [bottomInset, keyboardHeight, listRef])
  // perform reaches the end only through this, so it scrolls for the inset as it is when it runs, and
  // neither perform nor the effects that dispatch through it change identity with the inset.
  const scrollToBottomRef = React.useRef(scrollToBottom)
  React.useLayoutEffect(() => {
    scrollToBottomRef.current = scrollToBottom
  }, [scrollToBottom])

  // Read by timers and list callbacks as they fire, so they see the target and rows as they are now.
  const centeredRef = React.useRef(centeredOrdinal)
  // reset per centered target so each new search hit gets a fresh batch of retries
  const scrollFailRetryRef = React.useRef(0)
  React.useEffect(() => {
    centeredRef.current = centeredOrdinal
    scrollFailRetryRef.current = 0
  }, [centeredOrdinal])
  const ordsRef = React.useRef(messageOrdinals)
  React.useEffect(() => {
    ordsRef.current = messageOrdinals
  }, [messageOrdinals])

  const targetRef = React.useRef(initialScrollTargetState)
  const decide = React.useCallback((event: ScrollEvent) => {
    const {directive, state} = decideScroll(targetRef.current, event)
    targetRef.current = state
    return directive
  }, [])

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
          const list = listRef.current
          if (!list || centeredRef.current !== target) {
            return
          }
          list.scrollToItem({animated: false, item: target, viewPosition: 0.5})
        })
      ;[50, 250].forEach(reassert)
    },
    [listRef, timers]
  )

  // Closed-loop centering corrector. scrollToItem/scrollToIndex lands at the wrong
  // offset here (inverted list + custom keyboard scrollview + tall variable-height
  // image rows), so instead we read the actual viewable index range each frame and
  // scrollToOffset by the item-delta until the target sits at viewport center.
  const scrollOffsetRef = React.useRef(0)
  const contentHeightRef = React.useRef(0)
  const viewportHeightRef = React.useRef(0)
  // {active, iters}: correcting toward a centered hit and how many steps taken
  const correctRef = React.useRef({active: false, iters: 0})
  const vFirstRef = React.useRef<number | null | undefined>(undefined)
  const vLastRef = React.useRef<number | null | undefined>(undefined)
  const [stopCentering] = React.useState(() => () => {
    correctRef.current.active = false
    timers.stop()
  })
  const [settleCenter] = React.useState(() => () => {
    if (!correctRef.current.active) return
    correctRef.current.active = false
    // Only ever leaves the list alone.
    decide({type: 'centerSettled'})
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
      const avgH = contentHeightRef.current / num
      const maxOffset = Math.max(0, contentHeightRef.current - viewportHeightRef.current)
      // damp by 0.9 to avoid overshoot/oscillation; higher index = older = higher offset
      const newOffset = Math.min(maxOffset, Math.max(0, scrollOffsetRef.current + diff * avgH * 0.9))
      // A target among the newest or oldest rows cannot reach the middle: the step is clamped to the
      // end of the scrollable range and would move nothing, now or on any later try.
      if (Math.abs(newOffset - scrollOffsetRef.current) < 1) {
        settleCenter()
        return
      }
      st.iters += 1
      listRef.current?.scrollToOffset({animated: false, offset: newOffset})
    }
  )

  // The corrector's 50/250/500/900ms schedule, restarted by each center directive. It is the whole
  // budget: the target settles where the last step leaves it.
  const ladderRef = React.useRef<Array<Scheduled>>([])

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) stopCentering()
          // The end is a fixed resting offset, so every pin is the one scroll there: from the end it moves
          // nothing (unlessAtEnd), and there is no bootstrap of the list's own to wait out (whenSettled).
          scrollToBottomRef.current()
          return
        case 'center':
          if (directive.newTarget) moveToward(directive.ordinal)
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
          listRef.current?.scrollToItem({animated: true, item: directive.ordinal, viewPosition: 0.5})
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
    [correctCenter, listRef, moveToward, settleCenter, stopCentering, timers]
  )

  // Compared by value, not by the effect re-running: a freeze/thaw of this screen re-mounts effects
  // with nothing changed. Declared ahead of every effect that dispatches, so they see the new
  // dataset's state.
  const datasetRef = React.useRef<string | undefined>(undefined)
  React.useLayoutEffect(() => {
    if (datasetRef.current === datasetKey) return
    datasetRef.current = datasetKey
    perform(decide({type: 'datasetChanged'}))
  }, [datasetKey, decide, perform])

  // Center on the search hit once it actually appears in the loaded list. Centering
  // on the raw centeredOrdinal change is unreliable: navigating to a hit reloads the
  // thread centered on it, so messageOrdinals is briefly empty (idx -1) when the
  // ordinal changes. Wait for the target to load, then scroll. Every change to the rows under a
  // target still settling restarts the corrector's schedule. A layout effect ahead of the first
  // load's, which relies on a centre request having taken the end already.
  React.useLayoutEffect(() => {
    perform(
      decide({
        centeredOrdinal,
        loaded,
        targetInData: centeredOrdinal !== undefined && messageOrdinals.includes(centeredOrdinal),
        type: 'threadObserved',
      })
    )
  }, [centeredOrdinal, decide, loaded, messageOrdinals, perform])

  React.useEffect(() => {
    perform(
      decide({
        ordinal: editingOrdinal,
        targetInData: editingOrdinal !== undefined && messageOrdinals.includes(editingOrdinal),
        type: 'editingChanged',
      })
    )
  }, [decide, editingOrdinal, messageOrdinals, perform])

  // When keyboard is open, maintainVisibleContentPosition adjusts contentOffset by the new
  // message height when a message is added, undoing the scrollToBottom from onSubmit.
  // Defer the re-scroll past the native MPV adjustment (which runs on the UI thread after
  // React's commit) so the newest message stays visible.
  // An append is a newer newest message than the dataset already held. Older rows arriving
  // (scrolling up loads them) leave the newest where it was, and the reload that refills a cleared
  // thread has nothing to append to; re-pinning for either would yank the reader to the bottom.
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
    if (!sameDataset || !isNewer) return undefined
    const appended = () => decide({anchorHidesNewest: isKeyboardVisibleRef.current, type: 'appended'})
    if (appended().type !== 'pinEnd') return undefined
    // Asked again when it fires: if the keyboard closed in between, the list's own anchor already
    // shows the newest message.
    const repin = timers.after(0, () => {
      perform(appended())
    })
    return repin.cancel
  }, [datasetKey, decide, newestOrdinal, perform, timers])

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

    const directive = decide({hasMessages: numOrdinals > 0, type: 'initialLoad'})
    perform(directive)
    // Once more 100ms on, asking again with the rows as they are then, so a centre requested in
    // between is not undone by a scroll to the end.
    if (directive.type === 'pinEnd') {
      initialRetryRef.current = timers.after(100, () => {
        perform(decide({hasMessages: ordsRef.current.length > 0, type: 'initialLoad'}))
      })
    }
  }, [conversationIDKey, decide, loaded, numOrdinals, perform, timers])

  // Hidden (a screen pushed over this one) or unmounted: nothing scheduled may scroll a list no
  // longer shown. Work cut short is left to be done again if the list comes back: a target still
  // settling is centred afresh, and a first load whose retry had not fired is treated as not yet
  // scrolled. StrictMode's mount-time effect re-run is the same case. decide and perform never change
  // identity, so this cleanup runs only then.
  React.useEffect(
    () => () => {
      if (initialRetryRef.current?.pending()) loadedConvRef.current = undefined
      perform(decide({type: 'detached'}))
    },
    [decide, perform]
  )

  // The centered hit may be outside the rendered window, so scrollToItem fails
  // silently. Wait for more rows to render and retry centering (capped) until it lands.
  const [onScrollToIndexFailed] = React.useState(() => () => {
    if (scrollFailRetryRef.current > 5) {
      return
    }
    scrollFailRetryRef.current += 1
    timers.after(200, () => {
      const co = centeredRef.current
      if (co !== undefined) {
        listRef.current?.scrollToItem({animated: false, item: co, viewPosition: 0.5})
      }
    })
  })

  const [onScroll] = React.useState(
    () =>
      (e: {
        nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}; layoutMeasurement: {height: number}}
      }) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y
        contentHeightRef.current = e.nativeEvent.contentSize.height
        viewportHeightRef.current = e.nativeEvent.layoutMeasurement.height
      }
  )
  const [onContentSizeChange] = React.useState(() => (_w: number, h: number) => {
    contentHeightRef.current = h
  })
  // user touched the list: stop fighting them
  const onScrollBeginDrag = React.useCallback(() => {
    perform(decide({how: 'drag', type: 'userScrolled'}))
  }, [decide, perform])

  // A scroll coming to rest: the reader letting go, a fling stopping, or (on iOS) an animated scroll
  // of ours ending. Only coming to rest at the end, over the keyboard as it is now, counts, and that
  // is true however the list got there: the end goes back to the list.
  const onScrollSettled = React.useCallback(
    (e: {nativeEvent: {contentOffset: {y: number}}}) => {
      if (e.nativeEvent.contentOffset.y > restingScrollOffset(bottomInset, keyboardHeight.value) + endTolerance) return
      perform(decide({type: 'readerAtEnd'}))
    },
    [bottomInset, decide, keyboardHeight, perform]
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
    perform(decide({centeredOrdinal: centeredRef.current, type: 'scrollToBottomRequested'}))
  }, [decide, perform])

  const {setScrollRef} = React.useContext(ThreadRefsContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom: requestBottom, scrollUp: noop})
  }, [requestBottom, setScrollRef])

  const mvpAutoscroll = listAnchorsEnd(centeredOrdinal) && numOrdinals > 0 && !isKeyboardVisible

  return {
    maintainVisibleContentPosition: mvpAutoscroll
      ? maintainVisibleContentPositionClosed
      : maintainVisibleContentPositionNoAutoscroll,
    onContentSizeChange,
    onScroll,
    onMomentumScrollEnd: onScrollSettled,
    onScrollBeginDrag,
    onScrollEndDrag: onScrollSettled,
    onScrollToIndexFailed,
    onViewableRange,
    scrollToBottom: requestBottom,
  }
}

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

export const useNativeThreadScroll = (p: {
  // Newest first, as the inverted list holds them.
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  centeredOrdinal: T.Chat.Ordinal | undefined
  conversationIDKey: T.Chat.ConversationIDKey
  // Changes with the conversation and with every clear of its thread (a centred reload, jump to
  // recent): each is a new list as far as scrolling is concerned.
  datasetKey: string
  isKeyboardVisible: boolean
  listRef: React.RefObject<NativeListRef | null>
  loaded: boolean
}) => {
  const {centeredOrdinal, conversationIDKey, datasetKey, isKeyboardVisible, listRef, loaded, messageOrdinals} = p
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
  // unmounting cancels whatever is pending, and a reader's drag is never followed by a jump.
  const scheduledRef = React.useRef(new Set<ReturnType<typeof setTimeout>>())
  const [schedule] = React.useState(() => (delay: number, fn: () => void) => {
    const scheduled = scheduledRef.current
    const id = setTimeout(() => {
      scheduled.delete(id)
      fn()
    }, delay)
    scheduled.add(id)
    return id
  })
  const [cancelScheduled] = React.useState(() => (id: ReturnType<typeof setTimeout>) => {
    clearTimeout(id)
    scheduledRef.current.delete(id)
  })

  // coarse: scrollToItem lands at the wrong offset for tall variable-height rows,
  // but it gets the target area rendered. The closed-loop corrector below
  // refines from there using the real viewable index range.
  const moveToward = React.useCallback(
    (target: T.Chat.Ordinal) => {
      const reassert = (delay: number) =>
        schedule(delay, () => {
          const list = listRef.current
          if (!list || centeredRef.current !== target) {
            return
          }
          list.scrollToItem({animated: false, item: target, viewPosition: 0.5})
        })
      ;[50, 250].forEach(reassert)
    },
    [listRef, schedule]
  )

  // Closed-loop centering corrector. scrollToItem/scrollToIndex lands at the wrong
  // offset here (inverted list + custom keyboard scrollview + tall variable-height
  // image rows), so instead we read the actual viewable index range each frame and
  // scrollToOffset by the item-delta until the target sits at viewport center.
  const scrollOffsetRef = React.useRef(0)
  const contentHeightRef = React.useRef(0)
  // {active, iters}: correcting toward a centered hit and how many steps taken
  const correctRef = React.useRef({active: false, iters: 0})
  const vFirstRef = React.useRef<number | null | undefined>(undefined)
  const vLastRef = React.useRef<number | null | undefined>(undefined)
  const [stopCentering] = React.useState(() => () => {
    correctRef.current.active = false
    scheduledRef.current.forEach(clearTimeout)
    scheduledRef.current.clear()
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
        st.active = false
        decide({type: 'centerSettled'})
        return
      }
      st.iters += 1
      const avgH = contentHeightRef.current / num
      // damp by 0.9 to avoid overshoot/oscillation; higher index = older = higher offset
      const newOffset = Math.max(0, scrollOffsetRef.current + diff * avgH * 0.9)
      listRef.current?.scrollToOffset({animated: false, offset: newOffset})
    }
  )

  // The corrector's 50/250/500/900ms schedule, restarted by each refine.
  const ladderRef = React.useRef<Array<ReturnType<typeof setTimeout>>>([])

  const perform = React.useCallback(
    (directive: ScrollDirective) => {
      switch (directive.type) {
        case 'pinEnd':
          if (directive.stopCentering) stopCentering()
          // The end is the resting offset, so scrolling there from the end moves nothing: unlessAtEnd
          // needs no check of its own here. This list reports no header events, so whenSettled never
          // reaches it.
          scrollToBottomRef.current()
          return
        // Only threadObserved asks for center, and this list reports centerTargetObserved instead.
        case 'center':
          return
        case 'refineCenter':
          if (directive.newTarget) moveToward(directive.ordinal)
          correctRef.current = {active: true, iters: 0}
          ladderRef.current.forEach(cancelScheduled)
          ladderRef.current = [50, 250, 500, 900].map(d =>
            schedule(d, () => correctCenter(vFirstRef.current, vLastRef.current))
          )
          return
        case 'leaveAlone':
          if (directive.stopCentering) stopCentering()
          return
        // This list reports no edit events.
        case 'reveal':
          return
        default: {
          const unexpected: never = directive
          return unexpected
        }
      }
    },
    [cancelScheduled, correctCenter, moveToward, schedule, stopCentering]
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
  // ordinal changes. Wait for the target to load, then scroll. Every change to the rows or the
  // target restarts the corrector's schedule.
  React.useEffect(() => {
    perform(
      decide({
        centeredOrdinal,
        loaded,
        targetInData: centeredOrdinal !== undefined && messageOrdinals.includes(centeredOrdinal),
        type: 'centerTargetObserved',
      })
    )
  }, [centeredOrdinal, decide, loaded, messageOrdinals, perform])

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
    const id = schedule(0, () => {
      perform(appended())
    })
    return () => cancelScheduled(id)
  }, [cancelScheduled, datasetKey, decide, newestOrdinal, perform, schedule])

  // Stores the conversation it last applied to (not a boolean) so a freeze/thaw of this screen —
  // which re-mounts effects without a real conversation change — does not reset it and re-trigger
  // the initial scroll, which would lose the user's scroll position (e.g. returning from the info
  // panel). It resets implicitly when conversationIDKey changes.
  const loadedConvRef = React.useRef<string | undefined>(undefined)
  const initialRetryRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && loadedConvRef.current !== conversationIDKey
    if (loaded) {
      loadedConvRef.current = conversationIDKey
    }
    if (!justLoaded) return

    const directive = decide({centeredOrdinal, hasMessages: numOrdinals > 0, type: 'initialLoad'})
    perform(directive)
    // Once more 100ms on, asking again with the target and rows as they are then, so a centre
    // requested in between is not undone by a scroll to the end.
    if (directive.type === 'pinEnd') {
      initialRetryRef.current = schedule(100, () => {
        perform(
          decide({
            centeredOrdinal: centeredRef.current,
            hasMessages: ordsRef.current.length > 0,
            type: 'initialLoad',
          })
        )
      })
    }
  }, [centeredOrdinal, conversationIDKey, decide, loaded, numOrdinals, perform, schedule])

  // Hidden (a screen pushed over this one) or unmounted: nothing scheduled may scroll a list no
  // longer shown. Work cut short is left to be done again if the list comes back: a target still
  // settling is centred afresh, and a first load whose retry had not fired is treated as not yet
  // scrolled. StrictMode's mount-time effect re-run is the same case. decide and perform never change
  // identity, so this cleanup runs only then.
  React.useEffect(
    () => () => {
      const retry = initialRetryRef.current
      if (retry !== undefined && scheduledRef.current.has(retry)) loadedConvRef.current = undefined
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
    schedule(200, () => {
      const co = centeredRef.current
      if (co !== undefined) {
        listRef.current?.scrollToItem({animated: false, item: co, viewPosition: 0.5})
      }
    })
  })

  const [onScroll] = React.useState(
    () => (e: {nativeEvent: {contentOffset: {y: number}; contentSize: {height: number}}}) => {
      scrollOffsetRef.current = e.nativeEvent.contentOffset.y
      contentHeightRef.current = e.nativeEvent.contentSize.height
    }
  )
  const [onContentSizeChange] = React.useState(() => (_w: number, h: number) => {
    contentHeightRef.current = h
  })
  // user touched the list: stop fighting them
  const onScrollBeginDrag = React.useCallback(() => {
    perform(decide({how: 'drag', type: 'userScrolled'}))
  }, [decide, perform])

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
    onScrollBeginDrag,
    onScrollToIndexFailed,
    onViewableRange,
    scrollToBottom: requestBottom,
  }
}

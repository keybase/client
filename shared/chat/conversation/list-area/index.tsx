import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Hooks from './hooks'
import * as React from 'react'
import * as T from '@/constants/types'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import type {ItemType} from './index.shared'
import {MessageRow} from '../messages/wrapper'
import {PerfProfiler} from '@/perf/react-profiler'
import {ScrollContext} from '../normal/context'
import {useConversationCenter} from '../center-context'
import {
  useConversationThreadID,
  useConversationThreadLoadNewerMessagesDueToScroll,
  useConversationThreadLoadOlderMessagesDueToScroll,
  useConversationThreadSelector,
  useConversationThreadStore,
} from '../thread-context'
import {useThreadLoadStatusOptionsGetter} from '../thread-load-status-context'
import {findLast} from '@/util/arrays'
import {getMessageRowType} from '../messages/row-metadata'
import * as InputState from '../input-area/input-state'
import chunk from 'lodash/chunk'
import useIntersectionObserver from '@/util/use-intersection-observer'
import useResizeObserver from '@/util/use-resize-observer'
import {copyToClipboard} from '@/util/storeless-actions'
import {FocusContext} from '../normal/context'
import noop from 'lodash/noop'
import {FlatList} from 'react-native'
import type {ScrollViewProps} from 'react-native'
import {usingFlashList} from './flashlist-config'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import {KeyboardChatScrollView} from 'react-native-keyboard-controller'
import {useSharedValue} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

// ==================== DESKTOP ====================

// Stub types to avoid dom lib dependency in native tsconfig
type ScrollDivRef = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  offsetHeight: number
  classList: {add: (s: string) => void; remove: (s: string) => void}
  getBoundingClientRect: () => DOMRect
  querySelectorAll: (sel: string) => ArrayLike<WaypointElement>
  addEventListener: (event: string, handler: (...args: Array<unknown>) => void, opts?: {passive?: boolean}) => void
  removeEventListener: (event: string, handler: (...args: Array<unknown>) => void) => void
  closest: (sel: string) => unknown
}
type RNFlatListRef = {
  scrollToOffset: (opts: {animated: boolean; offset: number}) => void
  scrollToItem: (opts: {animated: boolean; item: unknown; viewPosition?: number}) => void
}
type WaypointElement = {
  getBoundingClientRect: () => DOMRect
  scrollIntoView: (opts: {block: string; inline: string}) => void
  dataset: Record<string, string | undefined>
  closest: (sel: string) => WaypointElement | null | undefined
  tagName?: string
}

// Infinite scrolling list.
// We group messages into a series of Waypoints. When the waypoint exits the screen we replace it with a single div instead
const scrollOrdinalKey = 'scroll-ordinal-key'
const noOrdinals: ReadonlyArray<T.Chat.Ordinal> = []
const ordinalsInAWaypoint = 10

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

const useDesktopScrolling = (p: {
  containsLatestMessage: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  listRef: React.RefObject<ScrollDivRef | null>
  loaded: boolean
  setListRef: (r: ScrollDivRef | null) => void
  centeredOrdinal: T.Chat.Ordinal | undefined
}) => {
  const {listRef, setListRef: _setListRef, containsLatestMessage} = p
  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])
  const {messageOrdinals, centeredOrdinal, loaded} = p
  const numOrdinals = messageOrdinals.length
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()
  const loadNewerMessagesDueToScroll = useConversationThreadLoadNewerMessagesDueToScroll()
  const loadNewerMessages = C.useThrottledCallback(() => {
    loadNewerMessagesDueToScroll(numOrdinals, getThreadLoadStatusOptions())
  }, 200)
  // if we scroll up try and keep the position
  const scrollBottomOffsetRef = React.useRef<number | undefined>(undefined)

  const loadOlderMessagesDueToScroll = useConversationThreadLoadOlderMessagesDueToScroll()
  const loadOlderMessages = React.useCallback((numOrdinals: number) => {
    loadOlderMessagesDueToScroll(numOrdinals, getThreadLoadStatusOptions())
  }, [loadOlderMessagesDueToScroll, getThreadLoadStatusOptions])
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions()
  // pixels away from top/bottom to load/be locked
  const listEdgeSlopBottom = 10
  const listEdgeSlopTop = 1000
  const isScrollingRef = React.useRef(false)
  const ignoreOnScrollRef = React.useRef(false)
  const lockedToBottomRef = React.useRef(true)
  // so we can turn pointer events on / off
  const pointerWrapperRef = React.useRef<ScrollDivRef | null>(null)
  const setPointerWrapperRef = (r: ScrollDivRef | null) => {
    pointerWrapperRef.current = r
  }
  const numOrdinalsRef = React.useRef(numOrdinals)
  const loadOlderMessagesRef = React.useRef(loadOlderMessages)
  const loadNewerMessagesRef = React.useRef(loadNewerMessages)

  const [isLockedToBottom] = React.useState(() => () => {
    return lockedToBottomRef.current
  })

  const adjustScrollAndIgnoreOnScroll = (fn: () => void) => {
    ignoreOnScrollRef.current = true
    fn()
  }

  const [checkForLoadMoreThrottled] = React.useState(() => () => {
    const list = listRef.current
    if (list) {
      if (list.scrollTop < listEdgeSlopTop) {
        loadOlderMessagesRef.current(numOrdinalsRef.current)
      } else if (
        !containsLatestMessageRef.current &&
        !lockedToBottomRef.current &&
        list.scrollTop > list.scrollHeight - list.clientHeight - listEdgeSlopBottom
      ) {
        loadNewerMessagesRef.current()
      }
    }
  })

  const [scrollToBottomSync] = React.useState(() => () => {
    lockedToBottomRef.current = true
    const list = listRef.current
    if (list) {
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop = list.scrollHeight - list.clientHeight
      })
    }
  })

  const [scrollToBottom] = React.useState(() => () => {
    scrollToBottomSync()
    setTimeout(() => {
      requestAnimationFrame(scrollToBottomSync)
    }, 1)
  })

  const [performScrollToCentered] = React.useState(() => () => {
    const list = listRef.current
    const waypoint = list?.querySelectorAll(`[data-key=${scrollOrdinalKey}]`)[0] as WaypointElement | undefined
    if (!list || !waypoint) return
    const listRect = list.getBoundingClientRect()
    const waypointRect = waypoint.getBoundingClientRect()
    const targetScrollTop =
      list.scrollTop + (waypointRect.top - listRect.top) - listRect.height / 2 + waypointRect.height / 2
    const clamped = Math.max(0, Math.min(targetScrollTop, list.scrollHeight - list.clientHeight))
    adjustScrollAndIgnoreOnScroll(() => {
      list.scrollTop = clamped
    })
  })

  const [scrollToCentered] = React.useState(() => () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        performScrollToCentered()
        setTimeout(performScrollToCentered, 50)
      })
    })
  })

  const [scrollDown] = React.useState(() => () => {
    const list = listRef.current
    if (list) {
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop += list.clientHeight
      })
    }
  })

  const [scrollUp] = React.useState(() => () => {
    lockedToBottomRef.current = false
    const list = listRef.current
    if (list) {
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop -= list.clientHeight
        checkForLoadMoreThrottled()
      })
    }
  })

  const scrollCheckRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  React.useEffect(() => {
    return () => {
      clearTimeout(scrollCheckRef.current)
    }
  }, [])

  // While scrolling we disable mouse events to speed things up. We avoid state so we don't re-render while doing this
  const onScrollThrottled = C.useThrottledCallback(
    () => {
      clearTimeout(scrollCheckRef.current)
      scrollCheckRef.current = setTimeout(() => {
        if (isScrollingRef.current) {
          isScrollingRef.current = false
          if (pointerWrapperRef.current) {
            pointerWrapperRef.current.classList.remove('scroll-ignore-pointer')
          }

          const list = listRef.current
          // are we locked on the bottom? only lock if we have latest messages
          if (list && !centeredOrdinal && containsLatestMessageRef.current) {
            lockedToBottomRef.current =
              list.scrollHeight - list.clientHeight - list.scrollTop < listEdgeSlopBottom
          }
        }
      }, 200)

      if (!isScrollingRef.current) {
        // starting a scroll
        isScrollingRef.current = true
        if (pointerWrapperRef.current) {
          pointerWrapperRef.current.classList.add('scroll-ignore-pointer')
        }
      }
    },
    100,
    {leading: true, trailing: true}
  )

  const onScrollThrottledRef = React.useRef(onScrollThrottled)
  React.useEffect(() => {
    numOrdinalsRef.current = numOrdinals
    loadOlderMessagesRef.current = loadOlderMessages
    loadNewerMessagesRef.current = loadNewerMessages
    onScrollThrottledRef.current = onScrollThrottled
  }, [numOrdinals, loadOlderMessages, loadNewerMessages, onScrollThrottled])

  // we did it so we should ignore it
  const programaticScrollRef = React.useRef(false)

  const [onScroll] = React.useState(() => () => {
    if (programaticScrollRef.current) {
      programaticScrollRef.current = false
      return
    }
    if (listRef.current) {
      scrollBottomOffsetRef.current = Math.max(0, listRef.current.scrollHeight - listRef.current.scrollTop)
    } else {
      scrollBottomOffsetRef.current = undefined
    }
    if (ignoreOnScrollRef.current) {
      ignoreOnScrollRef.current = false
      return
    }
    // quickly set to false to assume we're not locked. if we are the throttled one will set it to true
    lockedToBottomRef.current = false
    checkForLoadMoreThrottled()
    onScrollThrottledRef.current()
  })

  const setListRef = (list: ScrollDivRef | null) => {
    if (listRef.current) {
      listRef.current.removeEventListener('scroll', onScroll)
    }
    if (list) {
      list.addEventListener('scroll', onScroll, {passive: true})
    }
    _setListRef(list)
  }

  React.useEffect(() => {
    return () => {
      onScrollThrottled.cancel()
    }
  }, [onScrollThrottled])

  const [didFirstLoad, setDidFirstLoad] = React.useState(false)

  const prevLoadedRef = React.useRef(false)
  // Handle scrolling when loaded becomes true. Scroll to centered ordinal if present, else bottom
  React.useLayoutEffect(() => {
    const justLoaded = loaded && !prevLoadedRef.current
    prevLoadedRef.current = loaded

    if (!justLoaded) return

    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }

    setDidFirstLoad(true)
    if (centeredOrdinal) {
      lockedToBottomRef.current = false
      scrollToCentered()
    } else {
      scrollToBottomSync()
      requestAnimationFrame(() => {
        scrollToBottomSync()
      })
    }
  }, [loaded, centeredOrdinal, markInitiallyLoadedThreadAsRead, scrollToBottomSync, scrollToCentered])

  const firstOrdinal = messageOrdinals[0]
  const prevFirstOrdinalRef = React.useRef(firstOrdinal)
  const ordinalsLength = messageOrdinals.length
  const prevOrdinalLengthRef = React.useRef(ordinalsLength)

  // called after dom update, to apply value
  React.useLayoutEffect(() => {
    const list = listRef.current
    // no items? don't be locked
    if (!ordinalsLength) {
      lockedToBottomRef.current = false
      return
    }

    // detect if older messages were added (first ordinal changed = content added at top)
    const olderMessagesAdded = prevFirstOrdinalRef.current !== firstOrdinal
    prevFirstOrdinalRef.current = firstOrdinal

    // didn't scroll up
    if (ordinalsLength === prevOrdinalLengthRef.current) {
      return
    }
    prevOrdinalLengthRef.current = ordinalsLength
    // maintain scroll position only when older messages added at top
    // when newer messages added at bottom, browser naturally keeps position
    if (
      olderMessagesAdded &&
      list &&
      !centeredOrdinal && // ignore this if we're scrolling and we're doing a search
      !isLockedToBottom() &&
      scrollBottomOffsetRef.current !== undefined
    ) {
      programaticScrollRef.current = true
      const newTop = list.scrollHeight - scrollBottomOffsetRef.current
      list.scrollTop = newTop
    }
    return undefined
    // we want this to fire when the ordinals change
  }, [centeredOrdinal, ordinalsLength, isLockedToBottom, listRef, firstOrdinal])

  // Also handle centered ordinal changing while already loaded (e.g. from thread search results)
  const prevCenteredOrdinal = React.useRef(centeredOrdinal)
  const wasLoadedRef = React.useRef(loaded)
  React.useEffect(() => {
    const wasLoaded = wasLoadedRef.current
    const changed = prevCenteredOrdinal.current !== centeredOrdinal
    prevCenteredOrdinal.current = centeredOrdinal
    wasLoadedRef.current = loaded

    // Only scroll if we were already loaded and ordinal changed
    // (the load effect handles scrolling when loaded transitions to true)
    if (!wasLoaded || !loaded || !changed) return

    if (centeredOrdinal) {
      lockedToBottomRef.current = false
      scrollToCentered()
    } else if (containsLatestMessage) {
      lockedToBottomRef.current = true
      scrollToBottom()
    }
  }, [centeredOrdinal, loaded, containsLatestMessage, scrollToCentered, scrollToBottom])

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown, scrollToBottom, scrollUp})
  }, [scrollDown, scrollToBottom, scrollUp, setScrollRef])

  // go to editing message
  const editingOrdinal = InputState.useConversationInput(s => s.editing)
  const lastEditingOrdinalRef = React.useRef(0)
  React.useEffect(() => {
    if (lastEditingOrdinalRef.current === editingOrdinal) return
    lastEditingOrdinalRef.current = editingOrdinal
    if (!editingOrdinal) return
    const idx = messageOrdinals.indexOf(editingOrdinal)
    if (idx !== -1) {
      const waypoints = listRef.current?.querySelectorAll('[data-key]')
      if (waypoints) {
        // find an id that should be our parent
        const toFind = Math.floor(T.Chat.ordinalToNumber(editingOrdinal) / ordinalsInAWaypoint)
        const allWaypoints = Array.from(waypoints) as Array<WaypointElement>
        const found = findLast(allWaypoints, w => {
          const key = w.dataset['key']
          return key !== undefined && parseInt(key, 10) === toFind
        })
        found?.scrollIntoView({block: 'center', inline: 'nearest'})
      }
    }
  }, [editingOrdinal, messageOrdinals, listRef])

  void chunk

  return {didFirstLoad, isLockedToBottom, scrollToBottom, setListRef, setPointerWrapperRef}
}

const useDesktopItems = (p: {
  centeredHighlightOrdinal: T.Chat.Ordinal | undefined
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  centeredOrdinal: T.Chat.Ordinal | undefined
  editingOrdinal: T.Chat.Ordinal | undefined
}) => {
  const {centeredHighlightOrdinal, centeredOrdinal, editingOrdinal, messageOrdinals} = p
  const waypointData = React.useMemo(() => {
    const items: Array<{key: string; ordinals: Array<T.Chat.Ordinal>}> = []
    const numOrdinals = messageOrdinals.length

    let ordinals: Array<T.Chat.Ordinal> = []
    let lastBucket: number | undefined
    let baseIndex = 0 // this is used to de-dupe the waypoint around the centered ordinal
    messageOrdinals.forEach((ordinal, idx) => {
      // Centered ordinal is where we want the view to be centered on when jumping around in the thread.
      const isCenteredOrdinal = ordinal === centeredOrdinal

      // We want to keep the mapping of ordinal to bucket fixed always
      const bucket = Math.floor(T.Chat.ordinalToNumber(ordinal) / ordinalsInAWaypoint)
      if (lastBucket === undefined) {
        lastBucket = bucket
      }
      const needNextWaypoint = bucket !== lastBucket
      const isLastItem = idx === numOrdinals - 1
      if (needNextWaypoint || isLastItem || isCenteredOrdinal) {
        if (isLastItem && !isCenteredOrdinal) {
          // we don't want to add the centered ordinal here, since it will go into its own waypoint
          ordinals.push(ordinal)
        }
        if (ordinals.length) {
          // don't allow buckets to be too big; sends can put more ordinals than expected in one bucket
          const chunks = chunk(ordinals, ordinalsInAWaypoint)
          chunks.forEach((toAdd, cidx) => {
            const key = `${lastBucket || ''}:${cidx + baseIndex}`
            items.push({key, ordinals: toAdd})
          })
          // we pass previous so the OrdinalWaypoint can render the top item correctly
          ordinals = []
          lastBucket = bucket
        }
      }
      // If this is the centered ordinal, it goes into its own waypoint so we can easily scroll to it
      if (isCenteredOrdinal) {
        items.push({key: scrollOrdinalKey, ordinals: [ordinal]})
        lastBucket = 0
        baseIndex++ // push this up if we drop the centered ordinal waypoint
      } else {
        ordinals.push(ordinal)
      }
    })

    return items
  }, [centeredOrdinal, messageOrdinals])

  const rowRenderer = (ordinal: T.Chat.Ordinal) => {
    return (
      <div
        key={String(ordinal)}
        data-debug={String(ordinal)}
        className={Kb.Styles.classNames(
          'hover-container',
          'WrapperMessage',
          'WrapperMessage-hoverBox',
          'WrapperMessage-decorated',
          'WrapperMessage-hoverColor',
          {highlighted: centeredHighlightOrdinal === ordinal || editingOrdinal === ordinal}
        )}
      >
        <Separator trailingItem={ordinal} />
        <MessageRow isCenteredHighlight={centeredHighlightOrdinal === ordinal} ordinal={ordinal} />
      </div>
    )
  }

  const items = [
    <SpecialTopMessage key="specialTop" />,
    ...waypointData.map(({key, ordinals}) => (
      <DesktopOrdinalWaypoint key={key} id={key} rowRenderer={rowRenderer} ordinals={ordinals} />
    )),
    <SpecialBottomMessage key="specialBottom" />,
  ]

  return items
}

const DesktopThreadWrapper = function DesktopThreadWrapper() {
  const editingOrdinal = InputState.useConversationInput(s => s.editing)
  const conversationIDKey = useConversationThreadID()
  const data = useConversationThreadSelector(
    C.useShallow(s => ({
      containsLatestMessage: !s.moreToLoadForward,
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals ?? noOrdinals,
    }))
  )
  const {centeredHighlightOrdinal, centeredOrdinal} = useConversationCenter()
  const {containsLatestMessage, messageOrdinals, loaded} = data
  const listRef = React.useRef<ScrollDivRef | null>(null)
  const _setListRef = (r: ScrollDivRef | null) => {
    listRef.current = r
  }
  const {isLockedToBottom, scrollToBottom, setListRef, didFirstLoad, setPointerWrapperRef} = useDesktopScrolling({
    centeredOrdinal,
    containsLatestMessage,
    listRef,
    loaded,
    messageOrdinals,
    setListRef: _setListRef,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)
  const onCopyCapture = (e: React.BaseSyntheticEvent) => {
    type DocGlobal = {
      createElement: (tag: string) => {
        appendChild: (n: unknown) => void
        querySelectorAll: (sel: string) => ArrayLike<{parentNode?: {removeChild?: (n: unknown) => void; replaceChild?: (a: unknown, b: unknown) => void}}>
        textContent: string | null
        remove: () => void
      }
    }
    type WinGlobal = {
      getSelection: () => {
        getRangeAt: (i: number) => {cloneContents: () => unknown}
      } | null
    }
    e.preventDefault()
    const doc = (globalThis as unknown as {document?: DocGlobal}).document
    const win = (globalThis as unknown as {window?: WinGlobal}).window
    const sel = win?.getSelection()
    if (!sel || !doc) return
    const temp = sel.getRangeAt(0).cloneContents()
    const tempDiv = doc.createElement('div')
    tempDiv.appendChild(temp)
    const styles = tempDiv.querySelectorAll('style')
    Array.from(styles).forEach(s => {
      s.parentNode?.removeChild?.(s)
    })
    const imgs = tempDiv.querySelectorAll('img')
    Array.from(imgs).forEach(i => {
      const dummy = doc.createElement('div')
      dummy.textContent = '\n[IMAGE]\n'
      i.parentNode?.replaceChild?.(dummy, i)
    })
    const tc = tempDiv.textContent
    if (tc) {
      copyToClipboard(tc)
    }
    tempDiv.remove()
  }
  const {focusInput} = React.useContext(FocusContext)
  const handleListClick = (ev: React.MouseEvent) => {
    const target = ev.target as unknown as WaypointElement | null
    const tagName = (target as {tagName?: string} | null)?.tagName?.toUpperCase()
    if (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      target?.closest('[data-search-filter="true"]')
    ) {
      return
    }

    const sel = (globalThis as unknown as {getSelection?: () => {isCollapsed: boolean} | null}).getSelection?.()
    if (sel?.isCollapsed) {
      focusInput()
    }
  }

  const items = useDesktopItems({
    centeredHighlightOrdinal,
    centeredOrdinal,
    editingOrdinal,
    messageOrdinals,
  })
  const setListContents = useDesktopHandleListResize({
    centeredOrdinal,
    isLockedToBottom,
    scrollToBottom,
    setPointerWrapperRef,
    useResizeObserver,
  })


  return (
    <Kb.ErrorBoundary>
      <div
        style={Kb.Styles.castStyleDesktop(desktopStyles.container)}
        onClick={handleListClick}
        onCopyCapture={onCopyCapture}
      >
        <div
          data-testid="message-list"
          className="chat-scroller"
          key={conversationIDKey}
          style={Kb.Styles.castStyleDesktop(
            Kb.Styles.collapseStyles([desktopStyles.list, {opacity: didFirstLoad ? 1 : 0}])
          )}
          ref={setListRef as (r: HTMLDivElement | null) => void}
        >
          <div style={Kb.Styles.castStyleDesktop(desktopStyles.listContents)} ref={setListContents as React.Ref<HTMLDivElement>}>
            {items}
          </div>
        </div>
        {jumpToRecent}
      </div>
    </Kb.ErrorBoundary>
  )
}

const useDesktopHandleListResize = (p: {
  centeredOrdinal: T.Chat.Ordinal | undefined
  isLockedToBottom: () => boolean
  scrollToBottom: () => void
  setPointerWrapperRef: (r: ScrollDivRef | null) => void
  useResizeObserver: (ref: React.RefObject<Element | null>, cb: (e: {contentRect: {height: number}}) => void) => void
}) => {
  const {isLockedToBottom, scrollToBottom, setPointerWrapperRef, centeredOrdinal, useResizeObserver} = p
  const lastResizeHeightRef = React.useRef(0)
  const onListSizeChanged = function onListSizeChanged(contentRect: {height: number}) {
    const {height} = contentRect
    if (height !== lastResizeHeightRef.current) {
      lastResizeHeightRef.current = height
      if (isLockedToBottom() && !centeredOrdinal) {
        scrollToBottom()
      }
    }
  }

  const pointerWrapperRef = React.useRef<ScrollDivRef | null>(null)
  const setListContents = (listContents: ScrollDivRef | null) => {
    setPointerWrapperRef(listContents)
    pointerWrapperRef.current = listContents
  }

  useResizeObserver(pointerWrapperRef as React.RefObject<Element | null>, e => onListSizeChanged(e.contentRect))

  return setListContents
}

type DesktopOrdinalWaypointProps = {
  id: string
  rowRenderer: (ordinal: T.Chat.Ordinal) => React.ReactNode
  ordinals: Array<T.Chat.Ordinal>
}

const colorWaypoints = __DEV__ && (false as boolean)
const waypointColors = new Array<string>()
if (colorWaypoints) {
  for (let i = 0; i < 10; ++i) {
    console.log('COLOR WAYPOINTS ON!!!!!!!!!!!!!!!!')
    waypointColors.push(`rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`)
  }
}

// Render unmeasured waypoints once so initial scroll positioning uses real heights.
// After measuring, off-screen waypoints can collapse back to placeholders.
const DesktopOrdinalWaypoint = function DesktopOrdinalWaypoint(p: DesktopOrdinalWaypointProps) {
  const {ordinals, id, rowRenderer} = p
  const estimatedHeight = 40 * ordinals.length
  const [height, setHeight] = React.useState(-1)
  const [wRef, setRef] = React.useState<ScrollDivRef | null>(null)
  const [setContentRef] = React.useState(() => (ref: ScrollDivRef | null) => {
    if (ref) {
      const height = ref.offsetHeight
      if (height) {
        setHeight(oldHeight => (oldHeight === height ? oldHeight : height))
      }
    }
    setRef(ref)
  })
  const root = wRef?.closest('.chat-scroller') as HTMLElement | undefined
  const {isIntersecting} = useIntersectionObserver(wRef as unknown as React.RefObject<HTMLElement>, {root})
  const renderMessages = height < 0 || isIntersecting
  let content: React.ReactElement

  if (renderMessages) {
    content = <DesktopContent key={id} id={id} ref={setContentRef} ordinals={ordinals} rowRenderer={rowRenderer} />
  } else {
    content = <DesktopDummy key={id} id={id} height={height < 0 ? estimatedHeight : height} ref={setRef} />
  }

  if (colorWaypoints) {
    let cidx = parseInt(id)
    if (isNaN(cidx)) cidx = 0
    cidx = cidx % waypointColors.length
    return <div style={{backgroundColor: waypointColors[cidx]}}>{content}</div>
  } else {
    return content
  }
}

type DesktopContentType = {
  id: string
  ordinals: Array<T.Chat.Ordinal>
  rowRenderer: (o: T.Chat.Ordinal) => React.ReactNode
  ref?: React.Ref<ScrollDivRef>
}
function DesktopContent(p: DesktopContentType) {
  const {id, ordinals, rowRenderer, ref} = p
  // Apply data-key to the dom node so we can search for editing messages
  return (
    <PerfProfiler id="MessageWaypoint">
      <div data-key={id} ref={ref as React.Ref<HTMLDivElement>}>
        {ordinals.map((o): React.ReactNode => rowRenderer(o))}
      </div>
    </PerfProfiler>
  )
}

type DesktopDummyType = {
  id: string
  height: number
  ref?: React.Ref<ScrollDivRef>
}
function DesktopDummy(p: DesktopDummyType) {
  const {id, height, ref} = p
  // Apply data-key to the dom node so we can search for editing messages
  return <div data-key={id} style={{contentVisibility: 'auto', height}} ref={ref as React.Ref<HTMLDivElement>} />
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          // containment hints so we can scroll faster
          contain: 'layout style',
          flex: 1,
          position: 'relative',
        },
      }),
      list: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fillAbsolute,
          outline: 'none',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          paddingBottom: 16,
          // get our own layer so we can scroll faster
          willChange: 'transform',
        },
      }),
      listContents: Kb.Styles.platformStyles({
        isElectron: {
          contain: 'layout style',
          width: '100%',
        },
      }),
    }) as const
)

const DesktopThreadWrapperWithProfiler = () => (
  <PerfProfiler id="MessageList">
    <DesktopThreadWrapper />
  </PerfProfiler>
)

// ==================== NATIVE ====================

const useInvertedMessageOrdinals = (messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>) => {
  const source = messageOrdinals ?? noOrdinals
  return React.useMemo(() => (source.length > 1 ? [...source].reverse() : source), [source])
}

const useNativeScrolling = (p: {
  centeredOrdinal: T.Chat.Ordinal
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  conversationIDKey: T.Chat.ConversationIDKey
  listRef: React.RefObject<RNFlatListRef | null>
}) => {
  const {listRef, centeredOrdinal, messageOrdinals} = p
  const numOrdinals = messageOrdinals.length
  const loadOlderMessages = useConversationThreadLoadOlderMessagesDueToScroll()
  const getThreadLoadStatusOptions = useThreadLoadStatusOptionsGetter()
  const [scrollToBottom] = React.useState(() => () => {
    listRef.current?.scrollToOffset({animated: false, offset: 0})
  })

  const {setScrollRef} = React.useContext(ScrollContext)
  React.useEffect(() => {
    setScrollRef({scrollDown: noop, scrollToBottom, scrollUp: noop})
  }, [setScrollRef, scrollToBottom])

  // only scroll to center once per
  const lastScrollToCentered = React.useRef(-1)
  React.useEffect(() => {
    if (T.Chat.ordinalToNumber(centeredOrdinal) < 0) {
      lastScrollToCentered.current = -1
    }
  }, [centeredOrdinal])

  const centeredOrdinalRef = React.useRef(centeredOrdinal)
  React.useEffect(() => {
    centeredOrdinalRef.current = centeredOrdinal
  }, [centeredOrdinal])
  const [scrollToCentered] = React.useState(() => () => {
    setTimeout(() => {
      const list = listRef.current
      if (!list) {
        return
      }
      const co = centeredOrdinalRef.current
      if (lastScrollToCentered.current === co) {
        return
      }

      lastScrollToCentered.current = co
      list.scrollToItem({animated: false, item: co, viewPosition: 0.5})
    }, 100)
  })

  const onEndReached = () => {
    loadOlderMessages(numOrdinals, getThreadLoadStatusOptions())
  }

  return {
    onEndReached,
    scrollToBottom,
    scrollToCentered,
  }
}

// This keeps the list stable when data changes. If we don't do this it will jump around
// when new messages come in and its very easy to get this to cause an unstoppable loop of
// quick janking up and down
const maintainVisibleContentPosition = {autoscrollToTopThreshold: 1, minIndexForVisible: 0}

const NativeConversationList = function NativeConversationList() {
  const List = FlatList as unknown as React.ComponentType<Record<string, unknown> & {ref?: React.Ref<RNFlatListRef>}>

  const debugWhichList = __DEV__ ? (
    <Kb.Text type="HeaderBig" style={{backgroundColor: 'red', left: 0, position: 'absolute', top: 0}}>
      {usingFlashList ? 'FLASH' : 'old'}
    </Kb.Text>
  ) : null

  const conversationIDKey = useConversationThreadID()
  const listData = useConversationThreadSelector(
    C.useShallow(s => ({
      loaded: s.loaded,
      messageOrdinals: s.messageOrdinals,
    }))
  )
  const {centeredHighlightOrdinal, centeredOrdinal} = useConversationCenter()
  const noCenteredOrdinal = T.Chat.numberToOrdinal(-1)
  const centeredOrdinalOrNone = centeredOrdinal ?? noCenteredOrdinal
  const centeredHighlightOrdinalOrNone = centeredHighlightOrdinal ?? noCenteredOrdinal
  const {loaded} = listData

  const messageOrdinals = useInvertedMessageOrdinals(listData.messageOrdinals)

  const listRef = React.useRef<RNFlatListRef | null>(null)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions()
  const keyExtractor = (ordinal: ItemType) => {
    return String(ordinal)
  }

  const renderItem = (info?: {item?: ItemType}) => {
    const ordinal = info?.item
    if (!ordinal) {
      return null
    }
    return <MessageRow isCenteredHighlight={centeredHighlightOrdinalOrNone === ordinal} ordinal={ordinal} />
  }

  const numOrdinals = messageOrdinals.length

  const threadStore = useConversationThreadStore()
  const getItemType = React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      if (!ordinal) {
        return 'null'
      }
      const {messageMap, messageTypeMap} = threadStore.getState()
      const message = messageMap.get(ordinal)
      return message
        ? getMessageRowType(message, messageTypeMap.get(ordinal))
        : (messageTypeMap.get(ordinal) ?? 'text')
    },
    [threadStore]
  )

  const {scrollToCentered, scrollToBottom, onEndReached} = useNativeScrolling({
    centeredOrdinal: centeredOrdinalOrNone,
    conversationIDKey,
    listRef,
    messageOrdinals,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)

  const lastCenteredOrdinal = React.useRef(0)
  React.useEffect(() => {
    if (lastCenteredOrdinal.current === centeredOrdinalOrNone) {
      return
    }
    lastCenteredOrdinal.current = centeredOrdinalOrNone
    if (centeredOrdinalOrNone > 0) {
      const id = setTimeout(() => {
        scrollToCentered()
      }, 200)
      return () => {
        clearTimeout(id)
      }
    }
    return undefined
  }, [centeredOrdinalOrNone, scrollToCentered])

  const prevLoadedRef = React.useRef(false)
  const markedLoadedThreadRef = React.useRef(false)
  React.useLayoutEffect(() => {
    prevLoadedRef.current = false
    markedLoadedThreadRef.current = false
  }, [conversationIDKey])
  React.useLayoutEffect(() => {
    const justLoaded = loaded && !prevLoadedRef.current
    prevLoadedRef.current = loaded

    if (!justLoaded) return

    if (!markedLoadedThreadRef.current) {
      markedLoadedThreadRef.current = true
      markInitiallyLoadedThreadAsRead()
    }

    if (centeredOrdinalOrNone > 0) {
      scrollToCentered()
      setTimeout(() => {
        scrollToCentered()
      }, 100)
    } else if (numOrdinals > 0) {
      scrollToBottom()
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [
    centeredOrdinalOrNone,
    loaded,
    markInitiallyLoadedThreadAsRead,
    numOrdinals,
    scrollToBottom,
    scrollToCentered,
  ])

  const onViewableItemsChanged = useNativeSafeOnViewableItemsChanged(onEndReached, messageOrdinals.length)

  const insets = useSafeAreaInsets()

  const extraContentPaddingSV = useSharedValue(insets.bottom)
  React.useEffect(() => {
    extraContentPaddingSV.value = insets.bottom
  }, [extraContentPaddingSV, insets.bottom])

  const renderScrollComponent = React.useCallback(
    (props: ScrollViewProps) => (
      <KeyboardChatScrollView
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        inverted={true}
        offset={insets.bottom}
        extraContentPadding={extraContentPaddingSV}
        {...props}
      />
    ),
    [insets.bottom, extraContentPaddingSV]
  )

  const nativeContentContainer = Kb.Styles.styleSheetCreate(
    () =>
      ({
        contentContainer: {
          paddingBottom: 0,
          paddingTop: mobileTypingContainerHeight,
        },
      }) as const
  )

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="MessageList">
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} relative={true}>
          <List
            key={conversationIDKey}
            testID="messageList"
            onScrollToIndexFailed={noop}
            estimatedItemSize={72}
            ListHeaderComponent={SpecialBottomMessage}
            ListFooterComponent={SpecialTopMessage}
            ItemSeparatorComponent={Separator}
            overScrollMode="never"
            contentContainerStyle={nativeContentContainer.contentContainer}
            data={messageOrdinals}
            getItemType={getItemType}
            inverted={true}
            renderItem={renderItem}
            onViewableItemsChanged={onViewableItemsChanged.current}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            ref={listRef}
            renderScrollComponent={renderScrollComponent}
            maintainVisibleContentPosition={
              // MUST do this else if you come into a new thread it'll slowly scroll down when it loads
              numOrdinals ? maintainVisibleContentPosition : undefined
            }
          />
          {jumpToRecent}
          {debugWhichList}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

const minTimeDelta = 1000
const minDistanceFromEnd = 10

const useNativeSafeOnViewableItemsChanged = (onEndReached: () => void, numOrdinals: number) => {
  const nextCallbackRef = React.useRef(new Date().getTime())
  const onEndReachedRef = React.useRef(onEndReached)
  React.useEffect(() => {
    onEndReachedRef.current = onEndReached
  }, [onEndReached])
  const numOrdinalsRef = React.useRef(numOrdinals)
  React.useEffect(() => {
    numOrdinalsRef.current = numOrdinals
    nextCallbackRef.current = new Date().getTime() + minTimeDelta
  }, [numOrdinals])

  // this can't change ever, so we have to use refs to keep in sync
  const onViewableItemsChanged = React.useRef(
    ({viewableItems}: {viewableItems: Array<{index: number | null}>}) => {
      const idx = viewableItems.at(-1)?.index ?? 0
      const lastIdx = numOrdinalsRef.current - 1
      const offset = numOrdinalsRef.current > 50 ? minDistanceFromEnd : 1
      const deltaIdx = idx - lastIdx + offset
      // not far enough from the end
      if (deltaIdx < 0) {
        return
      }
      const t = new Date().getTime()
      const deltaT = t - nextCallbackRef.current
      // enough time elapsed?
      if (deltaT > 0) {
        nextCallbackRef.current = t + minTimeDelta
        onEndReachedRef.current()
      }
    }
  )
  return onViewableItemsChanged
}

export const DEBUGDump = () => {}

export default isMobile ? NativeConversationList : DesktopThreadWrapperWithProfiler

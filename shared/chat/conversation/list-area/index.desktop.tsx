import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as Hooks from './hooks'
import * as React from 'react'
import * as T from '@/constants/types'
import Separator from '../messages/separator'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import chunk from 'lodash/chunk'
import {findLast} from '@/util/arrays'
import {getMessageRender} from '../messages/wrapper'
import {globalMargins} from '@/styles/shared'
import {FocusContext, ScrollContext} from '../normal/context'
import {chatDebugEnabled} from '@/constants/chat2/debug'
import logger from '@/logger'
import shallowEqual from 'shallowequal'
import useResizeObserver from '@/util/use-resize-observer.desktop'
import useIntersectionObserver from '@/util/use-intersection-observer'
import {useConfigState} from '@/stores/config'

// Infinite scrolling list.
// We group messages into a series of Waypoints. When the waypoint exits the screen we replace it with a single div instead
const scrollOrdinalKey = 'scroll-ordinal-key'

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

// scrolling related things
const useScrolling = (p: {
  containsLatestMessage: boolean
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  listRef: React.RefObject<HTMLDivElement | null>
  loaded: boolean
  setListRef: (r: HTMLDivElement | null) => void
  centeredOrdinal: T.Chat.Ordinal | undefined
}) => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const {listRef, setListRef: _setListRef, containsLatestMessage} = p
  const containsLatestMessageRef = React.useRef(containsLatestMessage)
  React.useEffect(() => {
    containsLatestMessageRef.current = containsLatestMessage
  }, [containsLatestMessage])
  const {messageOrdinals, centeredOrdinal, loaded} = p
  const numOrdinals = messageOrdinals.length
  const loadNewerMessagesDueToScroll = Chat.useChatContext(s => s.dispatch.loadNewerMessagesDueToScroll)
  const loadNewerMessages = C.useThrottledCallback(
    React.useCallback(() => {
      loadNewerMessagesDueToScroll(numOrdinals)
    }, [loadNewerMessagesDueToScroll, numOrdinals]),
    200
  )
  // if we scroll up try and keep the position
  const scrollBottomOffsetRef = React.useRef<number | undefined>(undefined)

  const loadOlderMessages = Chat.useChatContext(s => s.dispatch.loadOlderMessagesDueToScroll)
  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})
  // pixels away from top/bottom to load/be locked
  const listEdgeSlopBottom = 10
  const listEdgeSlopTop = 1000
  const isMounted = C.useIsMounted()
  const isScrollingRef = React.useRef(false)
  const ignoreOnScrollRef = React.useRef(false)
  const lockedToBottomRef = React.useRef(true)
  // so we can turn pointer events on / off
  const pointerWrapperRef = React.useRef<HTMLDivElement | null>(null)
  const setPointerWrapperRef = React.useCallback((r: HTMLDivElement | null) => {
    pointerWrapperRef.current = r
  }, [])

  const isLockedToBottom = React.useCallback(() => {
    return lockedToBottomRef.current
  }, [lockedToBottomRef])

  const adjustScrollAndIgnoreOnScroll = React.useCallback(
    (fn: () => void) => {
      ignoreOnScrollRef.current = true
      fn()
    },
    [ignoreOnScrollRef]
  )

  const checkForLoadMoreThrottled = React.useCallback(() => {
    // are we at the top?
    const list = listRef.current
    if (list) {
      if (list.scrollTop < listEdgeSlopTop) {
        loadOlderMessages(numOrdinals)
      } else if (
        !containsLatestMessage &&
        !isLockedToBottom() &&
        list.scrollTop > list.scrollHeight - list.clientHeight - listEdgeSlopBottom
      ) {
        loadNewerMessages()
      }
    }
  }, [listRef, containsLatestMessage, loadNewerMessages, loadOlderMessages, isLockedToBottom, numOrdinals])

  const scrollToBottomSync = React.useCallback(() => {
    lockedToBottomRef.current = true
    const list = listRef.current
    if (list) {
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop = list.scrollHeight - list.clientHeight
      })
    }
  }, [adjustScrollAndIgnoreOnScroll, listRef])

  const scrollToBottom = React.useCallback(() => {
    scrollToBottomSync()
    setTimeout(() => {
      requestAnimationFrame(scrollToBottomSync)
    }, 1)
  }, [scrollToBottomSync])

  const performScrollToCentered = React.useCallback(() => {
    const list = listRef.current
    const waypoint = list?.querySelectorAll(`[data-key=${scrollOrdinalKey}]`)[0] as HTMLElement | undefined
    if (!list || !waypoint) return
    const listRect = list.getBoundingClientRect()
    const waypointRect = waypoint.getBoundingClientRect()
    const targetScrollTop =
      list.scrollTop + (waypointRect.top - listRect.top) - listRect.height / 2 + waypointRect.height / 2
    const clamped = Math.max(0, Math.min(targetScrollTop, list.scrollHeight - list.clientHeight))
    adjustScrollAndIgnoreOnScroll(() => {
      list.scrollTop = clamped
    })
  }, [adjustScrollAndIgnoreOnScroll, listRef])

  const scrollToCentered = React.useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        performScrollToCentered()
        setTimeout(performScrollToCentered, 50)
      })
    })
  }, [performScrollToCentered])

  const scrollDown = React.useCallback(() => {
    const list = listRef.current
    list &&
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop += list.clientHeight
      })
  }, [listRef, adjustScrollAndIgnoreOnScroll])

  const scrollUp = React.useCallback(() => {
    lockedToBottomRef.current = false
    const list = listRef.current
    list &&
      adjustScrollAndIgnoreOnScroll(() => {
        list.scrollTop -= list.clientHeight
        checkForLoadMoreThrottled()
      })
  }, [listRef, adjustScrollAndIgnoreOnScroll, checkForLoadMoreThrottled])

  const scrollCheckRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  React.useEffect(() => {
    return () => {
      clearTimeout(scrollCheckRef.current)
    }
  }, [])

  // While scrolling we disable mouse events to speed things up. We avoid state so we don't re-render while doing this
  const onScrollThrottled = C.useThrottledCallback(
    React.useCallback(() => {
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
    }, [listRef, centeredOrdinal]),
    100,
    {leading: true, trailing: true}
  )

  // we did it so we should ignore it
  const programaticScrollRef = React.useRef(false)

  const onScroll = React.useCallback(() => {
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
    onScrollThrottled()
  }, [checkForLoadMoreThrottled, onScrollThrottled, listRef])

  const setListRef = React.useCallback(
    (list: HTMLDivElement | null) => {
      if (listRef.current) {
        listRef.current.removeEventListener('scroll', onScroll)
      }
      if (list) {
        list.addEventListener('scroll', onScroll, {passive: true})
      }
      _setListRef(list)
    },
    [onScroll, listRef, _setListRef]
  )

  const cleanupDebounced = React.useCallback(() => {
    onScrollThrottled.cancel()
  }, [onScrollThrottled])

  React.useEffect(() => {
    return () => {
      cleanupDebounced()
    }
  }, [cleanupDebounced])

  const [didFirstLoad, setDidFirstLoad] = React.useState(false)

  // Ensure didFirstLoad is true whenever we're loaded (even if we skipped reload)
  React.useEffect(() => {
    if (loaded && !didFirstLoad) {
      requestAnimationFrame(() => {
        setDidFirstLoad(true)
      })
    }
  }, [loaded, didFirstLoad])

  // Handle scrolling when loaded becomes true. Scroll to centered ordinal if present, else bottom
  const prevLoadedRef = React.useRef(loaded)
  React.useLayoutEffect(() => {
    const justLoaded = loaded && !prevLoadedRef.current
    prevLoadedRef.current = loaded

    if (!justLoaded) return

    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }

    if (centeredOrdinal) {
      lockedToBottomRef.current = false
      scrollToCentered()
    } else {
      scrollToBottom()
    }
  }, [loaded, centeredOrdinal, markInitiallyLoadedThreadAsRead, scrollToBottom, scrollToCentered])

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
      isMounted() &&
      scrollBottomOffsetRef.current !== undefined
    ) {
      programaticScrollRef.current = true
      const newTop = list.scrollHeight - scrollBottomOffsetRef.current
      list.scrollTop = newTop
    }
    return undefined
    // we want this to fire when the ordinals change
  }, [centeredOrdinal, ordinalsLength, isLockedToBottom, isMounted, listRef, firstOrdinal])

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
  const editingOrdinal = Chat.useChatContext(s => s.editing)
  const lastEditingOrdinalRef = React.useRef(0)
  React.useEffect(() => {
    if (lastEditingOrdinalRef.current !== editingOrdinal) return
    lastEditingOrdinalRef.current = editingOrdinal
    if (!editingOrdinal) return
    const idx = messageOrdinals.indexOf(editingOrdinal)
    if (idx !== -1) {
      const waypoints = listRef.current?.querySelectorAll('[data-key]')
      if (waypoints) {
        // find an id that should be our parent
        const toFind = Math.floor(T.Chat.ordinalToNumber(editingOrdinal) / 10)
        const allWaypoints = Array.from(waypoints) as Array<HTMLElement>
        const found = findLast(allWaypoints, w => {
          const key = w.dataset['key']
          return key !== undefined && parseInt(key, 10) === toFind
        })
        found?.scrollIntoView({block: 'center', inline: 'nearest'})
      }
    }
  }, [editingOrdinal, messageOrdinals, listRef])

  return {didFirstLoad, isLockedToBottom, scrollToBottom, setListRef, setPointerWrapperRef}
}

const useItems = (p: {
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
  centeredOrdinal: T.Chat.Ordinal | undefined
  editingOrdinal: T.Chat.Ordinal | undefined
  messageTypeMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.RenderMessageType> | undefined
}) => {
  const {messageTypeMap, messageOrdinals, centeredOrdinal, editingOrdinal} = p
  const ordinalsInAWaypoint = 10
  const rowRenderer = React.useCallback(
    (ordinal: T.Chat.Ordinal) => {
      const type = messageTypeMap?.get(ordinal) ?? 'text'
      const Clazz = getMessageRender(type)
      if (!Clazz) {
        if (chatDebugEnabled) {
          logger.error('[CHATDEBUG] no rendertype', {Clazz, ordinal, type})
        }
        return null
      }

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
            {highlighted: centeredOrdinal === ordinal || editingOrdinal === ordinal}
          )}
        >
          <Separator trailingItem={ordinal} />
          <Clazz ordinal={ordinal} />
        </div>
      )
    },
    [messageTypeMap, centeredOrdinal, editingOrdinal]
  )

  const wayOrdinalCachRef = React.useRef(new Map<string, Array<T.Chat.Ordinal>>())

  // TODO doesn't need all messageOrdinals in there, could just find buckets and push details down
  const items = React.useMemo(() => {
    const items: Array<React.ReactNode> = []
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
          // don't allow buckets to be too big, we have sends which can allow > 10 ordinals in a bucket so we split it further
          const chunks = chunk(ordinals, 10)
          chunks.forEach((toAdd, cidx) => {
            const key = `${lastBucket || ''}:${cidx + baseIndex}`
            let wayOrdinals = toAdd
            const existing = wayOrdinalCachRef.current.get(key)
            if (existing && shallowEqual(existing, wayOrdinals)) {
              wayOrdinals = existing
            } else {
              wayOrdinalCachRef.current.set(key, wayOrdinals)
            }

            items.push(
              <OrdinalWaypoint key={key} id={key} rowRenderer={rowRenderer} ordinals={wayOrdinals} />
            )
          })
          // we pass previous so the OrdinalWaypoint can render the top item correctly
          ordinals = []
          lastBucket = bucket
        }
      }
      // If this is the centered ordinal, it goes into its own waypoint so we can easily scroll to it
      if (isCenteredOrdinal) {
        const key = scrollOrdinalKey
        let wayOrdinals = [ordinal]
        const existing = wayOrdinalCachRef.current.get(key)
        if (existing && shallowEqual(existing, wayOrdinals)) {
          wayOrdinals = existing
        } else {
          wayOrdinalCachRef.current.set(key, wayOrdinals)
        }
        items.push(
          <OrdinalWaypoint
            key={scrollOrdinalKey}
            id={scrollOrdinalKey}
            rowRenderer={rowRenderer}
            ordinals={wayOrdinals}
          />
        )
        lastBucket = 0
        baseIndex++ // push this up if we drop the centered ordinal waypoint
      } else {
        ordinals.push(ordinal)
      }
    })

    return [<SpecialTopMessage key="specialTop" />, ...items, <SpecialBottomMessage key="specialBottom" />]
  }, [messageOrdinals, centeredOrdinal, rowRenderer])

  return items
}

const noOrdinals = new Array<T.Chat.Ordinal>()
const ThreadWrapper = React.memo(function ThreadWrapper() {
  const data = Chat.useChatContext(
    C.useShallow(s => {
      const {messageTypeMap, editing: editingOrdinal, id: conversationIDKey} = s
      const {messageCenterOrdinal: mco, messageOrdinals = noOrdinals, loaded} = s
      const centeredOrdinal = mco && mco.highlightMode !== 'none' ? mco.ordinal : undefined
      const containsLatestMessage = s.isCaughtUp()
      return {
        centeredOrdinal,
        containsLatestMessage,
        conversationIDKey,
        editingOrdinal,
        loaded,
        messageOrdinals,
        messageTypeMap,
      }
    })
  )
  const {conversationIDKey, editingOrdinal, centeredOrdinal} = data
  const {containsLatestMessage, messageOrdinals, loaded, messageTypeMap} = data
  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const _setListRef = React.useCallback((r: HTMLDivElement | null) => {
    listRef.current = r
  }, [])
  const {isLockedToBottom, scrollToBottom, setListRef, didFirstLoad, setPointerWrapperRef} = useScrolling({
    centeredOrdinal,
    containsLatestMessage,
    listRef,
    loaded,
    messageOrdinals,
    setListRef: _setListRef,
  })

  const jumpToRecent = Hooks.useJumpToRecent(scrollToBottom, messageOrdinals.length)
  const onCopyCapture = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      // Copy text only, not HTML/styling. We use virtualText on texts to make uncopyable text
      e.preventDefault()
      const sel = window.getSelection()
      if (!sel) return
      const temp = sel.getRangeAt(0).cloneContents()
      // cloning it and making a new new fixes issues where icons will give you
      // extra newlines only when you do toString() vs getting the textContents
      const tempDiv = document.createElement('div')
      tempDiv.appendChild(temp)
      // filter
      const styles = tempDiv.querySelectorAll('style')
      styles.forEach(s => {
        s.parentNode?.removeChild(s)
      })
      const imgs = tempDiv.querySelectorAll('img')
      imgs.forEach(i => {
        const dummy = document.createElement('div')
        dummy.textContent = '\n[IMAGE]\n'
        i.parentNode?.replaceChild(dummy, i)
      })

      const tc = tempDiv.textContent
      tc && copyToClipboard(tc)
      tempDiv.remove()
    },
    [copyToClipboard]
  )
  const {focusInput} = React.useContext(FocusContext)
  const handleListClick = React.useCallback(
    (ev: React.MouseEvent) => {
      const target = ev.target
      // allow focusing other inner inputs such as the reacji picker filter
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target as HTMLElement).closest('[data-search-filter="true"]')
      ) {
        return
      }

      const sel = window.getSelection()
      if (sel?.isCollapsed) {
        focusInput()
      }
    },
    [focusInput]
  )

  const items = useItems({centeredOrdinal, editingOrdinal, messageOrdinals, messageTypeMap})
  const setListContents = useHandleListResize({
    centeredOrdinal,
    isLockedToBottom,
    scrollToBottom,
    setPointerWrapperRef,
  })

  return (
    <Kb.ErrorBoundary>
      <div
        style={Kb.Styles.castStyleDesktop(styles.container)}
        onClick={handleListClick}
        onCopyCapture={onCopyCapture}
      >
        <div
          className="chat-scroller"
          key={conversationIDKey}
          style={Kb.Styles.castStyleDesktop(
            Kb.Styles.collapseStyles([styles.list, {opacity: didFirstLoad ? 1 : 0}])
          )}
          ref={setListRef}
        >
          <div style={Kb.Styles.castStyleDesktop(styles.listContents)} ref={setListContents}>
            {items}
          </div>
        </div>
        {jumpToRecent}
      </div>
    </Kb.ErrorBoundary>
  )
})

const useHandleListResize = (p: {
  centeredOrdinal: T.Chat.Ordinal | undefined
  isLockedToBottom: () => boolean
  scrollToBottom: () => void
  setPointerWrapperRef: (r: HTMLDivElement | null) => void
}) => {
  const {isLockedToBottom, scrollToBottom, setPointerWrapperRef, centeredOrdinal} = p
  const lastResizeHeightRef = React.useRef(0)
  const onListSizeChanged = React.useCallback(
    function onListSizeChanged(contentRect: {height: number}) {
      const {height} = contentRect
      if (height !== lastResizeHeightRef.current) {
        lastResizeHeightRef.current = height
        if (isLockedToBottom() && !centeredOrdinal) {
          scrollToBottom()
        }
      }
    },
    [isLockedToBottom, scrollToBottom, centeredOrdinal]
  )

  const pointerWrapperRef = React.useRef<HTMLDivElement | null>(null)
  const setListContents = React.useCallback(
    (listContents: HTMLDivElement | null) => {
      setPointerWrapperRef(listContents)
      pointerWrapperRef.current = listContents
    },
    [setPointerWrapperRef, pointerWrapperRef]
  )

  useResizeObserver(pointerWrapperRef, e => onListSizeChanged(e.contentRect))

  return setListContents
}

type OrdinalWaypointProps = {
  id: string
  rowRenderer: (ordinal: T.Chat.Ordinal) => React.ReactNode
  ordinals: Array<T.Chat.Ordinal>
}

const colorWaypoints = __DEV__ && (false as boolean)
const colors = new Array<string>()
if (colorWaypoints) {
  for (let i = 0; i < 10; ++i) {
    console.log('COLOR WAYPOINTS ON!!!!!!!!!!!!!!!!')
    colors.push(`rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`)
  }
}

// When rendering the first time, let it auto size
// when you're out of view (!isIntersecting) then replace with a placeholder div with a fixed height
// when you're back in view auto size
const OrdinalWaypoint = React.memo(function OrdinalWaypoint(p: OrdinalWaypointProps) {
  const {ordinals, id, rowRenderer} = p
  const [height, setHeight] = React.useState(-1)
  const [isVisible, setVisible] = React.useState(true)
  const [wRef, setRef] = React.useState<HTMLDivElement | null>(null)
  const root = wRef?.closest('.chat-scroller') as HTMLElement | undefined
  const {isIntersecting} = useIntersectionObserver(wRef, {root})
  const lastIsIntersecting = React.useRef(isIntersecting)

  React.useEffect(() => {
    if (lastIsIntersecting.current === isIntersecting) return
    lastIsIntersecting.current = isIntersecting
    setVisible(isIntersecting)
  }, [isIntersecting])

  const renderMessages = height < 0 || isVisible
  let content: React.ReactElement

  const lastRenderMessages = React.useRef(false)
  React.useEffect(() => {
    if (!wRef) return
    if (lastRenderMessages.current === renderMessages) return
    if (renderMessages) {
      const h = wRef.offsetHeight
      if (h) {
        setHeight(h)
      }
    }
    lastRenderMessages.current = renderMessages
  }, [renderMessages, wRef])

  if (renderMessages) {
    content = <Content key={id} id={id} ref={setRef} ordinals={ordinals} rowRenderer={rowRenderer} />
  } else {
    content = <Dummy key={id} id={id} height={height} ref={setRef} />
  }

  if (colorWaypoints) {
    let cidx = parseInt(id)
    if (isNaN(cidx)) cidx = 0
    cidx = cidx % colors.length
    return <div style={{backgroundColor: colors[cidx]}}>{content}</div>
  } else {
    return content
  }
})

type ContentType = {
  id: string
  ordinals: Array<T.Chat.Ordinal>
  rowRenderer: (o: T.Chat.Ordinal) => React.ReactNode
}
const Content = React.memo(
  React.forwardRef<HTMLDivElement, ContentType>(function Content(p, ref) {
    const {id, ordinals, rowRenderer} = p
    // Apply data-key to the dom node so we can search for editing messages
    return (
      <div data-key={id} ref={ref}>
        {ordinals.map((o): React.ReactNode => rowRenderer(o))}
      </div>
    )
  })
)

type DummyType = {
  id: string
  height: number
}
const Dummy = React.memo(
  React.forwardRef<HTMLDivElement, DummyType>(function Dummy(p, ref) {
    const {id, height} = p
    // Apply data-key to the dom node so we can search for editing messages
    return <div data-key={id} style={{contentVisibility: 'auto', height}} ref={ref} />
  })
)

const styles = Kb.Styles.styleSheetCreate(
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
          paddingBottom: globalMargins.small,
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

export default ThreadWrapper

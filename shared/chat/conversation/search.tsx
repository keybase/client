import * as C from '@/constants'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {RPCError} from '@/util/errors'
import {formatTimeForMessages} from '@/util/timestamp'
import {useCurrentUserState} from '@/stores/current-user'
import {useConversationCenterActions} from './centering'
import {cancelActiveThreadSearchRPC, searchInboxRPC} from '../search-rpc'
import {
  useConversationThreadID,
  useConversationThreadSelector,
  useConversationThreadToggleSearch,
} from './thread-context'
import {useThreadSearchRoute} from './thread-search-route'
import {ThreadSearchOverlayContext} from './thread-search-overlay-context'

type OwnProps = {style?: Kb.Styles.StylesCrossPlatform}
export type CommonProps = OwnProps & {
  conversationIDKey: T.Chat.ConversationIDKey
  initialQuery: string
}

type SearchState = {
  hits: Array<T.Chat.Message>
  status: T.Chat.ThreadSearchInfo['status']
}

const runSearchInbox = async (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  deviceName: string
  getLastOrdinal: () => T.Chat.Ordinal
  onDone: () => void
  pendingHitsRef: {current: Array<T.Chat.Message>}
  pendingReplaceHitsRef: {current: Array<T.Chat.Message> | undefined}
  query: string
  scheduleFlush: () => void
  updateIfCurrent: (updater: (state: SearchState) => SearchState) => void
  username: string
}) => {
  const {conversationIDKey, deviceName, getLastOrdinal, onDone, query, username} = p
  const {pendingHitsRef, pendingReplaceHitsRef, scheduleFlush, updateIfCurrent} = p
  try {
    await searchInboxRPC({
      incomingCallMap: {
        'chat.1.chatUi.chatSearchDone': onDone,
        'chat.1.chatUi.chatSearchHit': hit => {
          const message = Message.uiMessageToMessage(
            conversationIDKey,
            hit.searchHit.hitMessage,
            username,
            getLastOrdinal,
            deviceName
          )
          if (!message) {
            return
          }
          pendingHitsRef.current.push(message)
          scheduleFlush()
        },
        'chat.1.chatUi.chatSearchInboxDone': onDone,
        'chat.1.chatUi.chatSearchInboxHit': resp => {
          const messages = (resp.searchHit.hits || []).reduce<Array<T.Chat.Message>>((result, hit) => {
            const message = Message.uiMessageToMessage(
              conversationIDKey,
              hit.hitMessage,
              username,
              getLastOrdinal,
              deviceName
            )
            if (message) {
              result.push(message)
            }
            return result
          }, [])
          pendingHitsRef.current = []
          pendingReplaceHitsRef.current = messages
          scheduleFlush()
        },
        'chat.1.chatUi.chatSearchInboxStart': () => {
          updateIfCurrent(state => ({...state, status: 'inprogress'}))
        },
      },
      opts: {
        convID: T.Chat.isValidConversationIDKey(conversationIDKey)
          ? T.Chat.keyToConversationID(conversationIDKey)
          : new Uint8Array(0),
        maxHits: 1000,
      },
      query,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      updateIfCurrent(state => ({...state, status: 'done'}))
    }
  }
}

export const useCommon = (ownProps: CommonProps) => {
  const {conversationIDKey, initialQuery, style} = ownProps
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const {centerOn, clearCenter} = useConversationCenterActions()
  const onToggleThreadSearch = () => {
    clearCenter()
    toggleThreadSearch()
  }

  const [searchState, setSearchState] = React.useState<SearchState>(() => ({
    hits: [],
    status: initialQuery ? 'inprogress' : 'initial',
  }))
  const {hits: messageHits, status} = searchState
  const numHits = messageHits.length
  const hits = messageHits.map(h => ({
    author: h.author,
    summary: h.bodySummary.stringValue(),
    timestamp: h.timestamp,
  }))
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  // an inbox hit replaces the whole list, so a shorter replacement can leave the
  // index past the end and the counter reading "8 of 2" until the user moves
  if (selectedIndex >= numHits && selectedIndex !== 0) {
    setSelectedIndex(numHits === 0 ? 0 : numHits - 1)
  }
  const [text, setText] = React.useState(initialQuery)
  const [lastSearch, setLastSearch] = React.useState(initialQuery)

  const searchOrdinalRef = React.useRef(0)
  const hitsRef = React.useRef(messageHits)
  const flushTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingHitsRef = React.useRef<Array<T.Chat.Message>>([])
  const pendingReplaceHitsRef = React.useRef<Array<T.Chat.Message> | undefined>(undefined)
  const lastOrdinal = useConversationThreadSelector(
    s => s.messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
  )
  const lastOrdinalRef = React.useRef(lastOrdinal)
  React.useEffect(() => {
    hitsRef.current = messageHits
  }, [messageHits])
  React.useEffect(() => {
    lastOrdinalRef.current = lastOrdinal
  }, [lastOrdinal])

  const clearPendingFlush = React.useEffectEvent(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = undefined
    }
    pendingHitsRef.current = []
    pendingReplaceHitsRef.current = undefined
  })

  const startThreadSearchRequest = React.useEffectEvent((query: string, requestOrdinal: number) => {
    if (!query) {
      return
    }

    const {deviceName, username} = useCurrentUserState.getState()
    const getLastOrdinal = () => lastOrdinalRef.current
    const updateIfCurrent = (updater: (state: SearchState) => SearchState) => {
      if (searchOrdinalRef.current !== requestOrdinal) {
        return
      }
      setSearchState(state => (searchOrdinalRef.current === requestOrdinal ? updater(state) : state))
    }
    const flushPendingHits = (statusOverride?: SearchState['status']) => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
        flushTimeoutRef.current = undefined
      }
      const pendingReplaceHits = pendingReplaceHitsRef.current
      const pendingHits = pendingHitsRef.current
      pendingReplaceHitsRef.current = undefined
      pendingHitsRef.current = []
      if (!pendingReplaceHits && !pendingHits.length && statusOverride === undefined) {
        return
      }
      updateIfCurrent(state => {
        let nextHits = state.hits
        if (pendingReplaceHits) {
          nextHits = pendingReplaceHits
        } else if (pendingHits.length) {
          const seen = new Set(nextHits.map(hit => hit.id))
          nextHits = [...nextHits]
          pendingHits.forEach(hit => {
            if (!seen.has(hit.id)) {
              seen.add(hit.id)
              nextHits.push(hit)
            }
          })
        }
        return {hits: nextHits, status: statusOverride ?? state.status}
      })
    }
    const scheduleFlush = () => {
      if (flushTimeoutRef.current) {
        return
      }
      flushTimeoutRef.current = setTimeout(() => {
        flushPendingHits()
      }, 16)
    }
    const onDone = () => {
      flushPendingHits('done')
    }

    C.ignorePromise(
      runSearchInbox({
        conversationIDKey,
        deviceName,
        getLastOrdinal,
        onDone,
        pendingHitsRef,
        pendingReplaceHitsRef,
        query,
        scheduleFlush,
        updateIfCurrent,
        username,
      })
    )
  })

  const runThreadSearch = (query: string) => {
    const requestOrdinal = searchOrdinalRef.current + 1
    searchOrdinalRef.current = requestOrdinal
    clearPendingFlush()
    setSearchState({hits: [], status: query ? 'inprogress' : 'done'})
    startThreadSearchRequest(query, requestOrdinal)
  }

  const submitSearch = () => {
    setLastSearch(text)
    setSelectedIndex(0)
    runThreadSearch(text)
  }

  // The index feeds the `n of m` counter and the up/down walk, so it may only rest on a hit the
  // thread actually reached. Taken optimistically - the counter should answer the keypress, not the
  // round trip - then given back if centering reports the message was never in the thread.
  // 'clamped' counts as reached: a hit within half a viewport of either end cannot be put in the
  // middle, but it is on screen and it is where the reader was sent. Only 'not-found' means the
  // thread came back without the message at all, and leaving the counter parked on a row that never
  // rendered is what used to make `n of m` lie.
  const selectRequestRef = React.useRef(0)
  const [selectHit] = React.useState(() => {
    const select = (index: number, previousIndex: number): boolean => {
      const message = hitsRef.current[index]
      if (!message?.id) {
        return false
      }
      const request = ++selectRequestRef.current
      setSelectedIndex(index)
      const settle = async () => {
        const outcome = await centerOn(message.id, 'always')
        // A later selection owns the counter now.
        if (selectRequestRef.current !== request || outcome !== 'not-found') {
          return
        }
        // Putting the counter back is only half of the retreat. centerOn cleared and reloaded the
        // thread around a message it turned out not to hold, so the centre is still on that message:
        // leaving it there parks the reader on a window centered on nothing while the counter names
        // a row somewhere else. Go back to the hit we came from, centre included.
        const previous = hitsRef.current[previousIndex]
        // Nowhere to retreat to: the first hit of a fresh search comes in as select(0, 0), and a
        // previous hit with no id was never reachable either. Give up the centre rather than hold
        // one the thread cannot show.
        if (previousIndex === index || !previous?.id) {
          setSelectedIndex(previousIndex)
          clearCenter()
          return
        }
        // One step, not a walk: the retreat passes itself as its own previous, so if that hit is
        // missing too it lands on the branch above instead of unwinding the whole list.
        select(previousIndex, previousIndex)
      }
      void settle()
      return true
    }
    return select
  })

  // walk in `delta`'s direction until we land on a hit that has an id at all, so a hit with none
  // can never wedge the walk in place
  const step = (delta: 1 | -1) => {
    if (!numHits) {
      return
    }
    for (let moved = 1; moved <= numHits; ++moved) {
      const index = (((selectedIndex + delta * moved) % numHits) + numHits) % numHits
      if (selectHit(index, selectedIndex)) {
        return
      }
    }
  }

  const selectResult = (index: number) => {
    selectHit(index, selectedIndex)
  }

  const onUp = () => {
    step(1)
  }

  const onEnter = () => {
    if (lastSearch === text) {
      onUp()
    } else {
      submitSearch()
    }
  }

  const onDown = () => {
    step(-1)
  }

  const onChangedText = (newText: string) => {
    setText(newText)
  }

  const inProgress = status === 'inprogress'
  const hasResults = status === 'done' || numHits > 0

  React.useEffect(() => {
    if (!initialQuery) {
      return
    }
    const requestOrdinal = searchOrdinalRef.current + 1
    searchOrdinalRef.current = requestOrdinal
    clearPendingFlush()
    startThreadSearchRequest(initialQuery, requestOrdinal)
  }, [initialQuery])

  React.useEffect(() => {
    return () => {
      searchOrdinalRef.current += 1
      clearPendingFlush()
      C.ignorePromise(cancelActiveThreadSearchRPC().catch(() => {}))
    }
  }, [])

  const hasHits = numHits > 0
  const hadHitsRef = React.useRef(false)
  React.useEffect(() => {
    if (hasHits && !hadHitsRef.current) {
      hadHitsRef.current = true
      // The first hit of a fresh search: there is nothing to hand the counter back to.
      selectHit(0, 0)
    } else if (!hasHits) {
      hadHitsRef.current = false
    }
  }, [hasHits, selectHit])

  return {
    conversationIDKey,
    hasResults,
    hits,
    inProgress,
    numHits,
    onChangedText,
    onDown,
    onEnter,
    onToggleThreadSearch,
    onUp,
    selectResult,
    selectedIndex,
    status,
    style,
    submitSearch,
    text,
  }
}

const hitHeight = 30

type SearchHit = {
  author: string
  summary: string
  timestamp: number
}

const useThreadSearchCommonProps = (p: OwnProps): CommonProps => {
  const conversationIDKey = useConversationThreadID()
  const initialQuery = useThreadSearchRoute()?.query ?? ''
  return {...p, conversationIDKey, initialQuery}
}

export const threadSearchKey = (p: CommonProps) => `${p.conversationIDKey}:${p.initialQuery}`

const ThreadSearchDesktop = function ThreadSearchDesktop(p: OwnProps) {
  const commonProps = useThreadSearchCommonProps(p)
  return <ThreadSearchDesktopInner key={threadSearchKey(commonProps)} {...commonProps} />
}

const ThreadSearchDesktopInner = function ThreadSearchDesktopInner(p: CommonProps) {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const props = useCommon(p)
  const {conversationIDKey, submitSearch, hits, selectResult, onEnter} = props
  const {onUp, onDown, onChangedText, inProgress, hasResults} = props
  const {selectedIndex, status, text, style, onToggleThreadSearch} = props
  const onHotKey = (cmd: string) => {
    if (cmd === 'esc') {
      onToggleThreadSearch()
    }
  }
  Kb.useHotKey('esc', onHotKey)
  const inputRef = React.createRef<Kb.Input3Ref>()
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onToggleThreadSearch()
        break
      case 'g':
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            onDown()
          } else {
            onUp()
          }
        }
        break
      case 'ArrowUp':
        onUp()
        break
      case 'ArrowDown':
        onDown()
        break
      case 'Enter':
        if (e.shiftKey) {
          onDown()
        }
        break
    }
  }

  const _renderHit = (index: number, item: SearchHit) => {
    return (
      <Kb.ClickableBox direction="horizontal" alignItems="center" justifyContent="space-between" fullWidth={true} key={index} onClick={() => selectResult(index)} style={styles.hitRow}>
        <Kb.Avatar username={item.author} size={24} />
        <Kb.Text type="Body" style={styles.hitSummary}>
          {item.summary}
        </Kb.Text>
        <Kb.Text type="BodySmall" style={styles.time}>
          {formatTimeForMessages(item.timestamp)}
        </Kb.Text>
      </Kb.ClickableBox>
    )
  }

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [conversationIDKey, inputRef])

  const noResults = status === 'done' && hits.length === 0
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={style}>
      <Kb.Box2
        direction="horizontal"
        justifyContent="space-between"
        padding="tiny"
        style={styles.outerContainer}
        fullWidth={true}
        gap="tiny"
      >
        <Kb.Box2 direction="horizontal" justifyContent="space-between" style={styles.inputContainer}>
          <Kb.Box2 direction="horizontal" gap="xtiny" flex={1} centerChildren={true}>
            <Kb.Input3
              autoFocus={true}
              onChangeText={onChangedText}
              onEnterKeyDown={onEnter}
              onKeyDown={onKeyDown}
              placeholder="Search..."
              ref={inputRef}
              value={text}
              hideBorder={true}
              containerStyle={styles.bareInput}
            />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="tiny" noShrink={true}>
            {inProgress && <Kb.ProgressIndicator style={styles.progress} />}
            {hasResults && (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Text type="BodySmall" style={styles.results}>
                  {noResults ? 'No results' : `${selectedIndex + 1} of ${hits.length}`}
                </Kb.Text>
                <Kb.Icon
                  color={noResults ? theme.black_35 : theme.black_50}
                  onClick={!noResults ? onUp : undefined}
                  type="iconfont-arrow-up"
                />
                <Kb.Icon
                  color={noResults ? theme.black_35 : theme.black_50}
                  onClick={!noResults ? onDown : undefined}
                  type="iconfont-arrow-down"
                />
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Button disabled={inProgress} onClick={submitSearch} label="Search" />
        <Kb.Button type="Dim" onClick={onToggleThreadSearch} label="Cancel" />
      </Kb.Box2>
      {hits.length > 0 && (
        <Kb.List
          indexAsKey={true}
          items={hits}
          itemHeight={{height: hitHeight, type: 'fixed'}}
          renderItem={_renderHit}
          style={styles.hitList}
        />
      )}
    </Kb.Box2>
  )
}

const ThreadSearchMobile = function ThreadSearchMobile(p: OwnProps) {
  const commonProps = useThreadSearchCommonProps(p)
  return <ThreadSearchMobileInner key={threadSearchKey(commonProps)} {...commonProps} />
}

const ThreadSearchMobileInner = function ThreadSearchMobileInner(p: CommonProps) {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const props = useCommon(p)
  const {numHits, onEnter, onUp, onDown, onChangedText, onToggleThreadSearch} = props
  const {inProgress, hasResults, selectedIndex, text, status} = props

  const inputRef = React.useRef<Kb.Input3Ref>(null)
  const onceRef = React.useRef(false)
  React.useEffect(() => {
    if (onceRef.current) return
    onceRef.current = true
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [])

  // Report our height so the list can reserve space / lift the jump button while
  // this bar overlays the bottom of the thread. Reset to 0 when we unmount.
  const searchOverlayHeight = React.useContext(ThreadSearchOverlayContext)
  const onLayout = (e: {nativeEvent: {layout: {height: number}}}) => {
    searchOverlayHeight?.set(e.nativeEvent.layout.height)
  }
  React.useEffect(() => {
    return () => {
      searchOverlayHeight?.set(0)
    }
  }, [searchOverlayHeight])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.mobileContainer} onLayout={onLayout}>
      <Kb.Box2 direction="horizontal" fullWidth={true} justifyContent="space-between" padding="tiny" style={styles.outerContainer} gap="tiny">
        <Kb.Box2 direction="horizontal" centerChildren={true} noShrink={true}>
          <Kb.Text type="BodySemibold" style={styles.done} onClick={onToggleThreadSearch}>
            Cancel
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" justifyContent="space-between" style={styles.inputContainer}>
          <Kb.Box2 direction="horizontal" gap="xtiny" flex={1} centerChildren={true}>
            <Kb.Input3
              ref={inputRef}
              autoFocus={false}
              onChangeText={onChangedText}
              onEnterKeyDown={onEnter}
              placeholder="Search..."
              returnKeyType="search"
              value={text}
              hideBorder={true}
              containerStyle={styles.bareInput}
            />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="tiny" noShrink={true}>
            {inProgress && <Kb.ProgressIndicator style={styles.progress} />}
            {hasResults && (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Text type="BodySmall" style={styles.results}>
                  {status === 'done' && numHits === 0 ? 'No results' : `${selectedIndex + 1} of ${numHits}`}
                </Kb.Text>
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="tiny">
          <Kb.Icon
            color={numHits > 0 ? theme.blue : theme.black_50}
            onClick={onUp}
            type="iconfont-arrow-up"
          />
          <Kb.Icon
            color={numHits > 0 ? theme.blue : theme.black_50}
            onClick={onDown}
            type="iconfont-arrow-down"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      bareInput: {backgroundColor: theme.transparent, flex: 1, padding: 0, width: 'auto'},
      done: {color: theme.blueDark},
      hitList: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: theme.blueLighter3,
          borderBottom: '1px solid',
          borderColor: theme.black_20,
          height: 4 * hitHeight,
        },
      }),
      hitRow: {
        height: hitHeight,
        padding: Kb.Styles.globalMargins.tiny,
      },
      hitSummary: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline',
          flex: 1,
          marginLeft: Kb.Styles.globalMargins.tiny,
          ...Kb.Styles.textEllipsis,
        },
      }),
      mobileContainer: {
        backgroundColor: theme.white,
        paddingBottom: Kb.Styles.globalMargins.small,
      },
      inputContainer: Kb.Styles.platformStyles({
        common: {
          backgroundColor: theme.white,
          ...Kb.Styles.border(theme.black_20, 1, Kb.Styles.borderRadius),
          flex: 1,
        },
        isElectron: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.tiny),
        },
        isMobile: {padding: Kb.Styles.globalMargins.tiny},
      }),
      outerContainer: {
        backgroundColor: theme.blueLighter3,
      },
      progress: {height: 16},
      results: {color: theme.black_50},
      time: {flexShrink: 0},
    }) as const
)

export default isMobile ? ThreadSearchMobile : ThreadSearchDesktop

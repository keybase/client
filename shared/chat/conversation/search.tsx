import * as C from '@/constants'
import * as Message from '@/constants/chat/message'
import * as ConvoState from '@/stores/convostate'
import type * as Styles from '@/styles'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {RPCError} from '@/util/errors'
import {formatTimeForMessages} from '@/util/timestamp'
import {useCurrentUserState} from '@/stores/current-user'
import {useThreadSearchRoute} from './thread-search-route'

type OwnProps = {style?: Styles.StylesCrossPlatform}
type CommonProps = OwnProps & {
  conversationIDKey: T.Chat.ConversationIDKey
  initialQuery: string
}

type SearchState = {
  hits: Array<T.Chat.Message>
  status: T.Chat.ThreadSearchInfo['status']
}

const useCommon = (ownProps: CommonProps) => {
  const {conversationIDKey, initialQuery, style} = ownProps
  const {loadMessagesCentered, toggleThreadSearch} = ConvoState.useChatContext(
    C.useShallow(s => ({
      loadMessagesCentered: s.dispatch.loadMessagesCentered,
      toggleThreadSearch: s.dispatch.toggleThreadSearch,
    }))
  )
  const onToggleThreadSearch = () => {
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
  const [text, setText] = React.useState(initialQuery)
  const [lastSearch, setLastSearch] = React.useState(initialQuery)

  const searchOrdinalRef = React.useRef(0)
  const hitsRef = React.useRef(messageHits)
  const flushTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingHitsRef = React.useRef<Array<T.Chat.Message>>([])
  const pendingReplaceHitsRef = React.useRef<Array<T.Chat.Message> | undefined>(undefined)
  React.useEffect(() => {
    hitsRef.current = messageHits
  }, [messageHits])

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
    const getLastOrdinal = () =>
      ConvoState.getConvoState(conversationIDKey).messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
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

    const f = async () => {
      try {
        await T.RPCChat.localSearchInboxRpcListener({
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
          params: {
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            namesOnly: false,
            opts: {
              afterContext: 0,
              beforeContext: 0,
              convID: ConvoState.getConvoState(conversationIDKey).getConvID(),
              isRegex: false,
              matchMentions: false,
              maxBots: 0,
              maxConvsHit: 0,
              maxConvsSearched: 0,
              maxHits: 1000,
              maxMessages: -1,
              maxNameConvs: 0,
              maxTeams: 0,
              reindexMode: T.RPCChat.ReIndexingMode.postsearchSync,
              sentAfter: 0,
              sentBefore: 0,
              sentBy: '',
              sentTo: '',
              skipBotCache: false,
            },
            query,
          },
        })
      } catch (error) {
        if (error instanceof RPCError) {
          updateIfCurrent(state => ({...state, status: 'done'}))
        }
      }
    }
    C.ignorePromise(f())
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

  const [selectResult] = React.useState(() => (index: number) => {
    const message = hitsRef.current[index]
    if (message?.id) {
      loadMessagesCentered(message.id, 'always')
    }
    setSelectedIndex(index)
  })

  const onUp = () => {
    if (!numHits) {
      return
    }
    if (selectedIndex >= numHits - 1) {
      selectResult(0)
      return
    }
    selectResult(selectedIndex + 1)
  }

  const onEnter = () => {
    if (lastSearch === text) {
      onUp()
    } else {
      submitSearch()
    }
  }

  const onDown = () => {
    if (!numHits) {
      return
    }
    if (selectedIndex <= 0) {
      selectResult(numHits - 1)
      return
    }
    selectResult(selectedIndex - 1)
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
      C.ignorePromise(T.RPCChat.localCancelActiveSearchRpcPromise().catch(() => {}))
    }
  }, [])

  const hasHits = numHits > 0
  const hadHitsRef = React.useRef(false)
  React.useEffect(() => {
    if (hasHits && !hadHitsRef.current) {
      hadHitsRef.current = true
      selectResult(0)
    } else if (!hasHits) {
      hadHitsRef.current = false
    }
  }, [hasHits, selectResult])

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
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const initialQuery = useThreadSearchRoute()?.query ?? ''
  return {...p, conversationIDKey, initialQuery}
}

const threadSearchKey = (p: CommonProps) => `${p.conversationIDKey}:${p.initialQuery}`

const ThreadSearchDesktop = function ThreadSearchDesktop(p: OwnProps) {
  const commonProps = useThreadSearchCommonProps(p)
  return <ThreadSearchDesktopInner key={threadSearchKey(commonProps)} {...commonProps} />
}

const ThreadSearchDesktopInner = function ThreadSearchDesktopInner(p: CommonProps) {
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
      <Kb.ClickableBox key={index} onClick={() => selectResult(index)} style={styles.hitRow}>
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
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
            {inProgress && <Kb.ProgressIndicator style={styles.progress} />}
            {hasResults && (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Text type="BodySmall" style={styles.results}>
                  {noResults ? 'No results' : `${selectedIndex + 1} of ${hits.length}`}
                </Kb.Text>
                <Kb.Icon
                  color={noResults ? Kb.Styles.globalColors.black_35 : Kb.Styles.globalColors.black_50}
                  onClick={!noResults ? onUp : undefined}
                  type="iconfont-arrow-up"
                />
                <Kb.Icon
                  color={noResults ? Kb.Styles.globalColors.black_35 : Kb.Styles.globalColors.black_50}
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
  const props = useCommon(p)
  const {numHits, onEnter, onUp, onDown, onChangedText, onToggleThreadSearch} = props
  const {inProgress, hasResults, selectedIndex, text, style, status} = props

  const inputRef = React.useRef<Kb.Input3Ref>(null)
  const onceRef = React.useRef(false)
  React.useEffect(() => {
    if (onceRef.current) return
    onceRef.current = true
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [])

  return (
    <Kb.Box2 direction="horizontal" style={style}>
      <Kb.Box2 direction="horizontal" justifyContent="space-between" style={styles.outerContainer} gap="tiny">
        <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.doneContainer}>
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
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
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
            color={numHits > 0 ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.black_50}
            onClick={onUp}
            type="iconfont-arrow-up"
          />
          <Kb.Icon
            color={numHits > 0 ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.black_50}
            onClick={onDown}
            type="iconfont-arrow-down"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bareInput: {backgroundColor: Kb.Styles.globalColors.transparent, flex: 1, padding: 0, width: 'auto'},
      done: {color: Kb.Styles.globalColors.blueDark},
      doneContainer: {flexShrink: 0},
      hitList: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
          borderBottom: '1px solid',
          borderColor: Kb.Styles.globalColors.black_20,
          height: 4 * hitHeight,
        },
      }),
      hitRow: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: hitHeight,
        justifyContent: 'space-between',
        padding: Kb.Styles.globalMargins.tiny,
      },
      hitSummary: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline',
          flex: 1,
          marginLeft: Kb.Styles.globalMargins.tiny,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      inputContainer: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.white,
          borderColor: Kb.Styles.globalColors.black_20,
          borderRadius: Kb.Styles.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          flex: 1,
        },
        isElectron: {
          paddingBottom: Kb.Styles.globalMargins.xtiny,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.xtiny,
        },
        isMobile: {padding: Kb.Styles.globalMargins.tiny},
      }),
      outerContainer: {
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        padding: Kb.Styles.globalMargins.tiny,
      },
      progress: {height: 16},
      results: {color: Kb.Styles.globalColors.black_50},
      resultsContainer: {flexShrink: 0},
      time: {flexShrink: 0},
    }) as const
)

export default Kb.Styles.isMobile ? ThreadSearchMobile : ThreadSearchDesktop

import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import type * as Styles from '@/styles'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {formatTimeForMessages} from '@/util/timestamp'

type OwnProps = {style?: Styles.StylesCrossPlatform}

const useCommon = (ownProps: OwnProps) => {
  const {style} = ownProps

  const data = Chat.useChatContext(
    C.useShallow(s => {
      const {id: conversationIDKey, threadSearchInfo, threadSearchQuery: initialText, dispatch} = s
      const {hits: _hits, status} = threadSearchInfo
      const {loadMessagesCentered, setThreadSearchQuery, toggleThreadSearch, threadSearch} = dispatch
      return {
        _hits,
        conversationIDKey,
        initialText,
        loadMessagesCentered,
        setThreadSearchQuery,
        status,
        threadSearch,
        toggleThreadSearch,
      }
    })
  )

  const {conversationIDKey, _hits, status, initialText} = data
  const {loadMessagesCentered, setThreadSearchQuery, toggleThreadSearch, threadSearch} = data
  const onToggleThreadSearch = React.useCallback(() => {
    toggleThreadSearch()
  }, [toggleThreadSearch])

  const numHits = _hits.length
  const hits = React.useMemo(
    () =>
      _hits.map(h => ({
        author: h.author,
        summary: h.bodySummary.stringValue(),
        timestamp: h.timestamp,
      })),
    [_hits]
  )

  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [text, setText] = React.useState('')
  const [lastSearch, setLastSearch] = React.useState('')

  const submitSearch = React.useCallback(() => {
    setLastSearch(text)
    setSelectedIndex(0)
    threadSearch(text)
  }, [text, threadSearch])

  const selectResult = React.useCallback(
    (index: number) => {
      const message = _hits[index] || Chat.makeMessageText()
      if (message.id > 0) {
        loadMessagesCentered(message.id, 'always')
      }
      setSelectedIndex(index)
    },
    [loadMessagesCentered, _hits]
  )

  const onUp = React.useCallback(() => {
    if (selectedIndex >= numHits - 1) {
      selectResult(0)
      return
    }
    selectResult(selectedIndex + 1)
  }, [selectedIndex, numHits, selectResult])

  const onEnter = React.useCallback(() => {
    if (lastSearch === text) {
      onUp()
    } else {
      submitSearch()
    }
  }, [lastSearch, text, submitSearch, onUp])

  const onDown = React.useCallback(() => {
    if (selectedIndex <= 0) {
      selectResult(numHits - 1)
      return
    }
    selectResult(selectedIndex - 1)
  }, [selectedIndex, numHits, selectResult])

  const onChangedText = React.useCallback((newText: string) => {
    setText(newText)
  }, [])

  const inProgress = status === 'inprogress'
  const hasResults = status === 'done' || numHits > 0

  React.useEffect(() => {
    if (initialText) {
      setThreadSearchQuery('')
      setText(initialText)
    }
  }, [initialText, setThreadSearchQuery])

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

const ThreadSearchDesktop = React.memo(function ThreadSearchDesktop(p: OwnProps) {
  const props = useCommon(p)
  const {conversationIDKey, submitSearch, hits, selectResult, onEnter} = props
  const {onUp, onDown, onChangedText, inProgress, hasResults} = props
  const {selectedIndex, status, text, style, onToggleThreadSearch} = props
  const onHotKey = React.useCallback(
    (cmd: string) => {
      if (cmd === 'esc') {
        onToggleThreadSearch()
      }
    },
    [onToggleThreadSearch]
  )
  Kb.useHotKey('esc', onHotKey)
  const inputRef = React.createRef<Kb.PlainInputRef>()
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
      <Kb.Box2 direction="horizontal" style={styles.outerContainer} fullWidth={true} gap="tiny">
        <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
            <Kb.PlainInput
              autoFocus={true}
              flexable={true}
              onChangeText={onChangedText}
              onEnterKeyDown={onEnter}
              onKeyDown={onKeyDown}
              placeholder="Search..."
              ref={inputRef}
              value={text}
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
        <Kb.List2
          indexAsKey={true}
          items={hits}
          itemHeight={{height: hitHeight, type: 'fixed'}}
          renderItem={_renderHit}
          style={styles.hitList}
        />
      )}
    </Kb.Box2>
  )
})

const ThreadSearchMobile = React.memo(function ThreadSearchMobile(p: OwnProps) {
  const props = useCommon(p)
  const {numHits, onEnter, onUp, onDown, onChangedText, onToggleThreadSearch} = props
  const {inProgress, hasResults, selectedIndex, text, style, status} = props

  const inputRef = React.useRef<Kb.PlainInputRef>(null)
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
      <Kb.Box2 direction="horizontal" style={styles.outerContainer} gap="tiny">
        <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.doneContainer}>
          <Kb.Text type="BodySemibold" style={styles.done} onClick={onToggleThreadSearch}>
            Cancel
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
            <Kb.PlainInput
              ref={inputRef}
              autoFocus={false}
              flexable={true}
              onChangeText={onChangedText}
              onEnterKeyDown={onEnter}
              placeholder="Search..."
              returnKeyType="search"
              value={text}
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
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
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
          justifyContent: 'space-between',
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
        justifyContent: 'space-between',
        padding: Kb.Styles.globalMargins.tiny,
      },
      progress: {height: 16},
      queryContainer: {flex: 1},
      results: {color: Kb.Styles.globalColors.black_50},
      resultsContainer: {flexShrink: 0},
      time: {flexShrink: 0},
    }) as const
)

export default Kb.Styles.isMobile ? ThreadSearchMobile : ThreadSearchDesktop

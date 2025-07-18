import * as C from '@/constants'
import type * as Styles from '@/styles'
import type * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {formatTimeForMessages} from '@/util/timestamp'

type OwnProps = {style?: Styles.StylesCrossPlatform}

const Container = (ownProps: OwnProps) => {
  const {style} = ownProps
  const conversationIDKey = C.useChatContext(s => s.id)
  const {hits: _hits, status} = C.useChatContext(s => s.threadSearchInfo)
  const initialText = C.useChatContext(s => s.threadSearchQuery)
  const loadMessagesCentered = C.useChatContext(s => s.dispatch.loadMessagesCentered)
  const _loadSearchHit = React.useCallback(
    (messageID: T.Chat.MessageID) => {
      loadMessagesCentered(messageID, 'always')
    },
    [loadMessagesCentered]
  )
  const setThreadSearchQuery = C.useChatContext(s => s.dispatch.setThreadSearchQuery)
  const clearInitialText = React.useCallback(() => {
    setThreadSearchQuery('')
  }, [setThreadSearchQuery])
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const threadSearch = C.useChatContext(s => s.dispatch.threadSearch)
  const onSearch = threadSearch
  const onCancel = () => {
    toggleThreadSearch()
  }
  const onToggleThreadSearch = onCancel
  const selfHide = onCancel
  const hits = _hits.map(h => ({
    author: h.author,
    summary: h.bodySummary.stringValue(),
    timestamp: h.timestamp,
  }))
  const loadSearchHit = React.useCallback(
    (index: number) => {
      const message = _hits[index] || C.Chat.makeMessageText()
      if (message.id > 0) {
        _loadSearchHit(message.id)
      }
    },
    [_hits, _loadSearchHit]
  )

  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [text, setText] = React.useState('')
  const [lastSearch, setLastSearch] = React.useState('')

  const submitSearch = React.useCallback(() => {
    setLastSearch(text)
    setSelectedIndex(0)
    onSearch(text)
  }, [text, onSearch])

  const selectResult = React.useCallback(
    (index: number) => {
      loadSearchHit(index)
      setSelectedIndex(index)
    },
    [loadSearchHit]
  )

  const onUp = React.useCallback(() => {
    if (selectedIndex >= hits.length - 1) {
      selectResult(0)
      return
    }
    selectResult(selectedIndex + 1)
  }, [selectedIndex, hits.length, selectResult])

  const onEnter = React.useCallback(() => {
    if (lastSearch === text) {
      onUp()
    } else {
      submitSearch()
    }
  }, [lastSearch, text, submitSearch, onUp])

  const onDown = React.useCallback(() => {
    if (selectedIndex <= 0) {
      selectResult(hits.length - 1)
      return
    }
    selectResult(selectedIndex - 1)
  }, [selectedIndex, hits.length, selectResult])

  const onChangedText = React.useCallback((newText: string) => {
    setText(newText)
  }, [])

  const inProgress = React.useCallback(() => {
    return status === 'inprogress'
  }, [status])

  const hasResults = React.useCallback(() => {
    return status === 'done' || hits.length > 0
  }, [status, hits.length])

  const maybeSetInitialText = React.useCallback(() => {
    if (initialText) {
      clearInitialText()
      setText(initialText)
    }
  }, [initialText, clearInitialText])

  React.useEffect(() => {
    maybeSetInitialText()
  }, [maybeSetInitialText])

  const hasHits = hits.length > 0
  const hadHitsRef = React.useRef(false)
  React.useEffect(() => {
    if (hasHits && !hadHitsRef.current) {
      hadHitsRef.current = true
      selectResult(0)
    }
  }, [hasHits, selectResult])

  const Searcher = Kb.Styles.isMobile ? ThreadSearchMobile : ThreadSearchDesktop

  return (
    <Searcher
      status={status}
      conversationIDKey={conversationIDKey}
      onToggleThreadSearch={onToggleThreadSearch}
      selfHide={selfHide}
      onCancel={onCancel}
      hits={hits}
      style={style}
      submitSearch={submitSearch}
      selectResult={selectResult}
      selectedIndex={selectedIndex}
      onEnter={onEnter}
      onUp={onUp}
      onDown={onDown}
      onChangedText={onChangedText}
      inProgress={inProgress}
      hasResults={hasResults}
      text={text}
    />
  )
}

const hitHeight = 30

type SearchHit = {
  author: string
  summary: string
  timestamp: number
}

type SearchProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  submitSearch: () => void
  selectResult: (arg0: number) => void
  onEnter: () => void
  onUp: () => void
  onDown: () => void
  onChangedText: (arg0: string) => void
  inProgress: () => boolean
  hasResults: () => boolean
  selectedIndex: number
  text: string
  style: Kb.Styles.StylesCrossPlatform
  onToggleThreadSearch: () => void
  selfHide: () => void
  onCancel: () => void
  hits: {
    author: string
    summary: string
    timestamp: number
  }[]
  status: T.Chat.ThreadSearchStatus
}

const ThreadSearchDesktop = (props: SearchProps) => {
  const {conversationIDKey, submitSearch, hits, selectResult, onEnter} = props
  const {onUp, onDown, onChangedText, onCancel, inProgress, hasResults} = props
  const {selectedIndex, status, text, style, onToggleThreadSearch, selfHide} = props
  const hotKeys = ['esc']
  const onHotKey = (cmd: string) => {
    if (cmd === 'esc') {
      onToggleThreadSearch()
    }
  }
  const inputRef = React.createRef<Kb.PlainInputRef>()
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        selfHide()
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
      <Kb.HotKey hotKeys={hotKeys} onHotKey={onHotKey} />
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
            {inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
            {hasResults() && (
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
        <Kb.Button disabled={inProgress()} onClick={submitSearch} label="Search" />
        <Kb.Button type="Dim" onClick={onCancel} label="Cancel" />
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
}

const ThreadSearchMobile = (props: SearchProps) => {
  const {hits, onEnter, onUp, onDown, onChangedText} = props
  const {onCancel, inProgress, hasResults, selectedIndex, text, style, status} = props
  return (
    <Kb.Box2 direction="horizontal" style={style}>
      <Kb.Box2 direction="horizontal" style={styles.outerContainer} gap="tiny">
        <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.doneContainer}>
          <Kb.Text type="BodySemibold" style={styles.done} onClick={onCancel}>
            Cancel
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
            <Kb.PlainInput
              ref={r => {
                // setting autofocus on android fails sometimes, this workaround seems to work
                setTimeout(() => {
                  r?.focus()
                }, 100)
              }}
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
            {inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
            {hasResults() && (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Text type="BodySmall" style={styles.results}>
                  {status === 'done' && hits.length === 0
                    ? 'No results'
                    : `${selectedIndex + 1} of ${hits.length}`}
                </Kb.Text>
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="tiny">
          <Kb.Icon
            color={hits.length > 0 ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.black_50}
            onClick={onUp}
            type="iconfont-arrow-up"
          />
          <Kb.Icon
            color={hits.length > 0 ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.black_50}
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

export default Container

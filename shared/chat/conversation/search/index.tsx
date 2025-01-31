import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {formatTimeForMessages} from '@/util/timestamp'

const hitHeight = 30

type SearchHit = {
  author: string
  summary: string
  timestamp: number
}

export type Props = {
  clearInitialText: () => void
  conversationIDKey: T.Chat.ConversationIDKey
  hits: Array<SearchHit>
  initialText?: string
  loadSearchHit: (hit: number) => void
  onCancel: () => void
  onSearch: (toFind: string) => void
  onToggleThreadSearch: () => void
  selfHide: () => void
  status?: T.Chat.ThreadSearchStatus
  style?: Kb.Styles.StylesCrossPlatform
}

const ThreadSearch = (props: Props) => {
  const {initialText, clearInitialText, status, hits, onSearch, loadSearchHit} = props
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
      {...props}
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
  placeholder?: string
  selectedIndex: number
  text: string
}

const ThreadSearchDesktop = (props: SearchProps & Props) => {
  const hotKeys = ['esc']
  const onHotKey = (cmd: string) => {
    if (cmd === 'esc') {
      props.onToggleThreadSearch()
    }
  }
  const inputRef = React.createRef<Kb.PlainInput>()
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        props.selfHide()
        break
      case 'g':
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            props.onDown()
          } else {
            props.onUp()
          }
        }
        break
      case 'ArrowUp':
        props.onUp()
        break
      case 'ArrowDown':
        props.onDown()
        break
      case 'Enter':
        if (e.shiftKey) {
          props.onDown()
        }
        break
    }
  }

  const _renderHit = (index: number, item: SearchHit) => {
    return (
      <Kb.ClickableBox key={index} onClick={() => props.selectResult(index)} style={styles.hitRow}>
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
  }, [props.conversationIDKey, inputRef])

  const noResults = props.status === 'done' && props.hits.length === 0
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={props.style}>
      <Kb.HotKey hotKeys={hotKeys} onHotKey={onHotKey} />
      <Kb.Box2 direction="horizontal" style={styles.outerContainer} fullWidth={true} gap="tiny">
        <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
            <Kb.PlainInput
              autoFocus={true}
              flexable={true}
              onChangeText={props.onChangedText}
              onEnterKeyDown={props.onEnter}
              onKeyDown={onKeyDown}
              placeholder="Search..."
              ref={inputRef}
              value={props.text}
            />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
            {props.inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
            {props.hasResults() && (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Text type="BodySmall" style={styles.results}>
                  {noResults ? 'No results' : `${props.selectedIndex + 1} of ${props.hits.length}`}
                </Kb.Text>
                <Kb.Icon
                  color={noResults ? Kb.Styles.globalColors.black_35 : Kb.Styles.globalColors.black_50}
                  onClick={!noResults ? props.onUp : undefined}
                  type="iconfont-arrow-up"
                />
                <Kb.Icon
                  color={noResults ? Kb.Styles.globalColors.black_35 : Kb.Styles.globalColors.black_50}
                  onClick={!noResults ? props.onDown : undefined}
                  type="iconfont-arrow-down"
                />
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Button disabled={props.inProgress()} onClick={props.submitSearch} label="Search" />
        <Kb.Button type="Dim" onClick={props.onCancel} label="Cancel" />
      </Kb.Box2>
      {props.hits.length > 0 && (
        <Kb.List2
          indexAsKey={true}
          items={props.hits}
          itemHeight={{height: hitHeight, type: 'fixed'}}
          renderItem={_renderHit}
          style={styles.hitList}
        />
      )}
    </Kb.Box2>
  )
}

const ThreadSearchMobile = (props: SearchProps & Props) => (
  <Kb.Box2 direction="horizontal" style={props.style}>
    <Kb.Box2 direction="horizontal" style={styles.outerContainer} gap="tiny">
      <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.doneContainer}>
        <Kb.Text type="BodySemibold" style={styles.done} onClick={props.onCancel}>
          Cancel
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
        <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
          <Kb.PlainInput
            autoFocus={true}
            flexable={true}
            onChangeText={props.onChangedText}
            onEnterKeyDown={props.onEnter}
            placeholder="Search..."
            returnKeyType="search"
            value={props.text}
          />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
          {props.inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
          {props.hasResults() && (
            <Kb.Box2 direction="horizontal" gap="tiny">
              <Kb.Text type="BodySmall" style={styles.results}>
                {props.status === 'done' && props.hits.length === 0
                  ? 'No results'
                  : `${props.selectedIndex + 1} of ${props.hits.length}`}
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.Icon
          color={props.hits.length > 0 ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.black_50}
          onClick={props.onUp}
          type="iconfont-arrow-up"
        />
        <Kb.Icon
          color={props.hits.length > 0 ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.black_50}
          onClick={props.onDown}
          type="iconfont-arrow-down"
        />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

export default ThreadSearch

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

import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import {PerfProfiler} from '@/perf/react-profiler'
import {
  type RowItem,
  type ViewableItemsData,
  viewabilityConfig,
  getItemType,
  keyExtractor,
  useUnreadShortcut,
  useScrollUnbox,
} from './list-helpers'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import InboxSearch from '../inbox-search'
import ConnectedTeamsDivider from './row/teams-divider-container'
import UnreadShortcut from './unread-shortcut'
import * as Kb from '@/common-adapters'
import type {LegendListRef} from '@/common-adapters'
import {createPortal} from 'react-dom'
import {inboxWidth, smallRowHeight, getRowHeight} from './row/sizes'
import {makeRow} from './row'
import type {InboxSearchController} from './use-inbox-search'
import {useInboxSearch} from './use-inbox-search'
import {useInboxState} from './use-inbox-state'
import './inbox.css'

const widths = [10, 80, 2, 66]
const stableWidth = (idx: number) => 160 + -widths[idx % widths.length]!

const FakeRow = ({idx}: {idx: number}) => (
  <Kb.Box2 direction="horizontal" style={styles.fakeRow}>
    <Kb.Box2 direction="vertical" style={styles.fakeAvatar} />
    <Kb.Box2 direction="vertical" justifyContent="space-around" flex={1} style={styles.fakeText}>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.fakeTextTop, {width: stableWidth(idx) / 4}])}
        alignSelf="flex-start"
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([styles.fakeTextBottom, {width: stableWidth(idx)}])}
        alignSelf="flex-start"
      />
    </Kb.Box2>
  </Kb.Box2>
)

const FakeRemovingRow = () => <Kb.Box2 direction="horizontal" style={styles.fakeRemovingRow} />

const dragKey = 'application/keybase_inbox'

const DragLine = (p: {
  rows: ReadonlyArray<RowItem>
  scrollDiv: React.RefObject<HTMLDivElement | null>
  inboxNumSmallRows: number
  showButton: boolean
  hiddenCount: number
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
  setInboxNumSmallRows: (n: number) => void
}) => {
  const {rows, inboxNumSmallRows, showButton, scrollDiv, hiddenCount} = p
  const {smallTeamsExpanded, toggleSmallTeamsExpanded, setInboxNumSmallRows} = p
  const [dragY, setDragY] = React.useState(-1)
  const [dividerVisualTop, setDividerVisualTop] = React.useState(0)
  const deltaNewSmallRows = () => {
    if (dragY === -1) {
      return 0
    }
    return Math.max(0, Math.floor(dragY / smallRowHeight)) - inboxNumSmallRows
  }

  const newSmallRows = deltaNewSmallRows()
  let expandingRows: Array<string> = []
  let removingRows: Array<string> = []
  if (newSmallRows > 0) {
    expandingRows = new Array<string>(newSmallRows).fill('')
  } else if (newSmallRows < 0) {
    removingRows = new Array<string>(-newSmallRows).fill('')
  }

  const throttledDragUpdate = C.useThrottledCallback((dy: number, dvt: number) => {
    setDragY(dy)
    setDividerVisualTop(dvt)
  }, 100)

  const goodDropRef = React.useRef(false)

  React.useEffect(() => {
    const d = scrollDiv.current
    if (!d) {
      return
    }
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (
        scrollDiv.current &&
        (e.dataTransfer?.types.length ?? 0) > 0 &&
        e.dataTransfer?.types[0] === dragKey
      ) {
        const scrollableDiv = scrollDiv.current.firstElementChild as HTMLDivElement | null
        if (scrollableDiv) {
          const dy = e.clientY - scrollDiv.current.getBoundingClientRect().top + scrollableDiv.scrollTop
          const dvt = inboxNumSmallRows * smallRowHeight - scrollableDiv.scrollTop
          throttledDragUpdate(dy, dvt)
        }
      }
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      goodDropRef.current = true
    }
    d.addEventListener('dragover', onDragOver)
    d.addEventListener('drop', onDrop)
    return () => {
      d.removeEventListener('dragover', onDragOver)
      d.removeEventListener('drop', onDrop)
    }
  }, [scrollDiv, throttledDragUpdate, inboxNumSmallRows])

  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(dragKey, dragKey)
    goodDropRef.current = false
  }
  const onDragEnd = () => {
    if (goodDropRef.current) {
      const delta = deltaNewSmallRows()
      if (delta !== 0) {
        setInboxNumSmallRows(inboxNumSmallRows + delta)
      }
      goodDropRef.current = false
    }
    setDragY(-1)
  }

  const overlayTop = expandingRows.length
    ? dividerVisualTop
    : dividerVisualTop - removingRows.length * smallRowHeight

  const overlay =
    dragY !== -1 && (expandingRows.length > 0 || removingRows.length > 0) && scrollDiv.current
      ? createPortal(
          <Kb.Box2
            direction="vertical"
            style={Kb.Styles.collapseStyles([
              styles.fakeRowContainer,
              {
                height: (expandingRows.length || removingRows.length) * smallRowHeight,
                top: overlayTop,
              },
            ])}
          >
            {expandingRows.map((_, idx) => (
              <FakeRow idx={idx} key={idx} />
            ))}
            {removingRows.map((_, idx) => (
              <FakeRemovingRow key={idx} />
            ))}
          </Kb.Box2>,
          scrollDiv.current
        )
      : null

  return (
    <div style={styles.dragLineWrapper}>
      {showButton && !smallTeamsExpanded && (
        <>
          <div
            className="grabLinesContainer"
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            style={Kb.Styles.castStyleDesktop(styles.grabber)}
          >
            <Kb.Box2 className="grabLines" direction="vertical" style={styles.grabberLineContainer}>
              <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
              <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
              <Kb.Box2 direction="horizontal" style={styles.grabberLine} />
            </Kb.Box2>
          </div>
          <Kb.Box2 direction="vertical" style={styles.spacer} />
        </>
      )}
      <ConnectedTeamsDivider
        rows={rows}
        hiddenCountDelta={newSmallRows !== 0 ? -newSmallRows : 0}
        key="divider"
        toggle={toggleSmallTeamsExpanded}
        showButton={showButton}
        hiddenCount={hiddenCount}
        smallTeamsExpanded={smallTeamsExpanded}
      />
      {overlay}
    </div>
  )
}

type InboxProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  refreshInbox?: T.Chat.ChatRootInboxRefresh
  search?: InboxSearchController
}

type ControlledInboxProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  refreshInbox?: T.Chat.ChatRootInboxRefresh
  search: InboxSearchController
}

function InboxWithSearch(props: {
  conversationIDKey?: T.Chat.ConversationIDKey
  refreshInbox?: T.Chat.ChatRootInboxRefresh
}) {
  const search = useInboxSearch()
  return <InboxBody conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} search={search} />
}

function InboxBody(props: ControlledInboxProps) {
  const {conversationIDKey, refreshInbox, search} = props
  const inbox = useInboxState(conversationIDKey, search.isSearching, refreshInbox)
  const {smallTeamsExpanded, rows, unreadIndices, unreadTotal, inboxNumSmallRows} = inbox
  const {toggleSmallTeamsExpanded, selectedConversationIDKey, onUntrustedInboxVisible} = inbox
  const {setInboxNumSmallRows, allowShowFloatingButton} = inbox

  const scrollDiv = React.useRef<HTMLDivElement | null>(null)
  const listRef = React.useRef<LegendListRef | null>(null)

  const {showFloating, showUnread, unreadCount, scrollToUnread, lastVisibleIdxRef, applyUnreadAndFloating} =
    useUnreadShortcut({listRef, rows, unreadIndices, unreadTotal})
  const onScrollUnbox = useScrollUnbox(onUntrustedInboxVisible, 200)

  // onViewableItemsChanged doesn't fire on initial render, only on scroll.
  // Unbox the initially visible rows when rows first become available.
  const didInitialUnboxRef = React.useRef(false)
  React.useEffect(() => {
    if (didInitialUnboxRef.current || rows.length === 0) return
    didInitialUnboxRef.current = true
    const toUnbox = rows.reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
      if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])
    if (toUnbox.length > 0) {
      onUntrustedInboxVisible(toUnbox)
    }
  }, [rows, onUntrustedInboxVisible])

  const itemHeight = {
    getSize: (item: RowItem) => getRowHeight(item.type, item.type === 'divider' && item.showButton),
    type: 'perItem' as const,
  }

  const onViewChanged = (data: ViewableItemsData) => {
    lastVisibleIdxRef.current = data.viewableItems.at(-1)?.index ?? -1
    applyUnreadAndFloating()
    onScrollUnbox(data)
  }

  const scrollToBigTeams = () => {
    if (!scrollDiv.current) return

    if (smallTeamsExpanded) {
      toggleSmallTeamsExpanded()
    }

    const scrollableDiv = scrollDiv.current.firstElementChild as HTMLDivElement | null
    if (!scrollableDiv) return

    const top = inboxNumSmallRows * smallRowHeight
    const boundingHeight = scrollableDiv.getBoundingClientRect().height
    const dragHeight = 76
    const currentScrollTop = scrollableDiv.scrollTop
    if (boundingHeight + currentScrollTop < top + dragHeight) {
      scrollableDiv.scrollBy({behavior: 'smooth', top})
    }
  }

  const renderItem = (_index: number, item: RowItem): React.ReactElement | null => {
    if (item.type === 'divider') {
      return (
        <DragLine
          rows={rows}
          scrollDiv={scrollDiv}
          inboxNumSmallRows={inboxNumSmallRows}
          showButton={item.showButton}
          hiddenCount={item.hiddenCount}
          smallTeamsExpanded={smallTeamsExpanded}
          toggleSmallTeamsExpanded={toggleSmallTeamsExpanded}
          setInboxNumSmallRows={setInboxNumSmallRows}
        />
      )
    }
    if (item.type === 'teamBuilder') {
      return <BuildTeam />
    }
    const isSelected = 'conversationIDKey' in item && selectedConversationIDKey === item.conversationIDKey
    return <>{makeRow(item, isSelected)}</>
  }

  const floatingDivider = !search.isSearching && showFloating && allowShowFloatingButton && (
    <BigTeamsDivider toggle={scrollToBigTeams} />
  )

  return (
    <Kb.ErrorBoundary>
      <Kb.Box2 direction="vertical" className="inbox-hover-container" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body}>
          {search.isSearching ? (
            <InboxSearch search={search} />
          ) : (
            <div data-testid="inbox-list" style={styles.list} ref={scrollDiv}>
              {rows.length ? (
                <Kb.List
                  items={rows}
                  itemHeight={itemHeight}
                  estimatedItemHeight={56}
                  getItemType={getItemType}
                  recycleItems={true}
                  keyExtractor={keyExtractor}
                  onViewableItemsChanged={onViewChanged}
                  viewabilityConfig={viewabilityConfig}
                  ref={listRef}
                  renderItem={renderItem}
                  drawDistance={250}
                  extraData={selectedConversationIDKey}
                />
              ) : null}
            </div>
          )}
        </Kb.Box2>
        {!search.isSearching && (floatingDivider || (rows.length === 0 && <BuildTeam />))}
        {!search.isSearching && showUnread && !showFloating && (
          <UnreadShortcut onClick={scrollToUnread} unreadCount={unreadCount} />
        )}
      </Kb.Box2>
    </Kb.ErrorBoundary>
  )
}

function Inbox(props: InboxProps) {
  return props.search ? (
    <InboxBody conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} search={props.search} />
  ) : (
    <InboxWithSearch conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      body: {
        flex: 1,
        minHeight: 0,
        width: '100%',
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          contain: 'strict',
          height: '100%',
          maxWidth: inboxWidth,
          minWidth: inboxWidth,
          position: 'relative',
        },
      }),
      dragLineWrapper: {
        position: 'relative' as const,
      },
      fakeAvatar: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.black_10,
          borderRadius: '50%',
          height: 48,
          marginLeft: 8,
          width: 48,
        },
      }),
      fakeRemovingRow: Kb.Styles.platformStyles({
        isElectron: {
          height: 56,
          position: 'relative',
          width: '100%',
        },
      }),
      fakeRow: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          height: 56,
          position: 'relative',
          width: '100%',
        },
      }),
      fakeRowContainer: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        left: 0,
        position: 'absolute',
        right: 0,
        zIndex: 9999,
      },
      fakeText: {
        height: '100%',
        padding: 8,
        paddingLeft: 16,
      },
      fakeTextBottom: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.black_10,
          borderRadius: 8,
          height: 10,
          width: '75%',
        },
      }),
      fakeTextTop: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.black_10,
          borderRadius: 8,
          height: 10,
          width: '25%',
        },
      }),
      grabber: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          backgroundColor: Kb.Styles.globalColors.black_05,
          bottom: 8,
          height: Kb.Styles.globalMargins.tiny,
          justifyContent: 'center',
          position: 'absolute',
          width: '100%',
        },
        isElectron: {
          cursor: 'row-resize',
        },
      }),
      grabberLine: {
        backgroundColor: Kb.Styles.globalColors.black_35,
        height: 1,
        marginBottom: 1,
        width: '100%',
      },
      grabberLineContainer: {
        paddingTop: 1,
        width: Kb.Styles.globalMargins.small,
      },
      list: {
        flex: 1,
        height: '100%',
        position: 'relative' as const,
        width: '100%',
      },
      spacer: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        bottom: 0,
        height: 8,
        position: 'absolute',
        width: '100%',
      },
    }) as const
)

const InboxWithProfiler = (props: InboxProps) => (
  <PerfProfiler id="Inbox">
    <Inbox {...props} />
  </PerfProfiler>
)

export default InboxWithProfiler

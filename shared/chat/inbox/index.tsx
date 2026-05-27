import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as React from 'react'
import * as RowSizes from './row/sizes'
import type * as T from '@/constants/types'
import {useChosenChannelsTeamnames} from '@/chat/conversation/manage-channels-badge'
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
import {inboxWidth, smallRowHeight, getRowHeight} from './row/sizes'
import {makeRow} from './row'
import type {InboxSearchController} from './use-inbox-search'
import {useInboxSearch} from './use-inbox-search'
import {useInboxState} from './use-inbox-state'
import {createPortal} from 'react-dom'
import SearchRow from './search-row'
import {useOpenedRowState} from './row/opened-row-state'
import {Alert} from 'react-native'

// Stub types to avoid dom lib dependency in native tsconfig
type InboxDivRef = {
  firstElementChild: InboxDivRef | null
  getBoundingClientRect: () => DOMRect
  scrollTop: number
  scrollBy: (opts: {behavior?: string; top: number}) => void
  addEventListener: (event: string, handler: (e: InboxDragEvent) => void) => void
  removeEventListener: (event: string, handler: (e: InboxDragEvent) => void) => void
}
type InboxDragEvent = {
  preventDefault: () => void
  dataTransfer?: {types: Array<string>; setData: (key: string, val: string) => void}
  clientY: number
}

// Desktop-only: DragLine + FakeRow + FakeRemovingRow

const widths = [10, 80, 2, 66]
const stableWidth = (idx: number) => 160 + -widths[idx % widths.length]!

const DesktopFakeRow = ({idx}: {idx: number}) => (
  <Kb.Box2 direction="horizontal" style={desktopStyles.fakeRow}>
    <Kb.Box2 direction="vertical" style={desktopStyles.fakeAvatar} />
    <Kb.Box2 direction="vertical" justifyContent="space-around" flex={1} style={desktopStyles.fakeText}>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([desktopStyles.fakeTextTop, {width: stableWidth(idx) / 4}])}
        alignSelf="flex-start"
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([desktopStyles.fakeTextBottom, {width: stableWidth(idx)}])}
        alignSelf="flex-start"
      />
    </Kb.Box2>
  </Kb.Box2>
)

const DesktopFakeRemovingRow = () => <Kb.Box2 direction="horizontal" style={desktopStyles.fakeRemovingRow} />

const dragKey = 'application/keybase_inbox'

const DesktopDragLine = (p: {
  rows: ReadonlyArray<RowItem>
  scrollDiv: React.RefObject<InboxDivRef | null>
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
    const onDragOver = (e: InboxDragEvent) => {
      e.preventDefault()
      if (
        scrollDiv.current &&
        (e.dataTransfer?.types.length ?? 0) > 0 &&
        e.dataTransfer?.types[0] === dragKey
      ) {
        const scrollableDiv = scrollDiv.current.firstElementChild as InboxDivRef | null
        if (scrollableDiv) {
          const dy = e.clientY - scrollDiv.current.getBoundingClientRect().top + scrollableDiv.scrollTop
          const dvt = inboxNumSmallRows * smallRowHeight - scrollableDiv.scrollTop
          throttledDragUpdate(dy, dvt)
        }
      }
    }
    const onDrop = (e: InboxDragEvent) => {
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

  const onDragStart = (e: React.DragEvent) => {
    ;(e.dataTransfer as unknown as {setData: (k: string, v: string) => void}).setData(dragKey, dragKey)
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
              desktopStyles.fakeRowContainer,
              {
                height: (expandingRows.length || removingRows.length) * smallRowHeight,
                top: overlayTop,
              },
            ])}
          >
            {expandingRows.map((_, idx) => (
              <DesktopFakeRow idx={idx} key={idx} />
            ))}
            {removingRows.map((_, idx) => (
              <DesktopFakeRemovingRow key={idx} />
            ))}
          </Kb.Box2>,
          scrollDiv.current as unknown as Element
        )
      : null

  return (
    <div style={desktopStyles.dragLineWrapper}>
      {showButton && !smallTeamsExpanded && (
        <>
          <div
            className="grabLinesContainer"
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            style={Kb.Styles.castStyleDesktop(desktopStyles.grabber)}
          >
            <Kb.Box2 className="grabLines" direction="vertical" style={desktopStyles.grabberLineContainer}>
              <Kb.Box2 direction="horizontal" style={desktopStyles.grabberLine} />
              <Kb.Box2 direction="horizontal" style={desktopStyles.grabberLine} />
              <Kb.Box2 direction="horizontal" style={desktopStyles.grabberLine} />
            </Kb.Box2>
          </div>
          <Kb.Box2 direction="vertical" style={desktopStyles.spacer} />
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

// Native-only components

const NativeNoChats = (props: {onNewChat: () => void}) => (
  <>
    <Kb.Box2
      direction="vertical"
      gapStart={true}
      gap="small"
      justifyContent="flex-end"
      style={nativeStyles.noChatsContainer}
    >
      <Kb.ImageIcon type="icon-fancy-encrypted-phone-mobile-226-96" />
      <Kb.Box2 direction="vertical">
        <Kb.Text type="BodySmall" center={true}>
          All conversations are
        </Kb.Text>
        <Kb.Text type="BodySmall" center={true}>
          end-to-end encrypted.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" gapStart={true} gap="medium" style={nativeStyles.newChat}>
      <Kb.Button
        fullWidth={true}
        onClick={props.onNewChat}
        mode="Primary"
        label="Start a new chat"
        style={nativeStyles.button}
      />
    </Kb.Box2>
  </>
)

const NativeNoRowsBuildTeam = () => {
  const isLoading = C.useWaitingState(s => [...s.counts.keys()].some(k => k.startsWith('chat:')))
  return isLoading ? null : <BuildTeam />
}

const NativeLoadingLine = () => {
  const isLoading = C.Waiting.useAnyWaiting([C.waitingKeyChatInboxRefresh, C.waitingKeyChatInboxSyncStarted])
  return isLoading ? (
    <Kb.Box2 direction="vertical" style={nativeStyles.loadingContainer}>
      <Kb.LoadingLine />
    </Kb.Box2>
  ) : null
}

// Shared types

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

// Desktop InboxBody
function DesktopInboxBody(props: ControlledInboxProps) {
  const {conversationIDKey, refreshInbox, search} = props
  const inbox = useInboxState(conversationIDKey, search.isSearching, refreshInbox)
  const {smallTeamsExpanded, rows, unreadIndices, unreadTotal, inboxNumSmallRows} = inbox
  const {toggleSmallTeamsExpanded, selectedConversationIDKey, onUntrustedInboxVisible} = inbox
  const {setInboxNumSmallRows, allowShowFloatingButton} = inbox
  const chosenChannelsTeamnames = useChosenChannelsTeamnames()
  const listExtraData = React.useMemo(
    () => ({chosenChannelsTeamnames, selectedConversationIDKey}),
    [chosenChannelsTeamnames, selectedConversationIDKey]
  )

  const scrollDiv = React.useRef<InboxDivRef | null>(null)
  const listRef = React.useRef<LegendListRef | null>(null)

  const getSize = React.useCallback(
    (item: RowItem) => getRowHeight(item.type, item.type === 'divider' && item.showButton),
    []
  )

  const {showFloating, showUnread, unreadCount, scrollToUnread, applyUnreadAndFloating} =
    useUnreadShortcut({listRef, rows, unreadIndices, unreadTotal, getSize})
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

  const itemHeight = {getSize, type: 'perItem' as const}

  const onViewChanged = (data: ViewableItemsData) => {
    applyUnreadAndFloating()
    onScrollUnbox(data)
  }

  const scrollToBigTeams = () => {
    if (!scrollDiv.current) return

    if (smallTeamsExpanded) {
      toggleSmallTeamsExpanded()
    }

    const scrollableDiv = scrollDiv.current.firstElementChild as InboxDivRef | null
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
        <DesktopDragLine
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
    return <>{makeRow(item, isSelected, chosenChannelsTeamnames)}</>
  }

  const floatingDivider = !search.isSearching && showFloating && allowShowFloatingButton && (
    <BigTeamsDivider toggle={scrollToBigTeams} />
  )

  return (
    <Kb.ErrorBoundary>
      <Kb.Box2 direction="vertical" className="inbox-hover-container" style={desktopStyles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={desktopStyles.body}>
          {search.isSearching ? (
            <InboxSearch search={search} />
          ) : (
            <div data-testid="chat-inbox-list" style={desktopStyles.list} ref={scrollDiv as React.RefObject<HTMLDivElement>}>
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
                  extraData={listExtraData}
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

// Native InboxBody
function NativeInboxBody(p: ControlledInboxProps) {
  const {search} = p
  const inbox = useInboxState(p.conversationIDKey, search.isSearching, p.refreshInbox)
  const {onUntrustedInboxVisible, toggleSmallTeamsExpanded, selectedConversationIDKey} = inbox
  const {unreadIndices, unreadTotal, rows, smallTeamsExpanded, isSearching, allowShowFloatingButton} = inbox
  const {neverLoaded, onNewChat, inboxNumSmallRows, setInboxNumSmallRows} = inbox
  const headComponent = C.isTablet ? null : <SearchRow search={search} showSearch={isMobile} />
  const chosenChannelsTeamnames = useChosenChannelsTeamnames()
  const listExtraData = React.useMemo(
    () => ({
      chosenChannelsTeamnames,
      selectedConversationIDKey: C.isTablet ? selectedConversationIDKey : undefined,
    }),
    [chosenChannelsTeamnames, selectedConversationIDKey]
  )

  const listRef = React.useRef<LegendListRef | null>(null)

  const getSize = React.useCallback((item: RowItem) => {
    switch (item.type) {
      case 'small': return RowSizes.smallRowHeight
      case 'big': return RowSizes.bigRowHeight
      case 'bigHeader': return RowSizes.bigHeaderHeight
      case 'divider': return RowSizes.dividerHeight(item.showButton)
      case 'teamBuilder': return 120
    }
  }, [])

  const {showFloating, showUnread, unreadCount, scrollToUnread, applyUnreadAndFloating} = useUnreadShortcut({
    listRef,
    rows,
    unreadIndices,
    unreadTotal,
    getSize,
  })
  const onScrollUnbox = useScrollUnbox(onUntrustedInboxVisible, 1000)

  const itemHeight = {getSize, type: 'perItem' as const}

  const renderItem = (_index: number, item: RowItem): React.ReactElement | null => {
    const row = item
    let element: React.ReactElement | null
    if (row.type === 'divider') {
      element = (
        <ConnectedTeamsDivider
          rows={rows}
          showButton={row.showButton}
          hiddenCount={row.hiddenCount}
          toggle={toggleSmallTeamsExpanded}
          smallTeamsExpanded={smallTeamsExpanded}
        />
      )
    } else if (row.type === 'teamBuilder') {
      element = <BuildTeam />
    } else {
      const isSelected = 'conversationIDKey' in row && selectedConversationIDKey === row.conversationIDKey
      element = makeRow(row, isSelected, chosenChannelsTeamnames)
    }

    return <PerfProfiler id={`InboxRow-${row.type}`}>{element}</PerfProfiler>
  }

  const onViewChanged = (data: ViewableItemsData) => {
    onScrollUnbox(data)
    applyUnreadAndFloating()
  }

  const setOpenRow = useOpenedRowState(s => s.dispatch.setOpenRow)

  C.Router2.useSafeFocusEffect(() => {
    setOpenRow(Chat.noConversationIDKey)
  })

  const promptSmallTeamsNum = React.useCallback(() => {
    if (isIOS) {
      Alert.prompt(
        'Change shown',
        'Number of conversations to show above this button',
        (ns: string) => {
          const n = parseInt(ns, 10)
          if (n > 0) {
            setInboxNumSmallRows(n)
          }
        },
        'plain-text',
        String(inboxNumSmallRows)
      )
    }
  }, [inboxNumSmallRows, setInboxNumSmallRows])

  const scrollToBigTeams = React.useCallback(() => {
    if (smallTeamsExpanded) {
      toggleSmallTeamsExpanded()
    }
    void listRef.current?.scrollToIndex({animated: true, index: inboxNumSmallRows, viewPosition: 0.5})
  }, [inboxNumSmallRows, smallTeamsExpanded, toggleSmallTeamsExpanded])

  const showFloatingDivider = showFloating && !isSearching && allowShowFloatingButton
  const showUnreadBanner = showUnread && !isSearching

  const noChats = !neverLoaded && !isSearching && !rows.length && <NativeNoChats onNewChat={onNewChat} />

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="Inbox">
        <Kb.Box2 direction="vertical" fullWidth={true} style={nativeStyles.container}>
          <NativeLoadingLine />
          {isSearching ? (
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <InboxSearch header={headComponent} search={search} />
            </Kb.Box2>
          ) : (
            <Kb.List
              testID="inboxList"
              ListHeaderComponent={headComponent}
              items={rows}
              itemHeight={itemHeight}
              estimatedItemHeight={64}
              getItemType={getItemType}
              recycleItems={true}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              onViewableItemsChanged={onViewChanged}
              viewabilityConfig={viewabilityConfig}
              ref={listRef}
              renderItem={renderItem}
              drawDistance={250}
              extraData={listExtraData}
            />
          )}
          {noChats}
          {showFloatingDivider || showUnreadBanner ? (
            <Kb.BottomAccessory>
              {showUnreadBanner && (
                <UnreadShortcut inlineLayout={true} onClick={scrollToUnread} unreadCount={unreadCount} />
              )}
              {showFloatingDivider && (
                <BigTeamsDivider
                  inlineLayout={true}
                  toggle={scrollToBigTeams}
                  onEdit={isIOS ? promptSmallTeamsNum : undefined}
                />
              )}
            </Kb.BottomAccessory>
          ) : (
            rows.length === 0 && !neverLoaded && <NativeNoRowsBuildTeam />
          )}
        </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

function InboxBody(props: ControlledInboxProps) {
  return isMobile ? <NativeInboxBody {...props} /> : <DesktopInboxBody {...props} />
}

function Inbox(props: InboxProps) {
  return props.search ? (
    <InboxBody conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} search={props.search} />
  ) : (
    <InboxWithSearch conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} />
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
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
          ...Kb.Styles.size(48),
          marginLeft: 8,
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

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      accessoryRow: {flex: 1},
      button: {width: '100%'},
      container: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          position: 'relative',
        },
        isTablet: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          maxWidth: Kb.Styles.globalStyles.mediumSubNavWidth,
        },
      }),
      loadingContainer: {
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1000,
      },
      newChat: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
        flexShrink: 0,
        width: '100%',
      },
      noChatsContainer: {
        alignItems: 'center',
        paddingBottom: Kb.Styles.globalMargins.large,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.large,
      },
    }) as const
)

const InboxWithProfiler = (props: InboxProps) => (
  <PerfProfiler id="Inbox">
    <Inbox {...props} />
  </PerfProfiler>
)

export default InboxWithProfiler

import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {PerfProfiler} from '@/perf/react-profiler'
import * as RowSizes from './row/sizes'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import SearchRow from './search-row'
import InboxSearch from '../inbox-search'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import type * as T from '@/constants/types'
import {Alert} from 'react-native'
import {LegendList, type LegendListRef, type ViewToken} from '@legendapp/list'
import {makeRow} from './row'
import {useOpenedRowState} from './row/opened-row-state'
import {useInboxState} from './use-inbox-state'
import type {ChatInboxRowItem} from './rowitem'

type RowItem = ChatInboxRowItem

const NoChats = (props: {onNewChat: () => void}) => (
  <>
    <Kb.Box2
      direction="vertical"
      gapStart={true}
      gap="small"
      justifyContent="flex-end"
      style={styles.noChatsContainer}
    >
      <Kb.Icon type="icon-fancy-encrypted-phone-mobile-226-96" />
      <Kb.Box2 direction="vertical">
        <Kb.Text type="BodySmall" center={true}>
          All conversations are
        </Kb.Text>
        <Kb.Text type="BodySmall" center={true}>
          end-to-end encrypted.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" gapStart={true} gap="medium" style={styles.newChat}>
      <Kb.Button
        fullWidth={true}
        onClick={props.onNewChat}
        mode="Primary"
        label="Start a new chat"
        style={styles.button}
      />
    </Kb.Box2>
  </>
)

const HeadComponent = <SearchRow headerContext="inbox-header" />
const viewabilityConfig = {
  minimumViewTime: 100,
  viewAreaCoveragePercentThreshold: 30,
}

function computeUnreadInfo(unreadIndices: ReadonlyMap<number, number>, lastVisibleIdx: number) {
  if (!unreadIndices.size || lastVisibleIdx < 0) {
    return {firstOffscreenIdx: -1, showUnread: false, unreadCount: 0}
  }
  let uc = 0
  let firstOffscreenIdx = 0
  unreadIndices.forEach((count, idx) => {
    if (idx > lastVisibleIdx) {
      if (firstOffscreenIdx <= 0) firstOffscreenIdx = idx
      uc += count
    }
  })
  return firstOffscreenIdx
    ? {firstOffscreenIdx, showUnread: true, unreadCount: uc}
    : {firstOffscreenIdx: -1, showUnread: false, unreadCount: 0}
}

function computeShowFloating(rows: ArrayLike<RowItem>, lastVisibleIdx: number) {
  if (lastVisibleIdx < 0) return false
  return rows[lastVisibleIdx]?.type === 'small'
}

type InboxProps = {conversationIDKey?: T.Chat.ConversationIDKey}

function Inbox(p: InboxProps) {
  const inbox = useInboxState(p.conversationIDKey)
  const [showFloating, setShowFloating] = React.useState(false)
  const [showUnread, setShowUnread] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)

  const {onUntrustedInboxVisible, toggleSmallTeamsExpanded, selectedConversationIDKey} = inbox
  const {unreadIndices, unreadTotal, rows, smallTeamsExpanded, isSearching, allowShowFloatingButton} = inbox
  const {neverLoaded, onNewChat, inboxNumSmallRows, setInboxNumSmallRows} = inbox

  // stash first offscreen index for callback
  const firstOffscreenIdxRef = React.useRef(-1)
  const lastVisibleIdxRef = React.useRef(-1)
  const listRef = React.useRef<LegendListRef | null>(null)

  const onScrollUnbox = C.useDebouncedCallback(
    (data: {viewableItems: Array<ViewToken<RowItem>>; changed: Array<ViewToken<RowItem>>}) => {
      const {viewableItems} = data
      const item = viewableItems[0]
      if (item && Object.hasOwn(item, 'index')) {
        const toUnbox = viewableItems.reduce<Array<T.Chat.ConversationIDKey>>((arr, vi) => {
          const r = vi.item
          if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
            arr.push(r.conversationIDKey)
          }
          return arr
        }, [])
        onUntrustedInboxVisible(toUnbox)
      }
    },
    1000
  )

  const getItemType = (item: RowItem) => {
    return item.type
  }

  const getFixedItemSize = (item: RowItem): number => {
    switch (item.type) {
      case 'small': return RowSizes.smallRowHeight
      case 'big': return RowSizes.bigRowHeight
      case 'bigHeader': return RowSizes.bigHeaderHeight
      case 'divider': return RowSizes.dividerHeight(item.showButton)
      case 'teamBuilder': return 120
    }
  }

  const scrollToUnread = () => {
    if (firstOffscreenIdxRef.current <= 0) {
      return
    }
    void listRef.current?.scrollToIndex({
      animated: true,
      index: firstOffscreenIdxRef.current,
      viewPosition: 0.5,
    })
  }

  const applyUnreadAndFloating = () => {
    const info = computeUnreadInfo(unreadIndices, lastVisibleIdxRef.current)
    setShowUnread(info.showUnread)
    setUnreadCount(info.unreadCount)
    firstOffscreenIdxRef.current = info.firstOffscreenIdx
    setShowFloating(computeShowFloating(rows, lastVisibleIdxRef.current))
  }

  const renderItem = ({item}: {item: RowItem}): React.ReactElement | null => {
    const row = item
    let element: React.ReactElement | null
    if (row.type === 'divider') {
      element = (
        <TeamsDivider
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
      element = makeRow(row, isSelected)
    }

    return <PerfProfiler id={`InboxRow-${row.type}`}>{element}</PerfProfiler>
  }

  const keyExtractor = (item: RowItem, idx: number) => {
    const row = item
    switch (row.type) {
      case 'divider':
      case 'teamBuilder':
        return row.type
      case 'small':
      case 'big':
        return row.conversationIDKey
      case 'bigHeader':
        return row.teamname
      default:
        return String(idx)
    }
  }

  const onViewChanged = (data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    onScrollUnbox(data)
    lastVisibleIdxRef.current = data.viewableItems.at(-1)?.index ?? -1
    applyUnreadAndFloating()
  }

  const setOpenRow = useOpenedRowState(s => s.dispatch.setOpenRow)

  C.Router2.useSafeFocusEffect(() => {
    setOpenRow(Chat.noConversationIDKey)
  })

  // Recompute unread/floating when store data changes (not during render to avoid double-renders)
  React.useEffect(() => {
    const info = computeUnreadInfo(unreadIndices, lastVisibleIdxRef.current)
    setShowUnread(info.showUnread)
    setUnreadCount(info.unreadCount)
    firstOffscreenIdxRef.current = info.firstOffscreenIdx
    setShowFloating(computeShowFloating(rows, lastVisibleIdxRef.current))
  }, [unreadIndices, unreadTotal, rows])

  const promptSmallTeamsNum = () => {
    if (C.isIOS) {
      Alert.prompt(
        'Change shown',
        'Number of conversations to show above this button',
        ns => {
          const n = parseInt(ns, 10)
          if (n > 0) {
            setInboxNumSmallRows(n)
          }
        },
        'plain-text',
        String(inboxNumSmallRows)
      )
    }
  }

  const scrollToBigTeams = () => {
    if (smallTeamsExpanded) {
      toggleSmallTeamsExpanded()
    }
    void listRef.current?.scrollToIndex({animated: true, index: inboxNumSmallRows, viewPosition: 0.5})
  }

  const noChats = !neverLoaded && !isSearching && !rows.length && <NoChats onNewChat={onNewChat} />
  const floatingDivider = showFloating && !isSearching && allowShowFloatingButton && (
    <BigTeamsDivider toggle={scrollToBigTeams} onEdit={C.isIOS ? promptSmallTeamsNum : undefined} />
  )

  return (
    <Kb.ErrorBoundary>
      <PerfProfiler id="Inbox">
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <LoadingLine />
        {isSearching ? (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <InboxSearch header={HeadComponent} />
          </Kb.Box2>
        ) : (
          <LegendList
            testID="inboxList"
            ListHeaderComponent={HeadComponent}
            data={rows}
            estimatedItemSize={64}
            getItemType={getItemType}
            getFixedItemSize={getFixedItemSize}
            recycleItems={true}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            onViewableItemsChanged={onViewChanged}
            viewabilityConfig={viewabilityConfig}
            overScrollMode="never"
            ref={listRef}
            renderItem={renderItem}
            drawDistance={250}
          />
        )}
        {noChats}
        {floatingDivider || (rows.length === 0 && !neverLoaded && <NoRowsBuildTeam />)}
        {showUnread && !isSearching && !showFloating && (
          <UnreadShortcut onClick={scrollToUnread} unreadCount={unreadCount} />
        )}
      </Kb.Box2>
      </PerfProfiler>
    </Kb.ErrorBoundary>
  )
}

const NoRowsBuildTeam = () => {
  const isLoading = C.useWaitingState(s => [...s.counts.keys()].some(k => k.startsWith('chat:')))
  return isLoading ? null : <BuildTeam />
}

const LoadingLine = () => {
  const isLoading = C.Waiting.useAnyWaiting([C.waitingKeyChatInboxRefresh, C.waitingKeyChatInboxSyncStarted])
  return isLoading ? (
    <Kb.Box2 direction="vertical" style={styles.loadingContainer}>
      <Kb.LoadingLine />
    </Kb.Box2>
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
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

export default Inbox

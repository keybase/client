import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {PerfProfiler} from '@/perf/react-profiler'
import * as RowSizes from './row/sizes'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import ConnectedTeamsDivider from './row/teams-divider-container'
import SearchRow from './search-row'
import InboxSearch from '../inbox-search'
import UnreadShortcut from './unread-shortcut'
import type * as T from '@/constants/types'
import {Alert} from 'react-native'
import type {LegendListRef} from '@/common-adapters'
import {makeRow} from './row'
import {useOpenedRowState} from './row/opened-row-state'
import type {InboxSearchController} from './use-inbox-search'
import {useInboxSearch} from './use-inbox-search'
import {useInboxState} from './use-inbox-state'
import {type RowItem, type ViewableItemsData, viewabilityConfig, getItemType, keyExtractor, useUnreadShortcut, useScrollUnbox} from './list-helpers'

const NoChats = (props: {onNewChat: () => void}) => (
  <>
    <Kb.Box2
      direction="vertical"
      gapStart={true}
      gap="small"
      justifyContent="flex-end"
      style={styles.noChatsContainer}
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

function InboxBody(p: ControlledInboxProps) {
  const {search} = p
  const inbox = useInboxState(p.conversationIDKey, search.isSearching, p.refreshInbox)
  const {onUntrustedInboxVisible, toggleSmallTeamsExpanded, selectedConversationIDKey} = inbox
  const {unreadIndices, unreadTotal, rows, smallTeamsExpanded, isSearching, allowShowFloatingButton} = inbox
  const {neverLoaded, onNewChat, inboxNumSmallRows, setInboxNumSmallRows} = inbox
  const headComponent = C.isTablet ? null : <SearchRow search={search} showSearch={C.isMobile} />

  const listRef = React.useRef<LegendListRef | null>(null)
  const {showFloating, showUnread, unreadCount, scrollToUnread, applyUnreadAndFloating} =
    useUnreadShortcut({listRef, rows, unreadIndices, unreadTotal})
  const onScrollUnbox = useScrollUnbox(onUntrustedInboxVisible, 1000)

  React.useEffect(() => {
    applyUnreadAndFloating()
  }, [applyUnreadAndFloating])

  const itemHeight = {
    getSize: (item: RowItem) => {
      switch (item.type) {
        case 'small': return RowSizes.smallRowHeight
        case 'big': return RowSizes.bigRowHeight
        case 'bigHeader': return RowSizes.bigHeaderHeight
        case 'divider': return RowSizes.dividerHeight(item.showButton)
        case 'teamBuilder': return 120
      }
    },
    type: 'perItem' as const,
  }

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
      element = makeRow(row, isSelected)
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
            extraData={C.isTablet ? selectedConversationIDKey : undefined}
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

function Inbox(props: InboxProps) {
  return props.search ? (
    <InboxBody conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} search={props.search} />
  ) : (
    <InboxWithSearch conversationIDKey={props.conversationIDKey} refreshInbox={props.refreshInbox} />
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

import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import SearchRow from './search-row'
import InboxSearch from '../inbox-search'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import type * as TInbox from './index.d'
import type * as T from '@/constants/types'
import {type ViewToken, Alert} from 'react-native'
import {FlashList, type FlashListRef} from '@shopify/flash-list'
import {makeRow} from './row'
import {useOpenedRowState} from './row/opened-row-state'
import type {ChatInboxRowItem} from './rowitem'

const NoChats = (props: {onNewChat: () => void}) => (
  <>
    <Kb.Box2 direction="vertical" gapStart={true} gap="small" style={styles.noChatsContainer}>
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

function computeUnreadState(unreadIndices: ReadonlyMap<number, number>, lastVisibleIdx: number) {
  if (!unreadIndices.size || lastVisibleIdx < 0) {
    return {firstOffscreenIdx: -1, showUnread: false, unreadCount: 0}
  }
  let uc = 0
  let firstOffscreenIdx = 0
  unreadIndices.forEach((count, idx) => {
    if (idx > lastVisibleIdx) {
      if (firstOffscreenIdx <= 0) {
        firstOffscreenIdx = idx
      }
      uc += count
    }
  })
  if (firstOffscreenIdx) {
    return {firstOffscreenIdx, showUnread: true, unreadCount: uc}
  }
  return {firstOffscreenIdx: -1, showUnread: false, unreadCount: 0}
}

function computeShowFloating(rows: ReadonlyArray<ChatInboxRowItem>, lastVisibleIdx: number) {
  if (lastVisibleIdx < 0) return undefined
  const row = rows[lastVisibleIdx]
  if (!row) return undefined
  return row.type === 'small'
}

function Inbox(p: TInbox.Props) {
  const [showFloating, setShowFloating] = React.useState(false)
  const [showUnread, setShowUnread] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)

  const {onUntrustedInboxVisible, toggleSmallTeamsExpanded, navKey, selectedConversationIDKey} = p
  const {unreadIndices, unreadTotal, rows, smallTeamsExpanded, isSearching, allowShowFloatingButton} = p
  const {neverLoaded, onNewChat, inboxNumSmallRows, setInboxNumSmallRows} = p

  // stash first offscreen index for callback
  const firstOffscreenIdxRef = React.useRef(-1)
  const lastVisibleIdxRef = React.useRef(-1)
  const listRef = React.useRef<FlashListRef<ChatInboxRowItem> | null>(null)

  const askForUnboxing = (items: Array<ChatInboxRowItem>) => {
    const toUnbox = items.reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
      if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])
    onUntrustedInboxVisible(toUnbox)
  }

  const onScrollUnbox = C.useDebouncedCallback(
    (data: {viewableItems: Array<ViewToken<ChatInboxRowItem>>; changed: Array<ViewToken<ChatInboxRowItem>>}) => {
      const {viewableItems} = data
      const item = viewableItems[0]
      if (item && Object.hasOwn(item, 'index')) {
        askForUnboxing(viewableItems.map(i => i.item))
      }
    },
    1000
  )

  const getItemType = (item: ChatInboxRowItem) => {
    return item.type
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

  const applyUnreadState = () => {
    const state = computeUnreadState(unreadIndices, lastVisibleIdxRef.current)
    setShowUnread(state.showUnread)
    setUnreadCount(state.unreadCount)
    firstOffscreenIdxRef.current = state.firstOffscreenIdx
  }

  const applyShowFloating = () => {
    const show = computeShowFloating(rows, lastVisibleIdxRef.current)
    if (show !== undefined) {
      setShowFloating(show)
    }
  }

  const renderItem = ({item}: {item: ChatInboxRowItem}): React.ReactElement | null => {
    if (item.type === 'divider') {
      return (
        <TeamsDivider
          showButton={item.showButton}
          toggle={toggleSmallTeamsExpanded}
          rows={rows}
          smallTeamsExpanded={smallTeamsExpanded}
        />
      )
    } else if (item.type === 'teamBuilder') {
      return <BuildTeam />
    } else {
      return makeRow(item, navKey, selectedConversationIDKey === item.conversationIDKey)
    }
  }

  const keyExtractor = (item: ChatInboxRowItem, idx: number) => {
    switch (item.type) {
      case 'divider':
      case 'teamBuilder':
      case 'bigTeamsLabel':
        return item.type
      case 'small':
      case 'big':
        return item.conversationIDKey
      case 'bigHeader':
        return item.teamname
      default:
        return String(idx)
    }
  }

  const onViewChangedImpl = (data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    onScrollUnbox(data)
    lastVisibleIdxRef.current = data.viewableItems.at(-1)?.index ?? -1
    applyUnreadState()
    applyShowFloating()
  }

  const onViewChangedImplRef = React.useRef(onViewChangedImpl)
  React.useEffect(() => {
    onViewChangedImplRef.current = onViewChangedImpl
  })

  // must never change
  const [onViewChanged] = React.useState(
    () => (data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
      onViewChangedImplRef.current(data)
    }
  )

  const setOpenRow = useOpenedRowState(s => s.dispatch.setOpenRow)

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      setOpenRow(Chat.noConversationIDKey)
    }, [setOpenRow])
  )

  React.useEffect(() => {
    const state = computeUnreadState(unreadIndices, lastVisibleIdxRef.current)
    setShowUnread(state.showUnread)
    setUnreadCount(state.unreadCount)
    firstOffscreenIdxRef.current = state.firstOffscreenIdx
  }, [unreadIndices, unreadTotal])

  React.useEffect(() => {
    const show = computeShowFloating(rows, lastVisibleIdxRef.current)
    if (show !== undefined) {
      setShowFloating(show)
    }
  }, [rows])

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
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <LoadingLine />
        {isSearching ? (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <InboxSearch header={HeadComponent} />
          </Kb.Box2>
        ) : (
          <FlashList
            ListHeaderComponent={HeadComponent}
            data={rows}
            getItemType={getItemType}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            onViewableItemsChanged={onViewChanged}
            viewabilityConfig={viewabilityConfig}
            overScrollMode="never"
            ref={listRef}
            renderItem={renderItem}
          />
        )}
        {noChats}
        {floatingDivider || (rows.length === 0 && !neverLoaded && <NoRowsBuildTeam />)}
        {showUnread && !isSearching && !showFloating && (
          <UnreadShortcut onClick={scrollToUnread} unreadCount={unreadCount} />
        )}
      </Kb.Box2>
    </Kb.ErrorBoundary>
  )
}

const NoRowsBuildTeam = () => {
  const isLoading = C.useWaitingState(s => [...s.counts.keys()].some(k => k.startsWith('chat:')))
  return isLoading ? null : <BuildTeam />
}

const LoadingLine = () => {
  const isLoading = C.Waiting.useAnyWaiting([
    C.waitingKeyChatInboxRefresh,
    C.waitingKeyChatInboxSyncStarted,
  ])
  return isLoading ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.loadingContainer}>
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
          backgroundColor: Kb.Styles.globalColors.fastBlank,
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
        backgroundColor: Kb.Styles.globalColors.fastBlank,
        flexShrink: 0,
        width: '100%',
      },
      noChatsContainer: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: Kb.Styles.globalMargins.large,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.large,
      },
    }) as const
)

export default Inbox

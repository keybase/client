import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as RowSizes from './row/sizes'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import SearchRow from './search-row'
import InboxSearch from '../inbox-search'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import type * as TInbox from './index.d'
import type * as T from '@/constants/types'
import {type ViewToken, Alert} from 'react-native'
import {FlatList} from 'react-native-gesture-handler'
// import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list'
import {makeRow} from './row'
import {useOpenedRowState} from './row/opened-row-state'
import type {ChatInboxRowItem} from './rowitem'

type RowItem = ChatInboxRowItem

const usingFlashList = false as boolean
const List = /*usingFlashList ? FlashList :*/ FlatList

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

const Inbox = React.memo(function Inbox(p: TInbox.Props) {
  const [showFloating, setShowFloating] = React.useState(false)
  const [showUnread, setShowUnread] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)

  const {onUntrustedInboxVisible, toggleSmallTeamsExpanded, navKey, selectedConversationIDKey} = p
  const {unreadIndices, unreadTotal, rows, smallTeamsExpanded, isSearching, allowShowFloatingButton} = p
  const {neverLoaded, onNewChat, inboxNumSmallRows, setInboxNumSmallRows} = p

  // stash first offscreen index for callback
  const firstOffscreenIdxRef = React.useRef(-1)
  const lastVisibleIdxRef = React.useRef(-1)
  const listRef = React.useRef</*FlashList<RowItem> | */ FlatList<RowItem> | null>(null)

  const onScrollUnbox = C.useDebouncedCallback(
    (data: {viewableItems: Array<ViewToken<RowItem>>; changed: Array<ViewToken<RowItem>>}) => {
      const {viewableItems} = data
      const item = viewableItems[0]
      if (item && Object.hasOwn(item, 'index')) {
        askForUnboxing(viewableItems.map(i => i.item))
      }
    },
    1000
  )

  const getItemType = React.useCallback((item: RowItem) => {
    return item.type
  }, [])

  const overrideItemLayout = React.useCallback((layout: {span?: number; size?: number}, item: RowItem) => {
    switch (item.type) {
      case 'small':
        layout.size = RowSizes.smallRowHeight
        break
      case 'bigTeamsLabel':
        layout.size = 32
        break
      case 'bigHeader':
        layout.size = RowSizes.bigHeaderHeight
        break
      case 'big':
        layout.size = RowSizes.bigRowHeight
        break
      case 'divider':
        layout.size = 68
        break
      case 'teamBuilder':
        layout.size = 120
        break
    }
  }, [])

  const scrollToUnread = React.useCallback(() => {
    if (firstOffscreenIdxRef.current <= 0) {
      return
    }
    listRef.current?.scrollToIndex({
      animated: true,
      index: firstOffscreenIdxRef.current,
      viewPosition: 0.5,
    })
  }, [])

  const askForUnboxing = React.useCallback(
    (rows: Array<RowItem>) => {
      const toUnbox = rows.reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
        if ((r.type === 'small' || r.type === 'big') && r.conversationIDKey) {
          arr.push(r.conversationIDKey)
        }
        return arr
      }, [])
      onUntrustedInboxVisible(toUnbox)
    },
    [onUntrustedInboxVisible]
  )

  const updateShowUnread = React.useCallback(() => {
    if (!unreadIndices.size || lastVisibleIdxRef.current < 0) {
      setShowUnread(false)
      return
    }

    let uc = 0
    let firstOffscreenIdx = 0
    unreadIndices.forEach((count, idx) => {
      if (idx > lastVisibleIdxRef.current) {
        if (firstOffscreenIdx <= 0) {
          firstOffscreenIdx = idx
        }
        uc += count
      }
    })
    if (firstOffscreenIdx) {
      setShowUnread(true)
      setUnreadCount(uc)
      firstOffscreenIdxRef.current = firstOffscreenIdx
    } else {
      setShowUnread(false)
      setUnreadCount(0)
      firstOffscreenIdxRef.current = -1
    }
  }, [unreadIndices])

  const updateShowFloating = React.useCallback(() => {
    if (lastVisibleIdxRef.current < 0) {
      return
    }
    let show = true
    const row = rows[lastVisibleIdxRef.current]
    if (!row) {
      return
    }

    if (row.type !== 'small') {
      show = false
    }

    if (showFloating !== show) {
      setShowFloating(show)
    }
  }, [rows, showFloating])

  const renderItem = React.useCallback(
    ({item}: {item: RowItem}): React.ReactElement | null => {
      const row = item
      let element: React.ReactElement | null
      if (row.type === 'divider') {
        element = (
          <TeamsDivider
            showButton={row.showButton}
            toggle={toggleSmallTeamsExpanded}
            rows={rows}
            smallTeamsExpanded={smallTeamsExpanded}
          />
        )
      } else if (row.type === 'teamBuilder') {
        element = <BuildTeam />
      } else {
        element = makeRow(row, navKey, selectedConversationIDKey === row.conversationIDKey)
      }

      return element
    },
    [navKey, rows, selectedConversationIDKey, smallTeamsExpanded, toggleSmallTeamsExpanded]
  )

  const keyExtractor = React.useCallback((item: RowItem, idx: number) => {
    const row = item
    switch (row.type) {
      case 'divider': // fallthrough
      case 'teamBuilder': // fallthrough
      case 'bigTeamsLabel':
        return row.type
      case 'small': // fallthrough
      case 'big':
        return row.conversationIDKey
      case 'bigHeader':
        return row.teamname
      default:
        return String(idx)
    }
  }, [])

  const onViewChangedImpl = (data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    onScrollUnbox(data)
    lastVisibleIdxRef.current = data.viewableItems.at(-1)?.index ?? -1
    updateShowUnread()
    updateShowFloating()
  }

  const onViewChangedImplRef = React.useRef(onViewChangedImpl)
  onViewChangedImplRef.current = onViewChangedImpl

  // must never change
  const onViewChanged = React.useRef((data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    onViewChangedImplRef.current(data)
  }).current

  // Help us calculate row heights and offsets quickly
  const dividerIndexRef = React.useRef(-1)
  const dividerShowButtonRef = React.useRef(false)
  const getItemLayout = React.useCallback((data: ArrayLike<RowItem> | undefined | null, index: number) => {
    // We cache the divider location so we can divide the list into small and large. We can calculate the small cause they're all
    // the same height. We iterate over the big since that list is small and we don't know the number of channels easily
    const smallHeight = RowSizes.smallRowHeight
    if (index < dividerIndexRef.current || dividerIndexRef.current === -1) {
      const offset = index ? smallHeight * index : 0
      const length = smallHeight
      return {index, length, offset}
    }

    const dividerHeight = RowSizes.dividerHeight(dividerShowButtonRef.current)
    if (index === dividerIndexRef.current) {
      const offset = smallHeight * index
      const length = dividerHeight
      return {index, length, offset}
    }

    let offset = smallHeight * dividerIndexRef.current + dividerHeight
    let i = dividerIndexRef.current + 1

    for (; i < index; ++i) {
      const h = data?.[i]?.type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
      offset += h
    }
    const length = data?.[i]?.type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
    return {index, length, offset}
  }, [])

  const setOpenRow = useOpenedRowState(s => s.dispatch.setOpenRow)

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      setOpenRow(Chat.noConversationIDKey)
    }, [setOpenRow])
  )

  const rowLength = rows.length
  const lastUnreadIndicesRef = React.useRef(unreadIndices)
  const lastUnreadTotalRef = React.useRef(unreadTotal)
  const lastRowLengthRef = React.useRef(rowLength)

  if (
    !C.shallowEqual(lastUnreadIndicesRef.current, unreadIndices) ||
    lastUnreadTotalRef.current !== unreadTotal
  ) {
    updateShowUnread()
  }

  lastUnreadTotalRef.current = unreadTotal
  lastUnreadIndicesRef.current = unreadIndices

  if (lastRowLengthRef.current !== rowLength) {
    // list has changed, floating divider is likely to change
    updateShowFloating()
  }

  lastRowLengthRef.current = rowLength

  if (!usingFlashList) {
    dividerShowButtonRef.current = false
    dividerIndexRef.current = rows.findIndex(r => {
      if (r.type === 'divider') {
        dividerShowButtonRef.current = r.showButton
        return true
      }
      return false
    })
  }

  const debugWhichList = __DEV__ ? (
    <Kb.Text type="HeaderBig" style={{backgroundColor: 'red', left: 0, position: 'absolute', top: 0}}>
      {usingFlashList ? 'FLASH' : 'old'}
    </Kb.Text>
  ) : null

  const promptSmallTeamsNum = React.useCallback(() => {
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
  }, [inboxNumSmallRows, setInboxNumSmallRows])

  const scrollToBigTeams = React.useCallback(() => {
    if (smallTeamsExpanded) {
      toggleSmallTeamsExpanded()
    }
    listRef.current?.scrollToIndex({animated: true, index: inboxNumSmallRows, viewPosition: 0.5})
  }, [smallTeamsExpanded, toggleSmallTeamsExpanded, inboxNumSmallRows])

  const noChats = !neverLoaded && !isSearching && !rows.length && <NoChats onNewChat={onNewChat} />
  const floatingDivider = showFloating && !isSearching && allowShowFloatingButton && (
    <BigTeamsDivider toggle={scrollToBigTeams} onEdit={C.isIOS ? promptSmallTeamsNum : undefined} />
  )

  return (
    <Kb.ErrorBoundary>
      <Kb.Box style={styles.container}>
        <LoadingLine />
        {isSearching ? (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <InboxSearch header={HeadComponent} />
          </Kb.Box2>
        ) : (
          <List
            // @ts-ignore flashlist props, leave for now
            disableAutoLayout={true}
            ListHeaderComponent={HeadComponent}
            data={rows}
            estimatedItemSize={64}
            getItemType={getItemType}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            onViewableItemsChanged={onViewChanged}
            viewabilityConfig={viewabilityConfig}
            overScrollMode="never"
            overrideItemLayout={overrideItemLayout}
            ref={listRef}
            removeClippedSubviews={Kb.Styles.isAndroid}
            renderItem={renderItem}
            windowSize={5 /* 21*/}
            getItemLayout={getItemLayout}
          />
        )}
        {noChats}
        {floatingDivider || (rows.length === 0 && !neverLoaded && <NoRowsBuildTeam />)}
        {showUnread && !isSearching && !showFloating && (
          <UnreadShortcut onClick={scrollToUnread} unreadCount={unreadCount} />
        )}
        {debugWhichList}
      </Kb.Box>
    </Kb.ErrorBoundary>
  )
})

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
    <Kb.Box style={styles.loadingContainer}>
      <Kb.LoadingLine />
    </Kb.Box>
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {width: '100%'},
      container: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
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

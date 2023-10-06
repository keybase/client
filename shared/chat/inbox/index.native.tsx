import * as C from '../../constants'
import * as Constants from '../../constants/chat2'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as RowSizes from './row/sizes'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import ChatInboxHeader from './header'
import InboxSearch from '../inbox-search'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import debounce from 'lodash/debounce'
import type * as TInbox from './index.d'
import type * as T from '../../constants/types'
import {type ViewToken, FlatList} from 'react-native'
// import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list'
import {makeRow} from './row'

type RowItem = T.Chat.ChatInboxRowItem

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

type State = {
  showFloating: boolean
  showUnread: boolean
  unreadCount: number
}

class Inbox extends React.PureComponent<TInbox.Props, State> {
  // used to close other rows
  private swipeCloseRef = React.createRef<() => void>()
  private listRef = React.createRef</*FlashList<RowItem> | */ FlatList<RowItem>>()
  // stash first offscreen index for callback
  private firstOffscreenIdx: number = -1
  private lastVisibleIdx: number = -1

  state = {showFloating: false, showUnread: false, unreadCount: 0}

  componentWillUnmount(): void {
    this.swipeCloseRef.current?.()
    // @ts-ignore
    this.swipeCloseRef.current = null
  }

  componentDidUpdate(prevProps: TInbox.Props) {
    if (
      !C.shallowEqual(prevProps.unreadIndices, this.props.unreadIndices) ||
      prevProps.unreadTotal !== this.props.unreadTotal
    ) {
      this.updateShowUnread()
    }
    if (this.props.rows.length !== prevProps.rows.length) {
      // list has changed, floating divider is likely to change
      this.updateShowFloating()
    }
  }

  private renderItem = ({item}: any /*ListRenderItemInfo<RowItem>*/): React.ReactElement | null => {
    const row = item
    let element: React.ReactElement | null
    if (row.type === 'divider') {
      element = (
        <TeamsDivider
          showButton={row.showButton}
          toggle={this.props.toggleSmallTeamsExpanded}
          rows={this.props.rows}
          smallTeamsExpanded={this.props.smallTeamsExpanded}
        />
      )
    } else if (row.type === 'teamBuilder') {
      element = <BuildTeam />
    } else {
      element = makeRow(row, this.props.navKey, this.swipeCloseRef)
    }

    return element
  }

  private keyExtractor = (item: RowItem, idx: number) => {
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
  }

  private askForUnboxing = (rows: Array<RowItem>) => {
    const toUnbox = rows.reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
      if (r.type === 'small' && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])
    this.props.onUntrustedInboxVisible(toUnbox)
  }

  private onViewChanged = (data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    this.onScrollUnbox(data)

    this.lastVisibleIdx = data.viewableItems.at(-1)?.index ?? -1
    this.updateShowUnread()
    this.updateShowFloating()
  }

  private updateShowUnread = () => {
    if (!this.props.unreadIndices.size || this.lastVisibleIdx < 0) {
      this.setState(s => (s.showUnread ? {showUnread: false} : null))
      return
    }

    let unreadCount = 0
    let firstOffscreenIdx = 0
    this.props.unreadIndices.forEach((count, idx) => {
      if (idx > this.lastVisibleIdx) {
        if (firstOffscreenIdx <= 0) {
          firstOffscreenIdx = idx
        }
        unreadCount += count
      }
    })
    if (firstOffscreenIdx) {
      this.setState(s => (s.showUnread ? null : {showUnread: true}))
      this.setState(() => ({unreadCount}))
      this.firstOffscreenIdx = firstOffscreenIdx
    } else {
      this.setState(s => (s.showUnread ? {showUnread: false, unreadCount: 0} : null))
      this.firstOffscreenIdx = -1
    }
  }

  private scrollToUnread = () => {
    if (this.firstOffscreenIdx <= 0) {
      return
    }
    this.listRef.current?.scrollToIndex({
      animated: true,
      index: this.firstOffscreenIdx,
      viewPosition: 0.5,
    })
  }

  private updateShowFloating = () => {
    if (this.lastVisibleIdx < 0) {
      return
    }
    let showFloating = true
    const row = this.props.rows[this.lastVisibleIdx]
    if (!row) {
      return
    }

    if (row.type !== 'small') {
      showFloating = false
    }

    if (this.state.showFloating !== showFloating) {
      this.setState({showFloating})
    }
  }

  private onScrollUnbox = debounce((data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    const {viewableItems} = data
    const item = viewableItems[0]
    if (item && Object.prototype.hasOwnProperty.call(item, 'index')) {
      this.askForUnboxing(viewableItems.map(i => i.item))
    }
  }, 1000)

  private getItemType = (item: RowItem) => {
    return item.type
  }

  private overrideItemLayout = (layout: {span?: number; size?: number}, item: RowItem) => {
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
  }
  // Help us calculate row heights and offsets quickly
  private dividerIndex: number = -1
  private dividerShowButton: boolean = false
  private getItemLayout = (data: ArrayLike<RowItem> | undefined | null, index: number) => {
    // We cache the divider location so we can divide the list into small and large. We can calculate the small cause they're all
    // the same height. We iterate over the big since that list is small and we don't know the number of channels easily
    const smallHeight = RowSizes.smallRowHeight
    if (index < this.dividerIndex || this.dividerIndex === -1) {
      const offset = index ? smallHeight * index : 0
      const length = smallHeight
      return {index, length, offset}
    }

    const dividerHeight = RowSizes.dividerHeight(this.dividerShowButton)
    if (index === this.dividerIndex) {
      const offset = smallHeight * index
      const length = dividerHeight
      return {index, length, offset}
    }

    let offset = smallHeight * this.dividerIndex + dividerHeight
    let i = this.dividerIndex + 1

    for (; i < index; ++i) {
      const h = data?.[i]?.type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
      offset += h
    }
    const length = data?.[i]?.type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
    return {index, length, offset}
  }

  private HeadComponent = (<ChatInboxHeader headerContext="inbox-header" />)

  render() {
    if (!usingFlashList) {
      this.dividerShowButton = false
      this.dividerIndex = this.props.rows.findIndex(r => {
        if (r.type === 'divider') {
          this.dividerShowButton = r.showButton
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

    const noChats = !this.props.neverLoaded && !this.props.isSearching && !this.props.rows.length && (
      <NoChats onNewChat={this.props.onNewChat} />
    )
    const floatingDivider = this.state.showFloating &&
      !this.props.isSearching &&
      this.props.allowShowFloatingButton && <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />

    return (
      <Kb.ErrorBoundary>
        <Kb.Box style={styles.container}>
          <LoadingLine />
          {this.props.isSearching ? (
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <InboxSearch header={this.HeadComponent} />
            </Kb.Box2>
          ) : (
            <List
              // @ts-ignore
              disableAutoLayout={true}
              ListHeaderComponent={this.HeadComponent}
              data={this.props.rows}
              estimatedItemSize={64}
              getItemType={this.getItemType}
              keyExtractor={this.keyExtractor}
              keyboardShouldPersistTaps="handled"
              onViewableItemsChanged={this.onViewChanged}
              overScrollMode="never"
              overrideItemLayout={this.overrideItemLayout}
              ref={this.listRef}
              removeClippedSubviews={true /*Kb.Styles.isAndroid*/}
              renderItem={this.renderItem}
              windowSize={5 /* 21*/}
              getItemLayout={this.getItemLayout}
            />
          )}
          {noChats}
          {floatingDivider ||
            (this.props.rows.length === 0 && !this.props.neverLoaded && <NoRowsBuildTeam />)}
          {this.state.showUnread && !this.props.isSearching && !this.state.showFloating && (
            <UnreadShortcut onClick={this.scrollToUnread} unreadCount={this.state.unreadCount} />
          )}
          {debugWhichList}
        </Kb.Box>
      </Kb.ErrorBoundary>
    )
  }
}

const NoRowsBuildTeam = () => {
  const isLoading = C.useWaitingState(s => [...s.counts.keys()].some(k => k.startsWith('chat:')))
  return isLoading ? null : <BuildTeam />
}

const LoadingLine = () => {
  const isLoading = C.useAnyWaiting([Constants.waitingKeyInboxRefresh, Constants.waitingKeyInboxSyncStarted])
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
      buttonBar: {
        alignItems: 'flex-end',
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
      },
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

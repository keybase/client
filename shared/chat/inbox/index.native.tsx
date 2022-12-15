import * as Kb from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../styles'
import type * as T from './index.d'
import type * as Types from '../../constants/types/chat2'
import {anyWaiting} from '../../constants/waiting'
import * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'
import BigTeamsDivider from './row/big-teams-divider'
import BuildTeam from './row/build-team'
import ChatInboxHeader from './header/container'
import InboxSearch from '../inbox-search/container'
import TeamsDivider from './row/teams-divider'
import UnreadShortcut from './unread-shortcut'
import debounce from 'lodash/debounce'
import {makeRow} from './row'
import {virtualListMarks} from '../../local-debug'
import type {ViewToken} from 'react-native'
import shallowEqual from 'shallowequal'
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list'

type RowItem = Types.ChatInboxRowItem

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

class Inbox extends React.PureComponent<T.Props, State> {
  // used to close other rows
  private swipeCloseRef = React.createRef<() => void>()
  private listRef = React.createRef<FlashList<RowItem>>()
  // stash first offscreen index for callback
  private firstOffscreenIdx: number = -1
  private lastVisibleIdx: number = -1

  state = {showFloating: false, showUnread: false, unreadCount: 0}

  componentWillUnmount(): void {
    this.swipeCloseRef.current?.()
    // @ts-ignore
    this.swipeCloseRef.current = null
  }

  componentDidUpdate(prevProps: T.Props) {
    if (
      !shallowEqual(prevProps.unreadIndices, this.props.unreadIndices) ||
      prevProps.unreadTotal !== this.props.unreadTotal
    ) {
      this.updateShowUnread()
    }
    if (this.props.rows.length !== prevProps.rows.length) {
      // list has changed, floating divider is likely to change
      this.updateShowFloating()
    }
  }

  private renderItem = ({item}: ListRenderItemInfo<RowItem>): React.ReactElement | null => {
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

    if (virtualListMarks) {
      return <Kb.Box style={{backgroundColor: 'purple', overflow: 'hidden'}}>{element}</Kb.Box>
    }

    return element
  }

  private keyExtractor = (item: RowItem) => {
    const row = item

    if (row.type === 'divider' || row.type === 'bigTeamsLabel' || row.type === 'teamBuilder') {
      return row.type
    }

    return (
      (row.type === 'small' && row.conversationIDKey) ||
      (row.type === 'bigHeader' && row.teamname) ||
      (row.type === 'big' && row.conversationIDKey) ||
      'missingkey'
    )
  }

  private askForUnboxing = (rows: Array<RowItem>) => {
    const toUnbox = rows.reduce<Array<Types.ConversationIDKey>>((arr, r) => {
      if (r.type === 'small' && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])
    this.props.onUntrustedInboxVisible(toUnbox)
  }

  private onViewChanged = (data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    if (!data) {
      return
    }
    this.onScrollUnbox(data)

    this.lastVisibleIdx = data.viewableItems[data.viewableItems.length - 1]?.index ?? -1
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

    if (!row || row.type !== 'small') {
      showFloating = false
    }

    if (this.state.showFloating !== showFloating) {
      this.setState({showFloating})
    }
  }

  private onScrollUnbox = debounce((data: {viewableItems: Array<ViewToken>; changed: Array<ViewToken>}) => {
    const {viewableItems} = data
    const item = viewableItems?.[0]
    if (item && Object.prototype.hasOwnProperty.call(item, 'index')) {
      this.askForUnboxing(viewableItems.map(i => i.item))
    }
  }, 1000)

  private getItemType = (_info: unknown, idx: number) => {
    const item = this.props.rows[idx]
    return item.type
  }

  render() {
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
              <InboxSearch header={HeadComponent} />
            </Kb.Box2>
          ) : (
            <FlashList
              estimatedItemSize={64}
              overScrollMode="never"
              ListHeaderComponent={HeadComponent}
              data={this.props.rows}
              keyExtractor={this.keyExtractor}
              getItemType={this.getItemType}
              renderItem={this.renderItem}
              ref={this.listRef}
              onViewableItemsChanged={this.onViewChanged}
              keyboardShouldPersistTaps="handled"
            />
          )}
          {noChats}
          {floatingDivider ||
            (this.props.rows.length === 0 && !this.props.neverLoaded && <NoRowsBuildTeam />)}
          {this.state.showUnread && !this.props.isSearching && !this.state.showFloating && (
            <UnreadShortcut onClick={this.scrollToUnread} unreadCount={this.state.unreadCount} />
          )}
        </Kb.Box>
      </Kb.ErrorBoundary>
    )
  }
}

const NoRowsBuildTeam = () => {
  const isLoading = Container.useSelector(state => Constants.anyChatWaitingKeys(state))
  return isLoading ? null : <BuildTeam />
}

const LoadingLine = () => {
  const isLoading = Container.useSelector(state =>
    anyWaiting(state, Constants.waitingKeyInboxRefresh, Constants.waitingKeyInboxSyncStarted)
  )
  return isLoading ? (
    <Kb.Box style={styles.loadingContainer}>
      <Kb.LoadingLine />
    </Kb.Box>
  ) : null
}
const HeadComponent = <ChatInboxHeader headerContext="inbox-header" />

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {width: '100%'},
      buttonBar: {
        alignItems: 'flex-end',
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
      },
      container: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          backgroundColor: Styles.globalColors.fastBlank,
          flexGrow: 1,
          position: 'relative',
        },
        isTablet: {
          backgroundColor: Styles.globalColors.blueGrey,
          width: Styles.globalStyles.mediumSubNavWidth,
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
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
        backgroundColor: Styles.globalColors.fastBlank,
        flexShrink: 0,
        width: '100%',
      },
      noChatsContainer: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: Styles.globalMargins.large,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.large,
      },
    } as const)
)

export default Inbox

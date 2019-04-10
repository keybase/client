// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as React from 'react'
import * as Styles from '../../styles'
import AutoSizer from 'react-virtualized-auto-sizer'
import {VariableSizeList} from 'react-window'
import {ErrorBoundary} from '../../common-adapters'
import {makeRow} from './row'
import BuildTeam from './row/build-team/container'
import ChatInboxHeader from './row/chat-inbox-header/container'
import BigTeamsDivider from './row/big-teams-divider/container'
import TeamsDivider from './row/teams-divider/container'
import {debounce} from 'lodash-es'
import UnreadShortcut from './unread-shortcut'
import {Owl} from './owl'
import NewConversation from './new-conversation/container'
import type {Props, RowItem, RowItemSmall, RowItemBig, RouteState} from './index.types'
import {virtualListMarks} from '../../local-debug'
import {inboxWidth, getRowHeight} from './row/sizes'
import {Gateway} from 'react-gateway'
import flags from '../../util/feature-flags'

type State = {
  showFloating: boolean,
  showUnread: boolean,
}

class Inbox extends React.PureComponent<Props, State> {
  state = {
    showFloating: false,
    showUnread: false,
  }

  _mounted: boolean = false
  _list: ?VariableSizeList<any>
  _clearedFilterCount: number = 0
  _selectedVisible: boolean = false

  // stuff for UnreadShortcut
  _firstOffscreenIdx: number = -1
  _lastVisibleIdx: number = -1
  _scrollDiv = React.createRef()

  componentDidUpdate(prevProps: Props) {
    let listRowsResized = false
    if (prevProps.smallTeamsExpanded !== this.props.smallTeamsExpanded) {
      listRowsResized = true
    }

    // filter / not filter
    if (!!prevProps.filter !== !!this.props.filter) {
      listRowsResized = true
    }
    if (prevProps.filter !== this.props.filter && this._list) {
      this._list.scrollTo(0)
    }

    // list changed
    if (this.props.rows.length !== prevProps.rows.length) {
      this._calculateShowFloating()
      listRowsResized = true
    }

    if (listRowsResized) {
      this._list && this._list.resetAfterIndex(0)
    }

    if (!I.is(this.props.unreadIndices, prevProps.unreadIndices)) {
      this._calculateShowUnreadShortcut()
    }

    if (this.props.filter && this.props.selectedConversationIDKey !== prevProps.selectedConversationIDKey) {
      const selectedIndex = this.props.rows.findIndex(
        // $ForceType
        r => r.conversationIDKey === this.props.selectedConversationIDKey
      )
      selectedIndex >= 0 && this._list && this._list.scrollToItem(selectedIndex)
    }
  }

  componentDidMount() {
    this._mounted = true
  }

  componentWillUnmount() {
    this._mounted = false
  }

  _itemSizeGetter = index => {
    if (this.props.filter.length) {
      return 56
    }
    const row = this.props.rows[index]
    if (!row) {
      return 0
    }

    return getRowHeight(row.type, !!this.props.filter.length, row.type === 'divider' && row.showButton)
  }

  _itemRenderer = (index, style) => {
    const row = this.props.rows[index]
    const divStyle = Styles.collapseStyles([style, virtualListMarks && styles.divider])
    if (row.type === 'divider') {
      return (
        <div style={divStyle}>
          <TeamsDivider
            key="divider"
            toggle={this.props.toggleSmallTeamsExpanded}
            showButton={row.showButton}
            rows={this.props.rows}
          />
        </div>
      )
    }

    const conversationIDKey: Types.ConversationIDKey = row.conversationIDKey || Constants.noConversationIDKey
    const teamname = row.teamname || ''
    const isHighlighted = index === 0 && !!this.props.filter && !this._selectedVisible

    // pointer events on so you can click even right after a scroll
    return (
      <div style={Styles.collapseStyles([divStyle, {pointerEvents: 'auto'}, isHighlighted && styles.hover])}>
        {makeRow({
          channelname: (row.type === 'big' && row.channelname) || '',
          conversationIDKey,
          filtered: !!this.props.filter,
          teamname,
          type: row.type,
        })}
      </div>
    )
  }

  _calculateShowUnreadShortcut = () => {
    if (!this.props.unreadIndices.size || this._lastVisibleIdx < 0) {
      this.setState(s => (s.showUnread ? {showUnread: false} : null))
      return
    }

    const firstOffscreenIdx = this.props.unreadIndices.find(idx => idx > this._lastVisibleIdx)
    if (firstOffscreenIdx) {
      this.setState(s => (s.showUnread ? null : {showUnread: true}))
      this._firstOffscreenIdx = firstOffscreenIdx
    } else {
      this.setState(s => (s.showUnread ? {showUnread: false} : null))
      this._firstOffscreenIdx = -1
    }
  }

  _calculateShowFloating = () => {
    if (this._lastVisibleIdx < 0) {
      return
    }
    let showFloating = true
    const row = this.props.rows[this._lastVisibleIdx]
    if (!row || row.type !== 'small') {
      showFloating = false
    }

    this.setState(old => (old.showFloating !== showFloating ? {showFloating} : null))
  }

  _onItemsRendered = debounce(({visibleStartIndex, visibleStopIndex}) => {
    this._lastVisibleIdx = visibleStopIndex
    if (this.props.filter.length) {
      return
    }
    this._calculateShowUnreadShortcut()
    if (this.props.clearedFilterCount > this._clearedFilterCount) {
      // just cleared out filter
      // re-rendering normal inbox for the first time
      // no new / potentially out of date rows here
      this._clearedFilterCount = this.props.clearedFilterCount
      return
    }
    const toUnbox = this.props.rows.slice(visibleStartIndex, visibleStopIndex + 1).reduce((arr, r) => {
      if (r.type === 'small' && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])

    this._calculateShowFloating()

    this.props.onUntrustedInboxVisible(toUnbox)
  }, 200)

  _scrollToUnread = () => {
    if (this._firstOffscreenIdx <= 0 || !this._scrollDiv.current) {
      return
    }
    let top = 100 // give it some space below
    for (let i = this._lastVisibleIdx; i <= this._firstOffscreenIdx; i++) {
      top += this._itemSizeGetter(i)
    }
    this._scrollDiv.current.scrollBy({behavior: 'smooth', top})
  }

  _setRef = (list: ?VariableSizeList<any>) => {
    this._list = list
  }

  _prepareNewChat = () => {
    this._list && this._list.scrollTo(0)
    this.props.onNewChat()
  }

  _onEnsureSelection = () => this.props.onEnsureSelection()
  _onSelectUp = () => this.props.onSelectUp()
  _onSelectDown = () => this.props.onSelectDown()

  render() {
    this._selectedVisible =
      !!this.props.filter &&
      !!this.props.rows.find(
        r => r.conversationIDKey && r.conversationIDKey === this.props.selectedConversationIDKey
      )
    const owl = !this.props.rows.length && !!this.props.filter && <Owl />
    const floatingDivider = this.state.showFloating && this.props.allowShowFloatingButton && (
      <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
    )
    return (
      <ErrorBoundary>
        <div style={styles.container}>
          <NewConversation />
          <div style={styles.list}>
            <AutoSizer>
              {({height, width}) => (
                <VariableSizeList
                  height={height}
                  width={width}
                  ref={this._setRef}
                  outerRef={this._scrollDiv}
                  onItemsRendered={this._onItemsRendered}
                  itemCount={this.props.rows.length}
                  itemSize={this._itemSizeGetter}
                  estimatedItemSize={56}
                >
                  {({index, style}) => this._itemRenderer(index, style)}
                </VariableSizeList>
              )}
            </AutoSizer>
          </div>
          {owl}
          {floatingDivider || <BuildTeam />}
          {this.state.showUnread && !this.state.showFloating && (
            <UnreadShortcut onClick={this._scrollToUnread} />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.blueGrey,
      contain: 'strict',
      height: '100%',
      maxWidth: inboxWidth,
      minWidth: inboxWidth,
      position: 'relative',
    },
  }),
  divider: {
    backgroundColor: 'purple',
    overflow: 'hidden',
  },
  hover: {
    backgroundColor: Styles.globalColors.blueGrey2,
  },
  list: {flex: 1},
})

export default Inbox
export type {RowItem, RowItemSmall, RowItemBig, RouteState}

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
import BigTeamsDivider from './row/big-teams-divider/container'
import TeamsDivider from './row/teams-divider/container'
import {debounce, throttle} from 'lodash-es'
import * as T from './index.types.d'
import UnreadShortcut from './unread-shortcut'
import {virtualListMarks} from '../../local-debug'
import {inboxWidth, getRowHeight} from './row/sizes'

type State = {
  showFloating: boolean
  showUnread: boolean
}

class Inbox extends React.PureComponent<T.Props, State> {
  state = {
    showFloating: false,
    showUnread: false,
  }

  _mounted: boolean = false
  _list: VariableSizeList | null = null
  _selectedVisible: boolean = false

  // stuff for UnreadShortcut
  _firstOffscreenIdx: number = -1
  _lastVisibleIdx: number = -1
  _scrollDiv = React.createRef<HTMLDivElement>()

  componentDidUpdate(prevProps: T.Props) {
    let listRowsResized = false
    if (prevProps.smallTeamsExpanded !== this.props.smallTeamsExpanded) {
      listRowsResized = true
    }

    // list changed
    if (this.props.rows.length !== prevProps.rows.length) {
      this._calculateShowFloating()
      listRowsResized = true
    }

    if (listRowsResized) {
      this._list && this._list.resetAfterIndex(0, true)
    }

    if (!I.is(this.props.unreadIndices, prevProps.unreadIndices)) {
      this._calculateShowUnreadShortcut()
    }
  }

  componentDidMount() {
    this._mounted = true
  }

  componentWillUnmount() {
    this._mounted = false
  }

  _itemSizeGetter = index => {
    const row = this.props.rows[index]
    if (!row) {
      return 0
    }

    return getRowHeight(row.type, row.type === 'divider' && row.showButton)
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
    const isHighlighted = index === 0 && !this._selectedVisible

    // pointer events on so you can click even right after a scroll
    return (
      <div style={Styles.collapseStyles([divStyle, {pointerEvents: 'auto'}, isHighlighted && styles.hover])}>
        {makeRow({
          channelname: (row.type === 'big' && row.channelname) || '',
          conversationIDKey,
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

  _calculateShowUnreadShortcutThrottled = throttle(this._calculateShowUnreadShortcut, 100)

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

  _onItemsRendered = ({visibleStartIndex, visibleStopIndex}) => {
    this._lastVisibleIdx = visibleStopIndex
    this._calculateShowUnreadShortcutThrottled()
    this._onItemsRenderedDebounced({visibleStartIndex, visibleStopIndex})
  }

  _onItemsRenderedDebounced = debounce(({visibleStartIndex, visibleStopIndex}) => {
    const toUnbox = this.props.rows
      .slice(visibleStartIndex, visibleStopIndex + 1)
      .reduce<Array<Types.ConversationIDKey>>((arr, r) => {
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

  _setRef = (list: VariableSizeList | null) => {
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
    this._selectedVisible = !!this.props.rows.find(
      r => r.conversationIDKey && r.conversationIDKey === this.props.selectedConversationIDKey
    )
    const floatingDivider = this.state.showFloating && this.props.allowShowFloatingButton && (
      <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
    )
    return (
      <ErrorBoundary>
        <div style={styles.container}>
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
          {floatingDivider || <BuildTeam />}
          {this.state.showUnread && !this.state.showFloating && (
            <UnreadShortcut onClick={this._scrollToUnread} />
          )}
        </div>
      </ErrorBoundary>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
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
  hover: {backgroundColor: Styles.globalColors.blueGreyDark},
  list: {flex: 1},
}))

export type RowItem = T.RowItem
export type RowItemSmall = T.RowItemSmall
export type RowItemBig = T.RowItemBig
export type RouteState = T.RouteState
export default Inbox

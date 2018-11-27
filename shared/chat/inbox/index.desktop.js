// @flow
import * as Types from '../../constants/types/chat2'
import * as React from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import {VariableSizeList} from 'react-window'
import {ErrorBoundary} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {makeRow} from './row'
import BuildTeam from './row/build-team/container'
import ChatInboxHeader from './row/chat-inbox-header/container'
import BigTeamsDivider from './row/big-teams-divider/container'
import TeamsDivider from './row/teams-divider/container'
import {debounce} from 'lodash-es'
import {Owl} from './owl'
import NewConversation from './new-conversation/container'
import type {Props, RowItem, RowItemSmall, RowItemBig, RouteState} from './index.types'
import {virtualListMarks} from '../../local-debug'
import {inboxWidth, getRowHeight} from './row/sizes'

type State = {
  showFloating: boolean,
}

class Inbox extends React.PureComponent<Props, State> {
  state = {
    showFloating: false,
  }

  _mounted: boolean = false
  _list: ?VariableSizeList<any>

  componentDidUpdate(prevProps: Props) {
    let listRowsResized = false
    if (prevProps.smallTeamsExpanded !== this.props.smallTeamsExpanded) {
      listRowsResized = true
    }

    // filter / not filter
    if (!!prevProps.filter !== !!this.props.filter) {
      listRowsResized = true
    }

    // list changed
    if (this.props.rows.length !== prevProps.rows.length) {
      listRowsResized = true
    }

    if (listRowsResized) {
      this._list && this._list.resetAfterIndex(0)
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

    return getRowHeight(row.type, !!this.props.filter.length, row.showButton)
  }

  _itemRenderer = (index, style) => {
    const row = this.props.rows[index]
    const divStyle = virtualListMarks ? {...style, backgroundColor: 'purple', overflow: 'hidden'} : style
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

    const conversationIDKey: Types.ConversationIDKey = row.conversationIDKey
    const teamname = row.teamname

    return (
      <div style={divStyle}>
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

  _onItemsRendered = debounce(({visibleStartIndex, visibleStopIndex}) => {
    if (this.props.filter.length) {
      return
    }
    const toUnbox = this.props.rows.slice(visibleStartIndex, visibleStopIndex + 1).reduce((arr, r) => {
      if (r.type === 'small' && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])

    let showFloating = true
    const row = this.props.rows[visibleStopIndex]
    if (!row || row.type !== 'small') {
      showFloating = false
    }

    this.setState(old => (old.showFloating !== showFloating ? {showFloating} : null))

    this.props.onUntrustedInboxVisible(toUnbox)
  }, 200)

  _setRef = (list: ?VariableSizeList<any>) => {
    this._list = list
  }

  _prepareNewChat = () => {
    this._list && this._list.scrollTo(0)
    this.props.onNewChat()
  }

  _onSelectUp = () => this.props.onSelectUp()
  _onSelectDown = () => this.props.onSelectDown()

  render() {
    const owl = !this.props.rows.length && !!this.props.filter && <Owl />
    const floatingDivider = this.state.showFloating && this.props.allowShowFloatingButton && (
      <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
    )
    return (
      <ErrorBoundary>
        <div style={_containerStyle}>
          <ChatInboxHeader
            filterFocusCount={this.props.filterFocusCount}
            focusFilter={this.props.focusFilter}
            onNewChat={this._prepareNewChat}
            onSelectUp={this._onSelectUp}
            onSelectDown={this._onSelectDown}
          />
          <NewConversation />
          <div style={_listStyle}>
            <AutoSizer>
              {({height, width}) => (
                <VariableSizeList
                  height={height}
                  width={width}
                  ref={this._setRef}
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
        </div>
      </ErrorBoundary>
    )
  }
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.blueGrey,
  contain: 'strict',
  height: '100%',
  maxWidth: inboxWidth,
  minWidth: inboxWidth,
  position: 'relative',
}

const _listStyle = {flex: 1}

export default Inbox
export type {RowItem, RowItemSmall, RowItemBig, RouteState}

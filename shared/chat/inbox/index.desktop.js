// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {ErrorBoundary} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {makeRow} from './row'
import BigTeamsDivider from './row/big-teams-divider/container'
import Divider from './row/divider/container'
import StartNewChat from './row/start-new-chat'
import ChatFilterRow from './row/chat-filter-row'
import {debounce} from 'lodash-es'
import {isDarwin} from '../../constants/platform'
import {Owl} from './owl'
import NewConversation from './new-conversation/container'
import type {Props, RowItem, RowItemSmall, RowItemBig, RouteState} from './index.types'

type State = {
  showFloating: boolean,
}

class Inbox extends PureComponent<Props, State> {
  state = {
    showFloating: false,
  }

  _mounted: boolean = true
  _list: ?ReactList

  componentDidUpdate(prevProps: Props) {
    // If we click the expand button let's try and show the floater. Kinda tricky as we decide if we're showing it
    // based on a callback the list gives us so there's a race. Let's just give it half a sec
    if (prevProps.smallTeamsExpanded !== this.props.smallTeamsExpanded) {
      setTimeout(() => {
        this._updateShowFloating()
      }, 500)
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
    switch (row.type) {
      case 'small':
        return 56
      case 'bigTeamsLabel': // fallthrough
      case 'bigHeader': // fallthrough
      case 'big': // fallthrough
        return 24
      case 'divider':
        return 16
    }
  }

  _itemRenderer = index => {
    const row = this.props.rows[index]
    if (row.type === 'divider') {
      return (
        <Divider
          key="divider"
          toggle={this.props.toggleSmallTeamsExpanded}
          showButton={row.showButton}
          smallIDsHidden={this.props.smallIDsHidden}
          style={{marginBottom: globalMargins.tiny}}
        />
      )
    }

    return makeRow({
      channelname: row.channelname,
      conversationIDKey: row.conversationIDKey,
      filtered: !!this.props.filter,
      teamname: row.teamname,
      type: row.type,
    })
  }

  _updateShowFloating = () => {
    if (!this._mounted) {
      return
    }
    let showFloating = true
    if (this._list) {
      const [, last] = this._list.getVisibleRange()
      if (typeof last === 'number') {
        const row = this.props.rows[last]

        if (!row || row.type !== 'small') {
          showFloating = false
        }
      }
    }

    this.setState(old => (old.showFloating !== showFloating ? {showFloating} : null))
  }

  _onScroll = () => {
    this._onScrollUnbox()
    this._updateShowFloating()
  }

  _onScrollUnbox = debounce(() => {
    if (!this._list) {
      return
    }

    const [first, end] = this._list.getVisibleRange()
    if (typeof first === 'number') {
      const toUnbox = this.props.rows.slice(first, end).reduce((arr, r) => {
        if (r.type === 'small' && r.conversationIDKey) {
          arr.push(r.conversationIDKey)
        }
        return arr
      }, [])

      this.props.onUntrustedInboxVisible(toUnbox)
    }
  }, 200)

  _setRef = (list: ?ReactList) => {
    this._list = list
  }

  _prepareNewChat = () => {
    this._list && this._list.scrollTo(0)
    this.props.onNewChat()
  }

  render() {
    const owl = !this.props.rows.length && !!this.props.filter && <Owl />
    const floatingDivider = this.state.showFloating &&
      this.props.showSmallTeamsExpandDivider && (
        <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
      )
    return (
      <ErrorBoundary>
        <div style={_containerStyle}>
          {this.props.showNewChat ? (
            <StartNewChat onNewChat={this._prepareNewChat} />
          ) : (
            <ChatFilterRow
              isLoading={this.props.isLoading}
              filter={this.props.filter}
              onNewChat={this._prepareNewChat}
              onSetFilter={this.props.onSetFilter}
              hotkeys={isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k']}
              onHotkey={this.props.onHotkey}
              filterFocusCount={this.props.filterFocusCount}
              onSelectUp={this.props.onSelectUp}
              onSelectDown={this.props.onSelectDown}
            />
          )}
          <NewConversation />
          <div style={_scrollableStyle} onScroll={this._onScroll}>
            <ReactList
              ref={this._setRef}
              useTranslate3d={false}
              itemRenderer={this._itemRenderer}
              length={this.props.rows.length}
              type="variable"
              itemSizeGetter={this._itemSizeGetter}
            />
          </div>
          {owl}
          {floatingDivider}
        </div>
      </ErrorBoundary>
    )
  }
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.blue5,
  borderRight: `1px solid ${globalColors.black_05}`,
  contain: 'strict',
  height: '100%',
  maxWidth: 260,
  minWidth: 260,
  position: 'relative',
}

const _scrollableStyle = {
  flex: 1,
  overflowY: 'auto',
}

export default Inbox
export type {RowItem, RowItemSmall, RowItemBig, RouteState}

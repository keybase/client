// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {ErrorBoundary, Text} from '../../common-adapters'
import RelativePopupHoc from '../../common-adapters/relative-popup-hoc.desktop'
import {globalStyles, globalColors} from '../../styles'
import {makeRow} from './row'
import FloatingDivider from './row/floating-divider/container'
import Divider from './row/divider/container'
import ChatFilterRow from './row/chat-filter-row'
import debounce from 'lodash/debounce'
import {isDarwin} from '../../constants/platform'
import {Owl} from './owl'
import NewConversation from './row/new-conversation'

import type {Props} from './'

type State = {
  showFloating: boolean,
}

class Inbox extends PureComponent<Props, State> {
  state = {
    showFloating: false,
  }

  _list: ?ReactList

  componentDidUpdate(prevProps: Props) {
    if (
      (this.props.rows !== prevProps.rows && prevProps.rows.length) ||
      this.props.smallTeamsHiddenRowCount > 0 !== prevProps.smallTeamsHiddenRowCount > 0
    ) {
      this._updateShowFloating()
    }
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
    const Popup = RelativePopupHoc(
      () => <Text type="Body">WOOOOOOOOOOOOOO</Text>,
      () => <Text type="Body">POPUPPPPPPPPPPP</Text>
    )
    if (index === 0) {
      return (
        <Popup key={'000'} open={true} position={'bottom left'} onClose={() => console.log('popup closed')} />
      )
    }
    const row = this.props.rows[index]
    if (row.type === 'divider') {
      return (
        <Divider
          key="divider"
          toggle={this.props.toggleSmallTeamsExpanded}
          smallIDsHidden={this.props.smallIDsHidden}
        />
      )
    }

    return makeRow({
      channelname: row.channelname,
      conversationIDKey: row.conversationIDKey,
      filtered: !!this.props.filter,
      isActiveRoute: true,
      teamname: row.teamname,
      type: row.type,
    })
  }

  _updateShowFloating = () => {
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

    if (this.state.showFloating !== showFloating) {
      this.setState({showFloating})
    }
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
      const toUnbox = this.props.rows.slice(first, end).filter(r => r.type === 'small' && r.conversationIDKey)
      // $FlowIssue doesn't understand that we filtered out the nulls
      this.props.onUntrustedInboxVisible(toUnbox.map(r => r.conversationIDKey))
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
    return (
      <ErrorBoundary>
        <div style={_containerStyle}>
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
          {this.props.showNewConversation && <NewConversation />}
          <div style={_scrollableStyle} onScroll={this._onScroll}>
            <ReactList
              ref={this._setRef}
              useTranslate3d={true}
              itemRenderer={this._itemRenderer}
              length={this.props.rows.length}
              type="variable"
              itemSizeGetter={this._itemSizeGetter}
            />
          </div>
          {!this.props.rows.length && !!this.props.filter && <Owl />}
          {this.state.showFloating &&
            this.props.showSmallTeamsExpandDivider &&
            <FloatingDivider toggle={this.props.toggleSmallTeamsExpanded} />}
          {/*
            // TODO when the teams tab exists
            this.props.showBuildATeam &&
              <BuildATeam />
              */}
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
  maxWidth: 240,
  minWidth: 240,
  position: 'relative',
}

const _scrollableStyle = {
  flex: 1,
  overflowY: 'auto',
  willChange: 'transform',
}

export default Inbox

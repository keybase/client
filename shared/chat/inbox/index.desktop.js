// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {Text, Icon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import Row from './row/container'
import {Divider, FloatingDivider} from './row/divider'
import ChatFilterRow from './row/chat-filter-row'
import debounce from 'lodash/debounce'

import type {Props} from './'

class NewConversation extends PureComponent<void, {}, void> {
  render() {
    return (
      <div
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          backgroundColor: globalColors.blue,
          flexShrink: 0,
          minHeight: 48,
        }}
      >
        <div
          style={{
            ...globalStyles.flexBoxRow,
            ...globalStyles.clickable,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: globalMargins.large,
              height: globalMargins.large,
              marginLeft: globalMargins.tiny,
              marginRight: globalMargins.tiny,
              padding: globalMargins.tiny,
              width: globalMargins.large,
            }}
          >
            <Icon
              type="iconfont-people"
              style={{
                color: globalColors.blue,
                fontSize: 24,
                marginLeft: 1,
                marginTop: 1,
              }}
            />
          </div>
          <Text style={{color: globalColors.white}} type="BodySemibold">New conversation</Text>
        </div>
      </div>
    )
  }
}

class Inbox extends PureComponent<void, Props, void> {
  _list: any

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.rows !== nextProps.rows && nextProps.rows.count()) {
      this._onScroll()
    }
  }

  _itemSizeGetter = index => {
    const row = this.props.rows.get(index)
    if (row.teamname) {
      return 24
    } else {
      return 56
    }
  }

  _itemRenderer = index => {
    const row = this.props.rows.get(index)
    if (row.type === 'divider') {
      return (
        <Divider
          key="divider"
          isExpanded={this.props.smallTeamsExpanded}
          isBadged={row.isBadged}
          toggle={this.props.toggleSmallTeamsExpanded}
        />
      )
    }
    const key =
      (row.type === 'small' && row.conversationIDKey) ||
      (row.type === 'bigHeader' && row.teamname) ||
      (row.type === 'big' && `${row.teamname}:${row.channelname}`)
    return (
      <Row
        conversationIDKey={row.conversationIDKey}
        key={key}
        isActiveRoute={true}
        teamname={row.teamname}
        channelname={row.channelname}
      />
    )
  }

  _onScroll = debounce(() => {
    if (!this._list) {
      return
    }

    const [first, end] = this._list.getVisibleRange()
    const row = this.props.rows.get(first)
    if (row.type === 'small') {
      this.props.onUntrustedInboxVisible(row.conversationIDKey, end - first)
    }
  }, 200)

  _setRef = list => {
    this._list = list
  }

  render() {
    return (
      <div style={containerStyle}>
        <ChatFilterRow
          isLoading={this.props.isLoading}
          filter={this.props.filter}
          onNewChat={this.props.onNewChat}
          onSetFilter={this.props.onSetFilter}
          hotkeys={['ctrl+n', 'command+n']}
          onHotkey={this.props.onNewChat}
        />
        {this.props.showNewConversation && <NewConversation />}
        <div style={scrollableStyle} onScroll={this._onScroll}>
          <ReactList
            ref={this._setRef}
            useTranslate3d={true}
            itemRenderer={this._itemRenderer}
            length={this.props.rows.count()}
            type="variable"
            itemSizeGetter={this._itemSizeGetter}
          />
        </div>
        <FloatingDivider
          toggle={this.props.toggleSmallTeamsExpanded}
          badgeCount={this.props.bigTeamsBadgeCount}
        />
      </div>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  boxShadow: `inset -1px 0 0 ${globalColors.black_05}`,
  height: '100%',
  maxWidth: 241,
  minWidth: 241,
  position: 'relative',
}

const scrollableStyle = {
  flex: 1,
  overflowY: 'auto',
  willChange: 'transform',
}

export default Inbox

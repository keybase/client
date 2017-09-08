// @flow
import React, {PureComponent} from 'react'
import ReactList from 'react-list'
import {Text, Icon, Box} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import Row from './row/container'
import {Divider, FloatingDivider, BigTeamsLabel} from './row/divider'
import ChatFilterRow from './row/chat-filter-row'
import debounce from 'lodash/debounce'

import type {Props} from './'

class NewConversation extends PureComponent<{}> {
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
              type="iconfont-chat"
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

type State = {
  showFloating: boolean,
}

class Inbox extends PureComponent<Props, State> {
  state = {
    showFloating: false,
  }

  _list: any

  componentDidUpdate(prevProps: Props) {
    if (
      (this.props.rows !== prevProps.rows && prevProps.rows.count()) ||
      this.props.smallTeamsExpanded !== prevProps.smallTeamsExpanded
    ) {
      this._updateShowFloating()
    }
  }

  _itemSizeGetter = index => {
    const row = this.props.rows.get(index)
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

    if (row.type === 'bigTeamsLabel') {
      return (
        <Box style={_bigTeamLabelStyle} key="bigTeamsLabel">
          <BigTeamsLabel isFiltered={row.isFiltered} />
        </Box>
      )
    }

    const key =
      (row.type === 'small' && row.conversationIDKey) ||
      (row.type === 'bigHeader' && row.teamname) ||
      (row.type === 'big' && `${row.teamname}:${row.channelname}`) ||
      'missingkey'
    return (
      <Row
        conversationIDKey={row.conversationIDKey}
        key={key}
        filtered={!!this.props.filter}
        isActiveRoute={true}
        teamname={row.teamname}
        channelname={row.channelname}
        type={row.type}
      />
    )
  }

  _updateShowFloating = () => {
    let showFloating = true
    if (this._list) {
      const [, last] = this._list.getVisibleRange()
      if (typeof last === 'number') {
        const row = this.props.rows.get(last)

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
      const row = this.props.rows.get(first)
      if (row && row.type === 'small') {
        this.props.onUntrustedInboxVisible(row.conversationIDKey, end - first)
      }
    }
  }, 200)

  _setRef = list => {
    this._list = list
  }

  render() {
    return (
      <div style={_containerStyle}>
        <ChatFilterRow
          isLoading={this.props.isLoading}
          filter={this.props.filter}
          onNewChat={this.props.onNewChat}
          onSetFilter={this.props.onSetFilter}
          hotkeys={['ctrl+n', 'command+n']}
          onHotkey={this.props.onNewChat}
        />
        {this.props.showNewConversation && <NewConversation />}
        <div style={_scrollableStyle} onScroll={this._onScroll}>
          <ReactList
            ref={this._setRef}
            useTranslate3d={true}
            itemRenderer={this._itemRenderer}
            length={this.props.rows.count()}
            type="variable"
            itemSizeGetter={this._itemSizeGetter}
          />
        </div>
        {this.state.showFloating &&
          this.props.showSmallTeamsExpandDivider &&
          <FloatingDivider
            toggle={this.props.toggleSmallTeamsExpanded}
            badgeCount={this.props.bigTeamsBadgeCount}
          />}
        {/*
            // TODO when the teams tab exists
            this.props.showBuildATeam &&
              <BuildATeam />
              */}
      </div>
    )
  }
}

const _containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.blue5,
  borderRight: `1px solid ${globalColors.black_05}`,
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

const _bigTeamLabelStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
  marginLeft: globalMargins.tiny,
}

export default Inbox

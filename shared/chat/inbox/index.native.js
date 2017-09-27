// @flow
import * as React from 'react'
import {
  Text,
  Icon,
  Box,
  NativeDimensions,
  NativeFlatList,
  ErrorBoundary,
} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import Row from './row/container'
import ChatFilterRow from './row/chat-filter-row'
import {Divider, FloatingDivider, BigTeamsLabel} from './row/divider'
import debounce from 'lodash/debounce'

import type {Props} from './'

const NoChats = () => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      ...globalStyles.fillAbsolute,
      alignItems: 'center',
      justifyContent: 'center',
      top: 48,
    }}
  >
    <Icon type="icon-fancy-chat-103-x-75" style={{marginBottom: globalMargins.medium}} />
    <Text type="BodySmallSemibold" backgroundMode="Terminal" style={{color: globalColors.black_40}}>
      All conversations are end-to-end encrypted.
    </Text>
  </Box>
)

type State = {
  showFloating: boolean,
}

class Inbox extends React.PureComponent<Props, State> {
  _list: any

  state = {
    showFloating: false,
  }

  _renderItem = ({item, index}) => {
    const row = item
    if (row.type === 'divider') {
      return (
        <Divider
          badgeCount={this.props.smallTeamsHiddenBadgeCount}
          key="divider"
          hiddenCount={this.props.smallTeamsHiddenRowCount}
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

    return (
      <Row
        conversationIDKey={item.conversationIDKey}
        filtered={!!this.props.filter}
        isActiveRoute={this.props.isActiveRoute}
        teamname={item.teamname}
        channelname={item.channelname}
        type={row.type}
      />
    )
  }

  _keyExtractor = (item, index) => {
    const row = item

    if (row.type === 'divider' || row.type === 'bigTeamsLabel') {
      return row.type
    }

    return (
      (row.type === 'small' && row.conversationIDKey) ||
      (row.type === 'bigHeader' && row.teamname) ||
      (row.type === 'big' && `${row.teamname}:${row.channelname}`) ||
      'missingkey'
    )
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.smallTeamsHiddenRowCount === 0 && nextProps.smallTeamsHiddenRowCount > 0) {
      this._list && this._list.scrollToOffset({animated: false, offset: 0})
    }
  }

  _askForUnboxing = (row: any, count: number) => {
    const {conversationIDKey} = row
    if (conversationIDKey) {
      this.props.onUntrustedInboxVisible(conversationIDKey, count)
    }
  }

  _onViewChanged = data => {
    this._onScrollUnbox(data)
    this._updateShowFloating(data)
  }

  _updateShowFloating = data => {
    if (!data) {
      return
    }

    let showFloating = true
    const {viewableItems} = data
    const item = viewableItems && viewableItems[viewableItems.length - 1]
    if (!item) {
      return
    }
    const row = item.item

    if (!row || row.type !== 'small') {
      showFloating = false
    }

    if (this.state.showFloating !== showFloating) {
      this.setState({showFloating})
    }
  }

  _onScrollUnbox = debounce(data => {
    if (!data) {
      return
    }
    const {viewableItems} = data
    const item = viewableItems && viewableItems[0]
    if (item && item.index) {
      this._askForUnboxing(item.item, viewableItems.length)
    }
  }, 1000)

  componentDidMount() {
    if (this.props.rows.count()) {
      this._askForUnboxing(this.props.rows.first(), 30)
    }
  }

  _maxVisible = Math.ceil(NativeDimensions.get('window').height / 64)

  _setRef = r => {
    this._list = r
  }

  // TODO maybe we can put getItemLayout back if we do a bunch of pre-calc. The offset could be figured out based on index if we're very careful
  render() {
    return (
      <ErrorBoundary>
        <Box style={boxStyle}>
          <NativeFlatList
            ListHeaderComponent={
              <ChatFilterRow
                isLoading={this.props.isLoading}
                filter={this.props.filter}
                onNewChat={this.props.onNewChat}
                onSetFilter={this.props.onSetFilter}
              />
            }
            loading={this.props.isLoading /* force loading to update */}
            data={this.props.rows.toArray()}
            isActiveRoute={this.props.isActiveRoute}
            keyExtractor={this._keyExtractor}
            renderItem={this._renderItem}
            ref={this._setRef}
            onViewableItemsChanged={this._onViewChanged}
            initialNumToRender={this._maxVisible}
            windowSize={this._maxVisible}
          />
          {!this.props.isLoading && !this.props.rows.count() && <NoChats />}
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
        </Box>
      </ErrorBoundary>
    )
  }
}

const boxStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  flex: 1,
  position: 'relative',
}

const _bigTeamLabelStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 32,
  marginLeft: globalMargins.tiny,
}

export default Inbox

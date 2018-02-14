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
import {makeRow} from './row'
import ChatFilterRow from './row/chat-filter-row'
import FloatingDivider from './row/floating-divider/container'
import Divider from './row/divider/container'
import debounce from 'lodash/debounce'
import {Owl} from './owl'

import type {Props, RowItem} from './'

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
  // Help us calculate row heights and offsets quickly
  _dividerIndex = -1

  state = {
    showFloating: false,
  }

  _renderItem = ({item, index}) => {
    const row = item
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
      teamname: row.teamname,
      type: row.type,
    })
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
    if (this.props.rows !== nextProps.rows) {
      this._dividerIndex = nextProps.rows.findIndex(r => r.type === 'divider')
    }
  }

  _askForUnboxing = (rows: Array<RowItem>) => {
    const toUnbox = rows.reduce((arr, r) => {
      if (r.type === 'small' && r.conversationIDKey) {
        arr.push(r.conversationIDKey)
      }
      return arr
    }, [])
    this.props.onUntrustedInboxVisible(toUnbox)
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
      this._askForUnboxing(viewableItems.map(i => i.item))
    }
  }, 1000)

  _maxVisible = Math.ceil(NativeDimensions.get('window').height / 64)

  _setRef = r => {
    this._list = r
  }

  _itemTypeToHeight = {
    big: globalMargins.large,
    bigHeader: globalMargins.large,
    divider: 56,
    small: globalMargins.xlarge,
  }

  _getItemLayout = (data, index) => {
    // We cache the divider location so we can divide the list into small and large. We can calculate the small cause they're all
    // the same height. We iterate over the big since that list is small and we don't know the number of channels easily
    const smallHeight = this._itemTypeToHeight['small']
    if (index < this._dividerIndex || this._dividerIndex === -1) {
      return {index, length: smallHeight, offset: index ? smallHeight * index : 0}
    }

    const dividerHeight = this._itemTypeToHeight['divider']
    if (index === this._dividerIndex) {
      return {index, length: dividerHeight, offset: smallHeight * index}
    }

    let offset = smallHeight * (this._dividerIndex - 1) + dividerHeight

    for (let i = this._dividerIndex; i < index; ++i) {
      offset += this._itemTypeToHeight[data[i].type]
    }

    return {index, length: this._itemTypeToHeight[data[index].type], offset}
  }

  render() {
    const noChats = !this.props.isLoading && !this.props.rows.length && !this.props.filter && <NoChats />
    const owl = !this.props.rows.length && !!this.props.filter && <Owl />
    const floatingDivider = this.state.showFloating &&
      this.props.showSmallTeamsExpandDivider && (
        <FloatingDivider toggle={this.props.toggleSmallTeamsExpanded} />
      )
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
            data={this.props.rows}
            keyExtractor={this._keyExtractor}
            renderItem={this._renderItem}
            ref={this._setRef}
            onViewableItemsChanged={this._onViewChanged}
            windowSize={5}
            getItemLayout={this._getItemLayout}
          />
          {noChats}
          {owl}
          {floatingDivider}
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

export default Inbox

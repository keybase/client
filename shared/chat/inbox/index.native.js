// @flow
import * as React from 'react'
import {
  Text,
  Icon,
  Box,
  NativeDimensions,
  NativeFlatList,
  ErrorBoundary,
} from '../../common-adapters/mobile.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {makeRow} from './row'
import ChatInboxHeader from './row/chat-inbox-header/container'
import BuildTeam from './row/build-team'
import BigTeamsDivider from './row/big-teams-divider/container'
import Divider from './row/divider/container'
import {debounce} from 'lodash-es'
import {Owl} from './owl'
import * as RowSizes from './row/sizes'

import type {Props, RowItem, RowItemSmall} from './index.types'

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
  _dividerIndex: number = -1
  // 2 different sizes
  _dividerShowButton: boolean = false

  state = {showFloating: false}

  _renderItem = ({item, index}) => {
    const row = item
    if (row.type === 'divider') {
      return (
        <Divider
          key="divider"
          showButton={row.showButton}
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
      (row.type === 'big' && row.conversationIDKey) ||
      'missingkey'
    )
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

  _getItemLayout = (data, index) => {
    // We cache the divider location so we can divide the list into small and large. We can calculate the small cause they're all
    // the same height. We iterate over the big since that list is small and we don't know the number of channels easily
    const smallHeight = RowSizes.smallRowHeight
    if (index < this._dividerIndex || this._dividerIndex === -1) {
      const offset = index ? smallHeight * index : 0
      const length = smallHeight
      return {index, length, offset}
    }

    const dividerHeight = RowSizes.dividerHeight(this._dividerShowButton)
    if (index === this._dividerIndex) {
      const offset = smallHeight * index
      const length = dividerHeight
      return {index, length, offset}
    }

    let offset = smallHeight * (this._dividerIndex - 1) + dividerHeight

    for (let i = this._dividerIndex; i < index; ++i) {
      const h = data[index].type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
      offset += h
    }
    const length = data[index].type === 'big' ? RowSizes.bigRowHeight : RowSizes.bigHeaderHeight
    return {index, length, offset}
  }

  render() {
    this._dividerShowButton = false
    this._dividerIndex = this.props.rows.findIndex(r => {
      if (r.type === 'divider') {
        this._dividerShowButton = r.showButton
        return true
      }
      return false
    })

    const noChats = !this.props.isLoading && !this.props.rows.length && !this.props.filter && <NoChats />
    const owl = !this.props.rows.length && !!this.props.filter && <Owl />
    const floatingDivider = this.state.showFloating &&
      this.props.showSmallTeamsExpandDivider && (
        <BigTeamsDivider toggle={this.props.toggleSmallTeamsExpanded} />
      )
    const buildTeam = this.props.showBuildATeam && <BuildTeam onBuildTeam={this.props.onBuildTeam} />
    const HeadComponent = (
      <ChatInboxHeader
        filterFocusCount={this.props.filterFocusCount}
        focusFilter={this.props.focusFilter}
        onNewChat={this.props.onNewChat}
        rows={this.props.rows}
      />
    )
    return (
      <ErrorBoundary>
        <Box style={boxStyle}>
          <NativeFlatList
            ListHeaderComponent={HeadComponent}
            data={this.props.rows}
            keyExtractor={this._keyExtractor}
            renderItem={this._renderItem}
            ref={this._setRef}
            onViewableItemsChanged={this._onViewChanged}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            getItemLayout={this._getItemLayout}
            removeClippedSubviews={true}
          />
          {noChats}
          {owl}
          {floatingDivider || buildTeam}
        </Box>
      </ErrorBoundary>
    )
  }
}

const boxStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.fastBlank,
  flex: 1,
  position: 'relative',
}

export default Inbox
export type {RowItem, RowItemSmall}

// @flow
import React, {PureComponent} from 'react'
import {Text, Icon, Box, NativeDimensions, NativeFlatList} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import Row from './row/container'
import AddNewRow from './row/add-new-row'
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

class Inbox extends PureComponent<void, Props, {rows: Array<any>}> {
  state = {rows: []}

  _renderItem = ({item, index}) => {
    return index
      ? <Row conversationIDKey={item} key={item} isActiveRoute={this.props.isActiveRoute} />
      : <AddNewRow onNewChat={this.props.onNewChat} isLoading={this.props.isLoading} />
  }

  _keyExtractor = (item, index) => item

  _setupDataSource = props => {
    this.setState({rows: [{}].concat(props.rows.toArray())})
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.rows !== nextProps.rows) {
      this._setupDataSource(nextProps)

      if (nextProps.rows.count()) {
        const conversationIDKey = nextProps.rows.get(0)
        this.props.onUntrustedInboxVisible(conversationIDKey, 20)
      }
    }
  }

  _askForUnboxing = (id: any, count: number) => {
    this.props.onUntrustedInboxVisible(id, count)
  }

  _onViewChanged = debounce(data => {
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
    this._setupDataSource(this.props)
    if (this.props.rows.count()) {
      this._askForUnboxing(this.props.rows.first(), 30)
    }
  }

  _maxVisible = Math.ceil(NativeDimensions.get('window').height / 64)

  render() {
    return (
      <Box style={boxStyle}>
        <NativeFlatList
          loading={this.props.isLoading /* force loading to update */}
          data={this.state.rows}
          isActiveRoute={this.props.isActiveRoute}
          keyExtractor={this._keyExtractor}
          renderItem={this._renderItem}
          onViewableItemsChanged={this._onViewChanged}
          getItemLayout={(data, index) => ({length: 64, offset: 64 * index, index})}
          initialNumToRender={this._maxVisible}
          windowSize={this._maxVisible}
        />
        {!this.props.isLoading && !this.props.rows.count() && <NoChats />}
      </Box>
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

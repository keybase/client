// @flow
import * as React from 'react'
import {Text, Icon, Box, NativeDimensions, NativeFlatList} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import Row from './row/container'
import ChatFilterRow from './row/chat-filter-row'
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

class Inbox extends React.PureComponent<Props, {rows: Array<any>}> {
  state = {rows: []}

  _renderItem = ({item, index}) => {
    const row = item
    if (row.type === 'divider') {
      // TEMP until the next branch
      return null
      // return (
      // <Divider
      // key="divider"
      // isExpanded={this.props.smallTeamsExpanded}
      // isBadged={row.isBadged}
      // toggle={this.props.toggleSmallTeamsExpanded}
      // />
      // )
    }

    if (row.type === 'bigTeamsLabel') {
      // TEMP until the next branch
      return null
      // return (
      // <Box style={_bigTeamLabelStyle} key="bigTeamsLabel">
      // <BigTeamsLabel isFiltered={row.isFiltered} />
      // </Box>
      // )
    }

    return index
      ? <Row
          conversationIDKey={item.conversationIDKey}
          filtered={!!this.props.filter}
          isActiveRoute={this.props.isActiveRoute}
          teamname={item.teamname}
          channelname={item.channelname}
          type={row.type}
        />
      : <ChatFilterRow
          isLoading={this.props.isLoading}
          filter={this.props.filter}
          onNewChat={this.props.onNewChat}
          onSetFilter={this.props.onSetFilter}
        />
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

  _setupDataSource = props => {
    this.setState({rows: [{}].concat(props.rows.toArray())})
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.rows !== nextProps.rows) {
      this._setupDataSource(nextProps)

      if (nextProps.rows.count()) {
        const row = nextProps.rows.get(0)
        if (row.type === 'small' && row.conversationIDKey) {
          this.props.onUntrustedInboxVisible(row.conversationIDKey, 20)
        }
      }
    }
  }

  _askForUnboxing = (row: any, count: number) => {
    const {conversationIDKey} = row
    if (conversationIDKey) {
      this.props.onUntrustedInboxVisible(conversationIDKey, count)
    }
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

  // TODO maybe we can put getItemLayout back if we do a bunch of pre-calc. The offset could be figured out based on index if we're very careful
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

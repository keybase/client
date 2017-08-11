// @flow
import React, {Component} from 'react'
import {Icon, Box, LoadingLine, Input, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {branch} from 'recompose'

let KeyHandler
if (!isMobile) {
  KeyHandler = require('../../../util/key-handler.desktop').default
}

type Props = {
  onNewChat: () => void,
  onSetFilter: (filter: string) => void,
  onJumpToChat: () => void,
  isLoading: boolean,
}

type State = {
  inEditingMode: boolean,
  filter: string,
}

class _ChatFilterRow extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      inEditingMode: false,
      filter: '',
    }
  }

  _setState = (inEditingMode, filter) => {
    this.setState({inEditingMode, filter})
    this.props.onSetFilter(filter)
  }

  _setFilter = filter => this._setState(this.state.inEditingMode, filter)

  _enterEditingMode = () => {
    this._setState(true, '')
  }

  _leaveEditingMode = () => {
    // TODO: Set filter to '', but only after the chat is selected.
    this._setState(false, this.state.filter)
  }

  render() {
    let children
    if (this.state.inEditingMode) {
      children = [
        <Icon
          key="0"
          type="iconfont-search"
          style={{color: globalColors.grey, marginLeft: 9, marginRight: 9}}
        />,
        <Input
          autoFocus={true}
          hideUnderline={true}
          key="1"
          small={true}
          value={this.state.filter}
          hintText="Jump to..."
          onChangeText={(filter: string) => this._setFilter(filter)}
          onBlur={this._leaveEditingMode}
        />,
      ]
    } else {
      children = (
        <Box style={styleFilterContainer} onClick={this._enterEditingMode}>
          <Icon type="iconfont-search" style={{color: globalColors.black_20, fontSize: 12}} />
          <Text type="Body" style={{color: globalColors.black_20, marginLeft: globalMargins.tiny}}>
            Jump to chat
          </Text>
        </Box>
      )
    }
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          position: 'relative',
        }}
      >
        {children}
        <Icon
          type="iconfont-compose"
          style={{color: globalColors.blue, marginLeft: 9, marginRight: 9}}
          onClick={this.props.onNewChat}
        />
        {this.props.isLoading &&
          <Box style={{bottom: 0, left: 0, position: 'absolute', right: 0}}>
            <LoadingLine />
          </Box>}
      </Box>
    )
  }
}

const styleFilterContainer = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  backgroundColor: globalColors.lightGrey,
  borderRadius: 19,
  flexGrow: 1,
  height: globalMargins.medium,
  justifyContent: 'center',
  width: 160,
}

const ChatFilterRow = branch(() => !isMobile, KeyHandler)(_ChatFilterRow)

export default ChatFilterRow

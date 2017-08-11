// @flow
import React, {Component} from 'react'
import {Icon, Box, LoadingLine, Input, Text} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
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

class _AddNewRow extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      inEditingMode: false,
      filter: '',
    }
  }

  _setFilter = filter => {
    this.setState({
      inEditingMode: true,
      filter,
    })
    this.props.onSetFilter(filter)
  }

  _enterEditingMode = () => {
    this.setState({
      inEditingMode: true,
      filter: '',
    })
  }

  _leaveEditingMode = () => {
    this.setState({
      inEditingMode: false,
      filter: '',
    })
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
          key="1"
          small={true}
          value={this.state.filter}
          hintText="Jump to..."
          onChangeText={this._setFilter}
          onBlur={() => this._leaveEditingMode()}
        />,
      ]
    } else {
      children = (
        <Box style={styleFilterContainer} onClick={() => this._enterEditingMode()}>
          <Icon type="iconfont-search" style={{marginLeft: 9, marginRight: 9}} />
          <Text type="Body">Jump to chat</Text>
        </Box>
      )
    }
    return (
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48, position: 'relative'}}>
        {children}
        <Icon
          type="iconfont-new"
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
  backgroundColor: globalColors.grey,
  borderRadius: 100,
  minHeight: 24,
  minWidth: 160,
}

const AddNewRow = branch(() => !isMobile, KeyHandler)(_AddNewRow)

export default AddNewRow

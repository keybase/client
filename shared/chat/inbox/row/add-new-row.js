// @flow
import React, {Component} from 'react'
import {Icon, Box, LoadingLine, Input} from '../../../common-adapters'
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
  filter: string,
}

class _AddNewRow extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      filter: '',
    }
  }

  _setFilter = filter => {
    this.setState({filter})
    this.props.onSetFilter(filter)
  }

  render() {
    return (
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48, position: 'relative'}}>
        <Icon type="iconfont-search" style={{color: globalColors.grey, marginLeft: 9, marginRight: 9}} />
        <Input small={true} value={this.state.filter} hintText="Jump to..." onChangeText={this._setFilter} />
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

const AddNewRow = branch(() => !isMobile, KeyHandler)(_AddNewRow)

export default AddNewRow

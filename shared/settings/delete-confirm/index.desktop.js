// @flow
import React, {Component} from 'react'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Box, Button, Icon, Text, Avatar} from '../../common-adapters'

import type {Props} from './index'

type State = {
  allowDeleteForever: boolean,
}

class DeleteConfirm extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {allowDeleteForever: false}
  }

  componentWillMount () {
    this.setState({allowDeleteForever: false})
  }

  componentDidMount () {
    setTimeout(() => {
      this.setState({allowDeleteForever: true})
    }, 2000)
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', justifyContent: 'center', flex: 1}}>
        <Avatar
          size={48}
          username={this.props.username}>
          <Icon type='iconfont-remove' style={iconStyle} />
        </Avatar>
        <Text type='HeaderError' style={{...globalStyles.italic, textDecoration: 'line-through'}}>{this.props.username}</Text>
        <Text type='Header' style={{marginTop: globalMargins.medium, width: 320, textAlign: 'center'}}>Are you sure you want to permanently delete your account?</Text>
        <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
          <Button
            type='Secondary'
            label='Cancel'
            onClick={this.props.onCancel} />
          <Button
            style={{margin: 0}}
            disabled={!this.state.allowDeleteForever}
            type='Danger'
            label='Yes, permanently delete it'
            onClick={this.props.onDeleteForever} />
        </Box>
      </Box>
    )
  }
}

const iconStyle = {
  color: globalColors.red,
  position: 'absolute',
  bottom: 0,
  right: -4,
  backgroundColor: globalColors.white,
  borderRadius: 16,
  border: `solid 2px ${globalColors.white}`,
  padding: '1px 0px 0px 1px',
}

export default DeleteConfirm

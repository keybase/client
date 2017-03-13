// @flow
import React, {Component} from 'react'
import {Box, Button, Icon, Input, PopupDialog, Text} from '../../../common-adapters/index'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

import type {Props} from './'

class RenderBlockConversationWarning extends Component<void, Props, State> {
  state: State

  constructor (props: Props) {
    super(props)
    this.state = {
      index: 0,
      title: props.inputs.length > 0 && props.inputs[0].title || '',
    }
  }

  _onBlock = () => {
    const {conversationIDKey} = this.props
    this.props.onBlock({conversationIDKey})
    this.props.onClose()
  }

  
  render () {
    return (
      <PopupDialog onClose={this.props.onClose}>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center', marginBottom: 80, marginLeft: 80, marginRight: 80, marginTop: 90}}>
          <Text type='Body'>Foo bar baz</Text>
          <Box style={{...globalStyles.flexBoxRow, marginTop: 100}}>
            <Button type='Secondary' onClick={this.props.onClose} label="No, don't block them"/>
            <Button type='Primary' style={{marginLeft: globalMargins.tiny}} onClick={this._onBlock} label='Yes, block them' />
          </Box>
        </Box>
      </PopupDialog>
    )
  }
}

export default RenderBlockWarningDialog

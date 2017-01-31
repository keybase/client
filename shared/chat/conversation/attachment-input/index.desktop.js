// @flow
import React, {Component} from 'react'
import {Box, Button, Icon, Input, PopupDialog} from '../../../common-adapters/index'
import {globalStyles} from '../../../styles'

import type {Props} from './'

type State = {
  title: string,
}

class RenderAttachmentInput extends Component<void, Props, State> {
  state: State

  constructor (props: Props) {
    super(props)
    this.state = {
      title: props.title || '',
    }
  }

  _onSelect = () => {
    this.props.onSelect(this.state.title)
  }

  _updateTitle = (title) => {
    this.setState({title})
  }

  render () {
    return (
      <PopupDialog onClose={this.props.onClose}>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center', marginBottom: 80, marginLeft: 80, marginRight: 80, marginTop: 90}}>
          <Icon type='icon-file-uploading-48' />
          <Input style={{marginTop: 80, width: 460}} autoFocus={true} floatingHintTextOverride='Title' value={this.state.title} onEnterKeyDown={this._onSelect} onChangeText={this._updateTitle} />
          <Box style={{...globalStyles.flexBoxRow, marginTop: 100}}>
            <Button type='Secondary' onClick={this.props.onClose} label='Cancel' />
            <Button type='Primary' onClick={this._onSelect} label='Send' />
          </Box>
        </Box>
      </PopupDialog>
    )
  }
}

export default RenderAttachmentInput

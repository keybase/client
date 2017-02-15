// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

import type {Props} from './input'

type State = {
  text: string,
}

class ConversationInput extends Component<void, Props, State> {
  _input: any;
  _fileInput: any;
  state: State;

  _setRef = r => {
    this._input = r
  }

  constructor (props: Props) {
    super(props)
    this.state = {text: this.props.defaultText}
  }

  componentDidUpdate (prevProps: Props) {
    if (!this.props.isLoading && prevProps.isLoading) {
      this.focusInput()
    }
  }

  focusInput = () => {
    this._input && this._input.focus()
  }

  getValue () {
    return this._input ? this._input.getValue() : ''
  }

  _onSubmit = () => {
    if (this.state.text) {
      this.props.onPostMessage(this.state.text)
      this.setState({text: ''})
    }
  }

  _onChangeText = text => {
    this.setState({text})
  }

  _openFilePicker = () => {
    console.log('openFilePicker')
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
          <Input
            autoFocus={true}
            small={true}
            style={styleInput}
            ref={this._setRef}
            hintText='Write a message'
            hideUnderline={true}
            onChangeText={this._onChangeText}
            onSubmitEditing={this._onSubmit}
            value={this.state.text}
            multiline={false}
          />
          <Icon onClick={this._openFilePicker} style={styleIcon} type='iconfont-attachment' />
        </Box>
      </Box>
    )
  }
}

const styleInput = {
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  marginTop: globalMargins.tiny,
}

const styleIcon = {
  paddingRight: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
}

export default ConversationInput

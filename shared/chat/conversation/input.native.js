// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../common-adapters'
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

  componentWillUnmount () {
    // TODO(mm) fix this when we figure out a solution that will store this in the route state
    // this.props.onUnmountText && this.props.onUnmountText(this.getValue())
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
            onEnterKeyDown={this._onSubmit}
            value={this.state.text}
            multiline={false}
          />
          <Box style={styleRight}>
            {!this.state.text && <Icon onClick={this._openFilePicker} type='iconfont-attachment' />}
            {!!this.state.text && <Text type='BodyBigLink' onClick={this._onSubmit}>Send</Text>}
          </Box>
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

const styleRight = {
  marginRight: globalMargins.tiny,
  marginTop: globalMargins.tiny,
}

export default ConversationInput

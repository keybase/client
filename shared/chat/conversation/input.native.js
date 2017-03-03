// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {isIOS} from '../../constants/platform'
import ImagePicker from 'react-native-image-picker'

import type {AttachmentInput} from '../../constants/chat'
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

  componentWillReceiveProps (nextProps: Props) {
    if (this.props.editingMessage !== nextProps.editingMessage) {
      console.log('ccc', nextProps.editingMessage)
      if (nextProps.editingMessage && nextProps.editingMessage.type === 'Text') {
        this.setState({text: nextProps.editingMessage.message.stringValue()})
        this.focusInput()
      }
    }
  }

  componentWillUnmount () {
    this.props.onUnmountText && this.props.onUnmountText(this.getValue())
  }

  focusInput = () => {
    this._input && this._input.focus()
  }

  getValue () {
    return this._input ? this._input.getValue() : ''
  }

  _onBlur = () => {
    if (this.props.editingMessage) {
      this.props.onShowEditor(null)
      this.setState({text: ''})
    }
  }

  _onSubmit = () => {
    if (this.state.text) {
      if (this.props.editingMessage) {
        this.props.onEditMessage(this.props.editingMessage, this.state.text)
      } else {
        this.props.onPostMessage(this.state.text)
      }
      this.setState({text: ''})
    }
  }

  _onChangeText = text => {
    this.setState({text})
  }

  _openFilePicker = () => {
    ImagePicker.showImagePicker({}, (response) => {
      const filename = isIOS ? response.uri.replace('file://', '') : response.path
      const conversationIDKey = this.props.selectedConversation
      if (conversationIDKey) {
        this.props.onSelectAttachment(({
          conversationIDKey,
          filename,
          title: response.fileName,
          type: 'Image',
        }: AttachmentInput))
      }
    })
  }

  render () {
    // Auto-growing multiline doesn't work smoothly on Android yet.
    const multilineOpts = isIOS ? {rowsMax: 3, rowsMin: 1} : {rowsMax: 2, rowsMin: 2}

    return (
      <Box style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
          <Input
            autoCorrect={true}
            autoFocus={true}
            small={true}
            style={styleInput}
            ref={this._setRef}
            hintText='Write a message'
            hideUnderline={true}
            onChangeText={this._onChangeText}
            onBlur={this._onBlur}
            value={this.state.text}
            multiline={true}
            {...multilineOpts}
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
  alignSelf: 'center',
  marginRight: globalMargins.tiny,
  marginTop: globalMargins.tiny,
}

export default ConversationInput

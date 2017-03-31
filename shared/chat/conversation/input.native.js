// @flow
/* eslint-env browser */
import ImagePicker from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Icon, Input, Text, ClickableBox} from '../../common-adapters'
import {globalMargins, globalStyles, globalColors} from '../../styles'
import {isIOS} from '../../constants/platform'

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
    ImagePicker.showImagePicker({}, response => {
      if (response.didCancel) {
        return
      }
      const filename = isIOS ? response.uri.replace('file://', '') : response.path
      const conversationIDKey = this.props.selectedConversation
      if (!response.didCancel && conversationIDKey) {
        const input: AttachmentInput = {
          conversationIDKey,
          filename,
          title: response.fileName,
          type: 'Image',
        }
        this.props.onAttach([input])
      }
    })
  }

  render () {
    // Auto-growing multiline doesn't work smoothly on Android yet.
    const multilineOpts = isIOS ? {rowsMax: 3, rowsMin: 1} : {rowsMax: 2, rowsMin: 2}

    const action = this.state.text
      ? (
        <ClickableBox feedback={false} onClick={this._onSubmit}>
          <Box style={{padding: globalMargins.small}}>
            <Text type='BodyBigLink'>{this.props.editingMessage ? 'Save' : 'Send'}</Text>
          </Box>
        </ClickableBox>
        )
      : <Icon onClick={this._openFilePicker} type='iconfont-attachment' style={{padding: globalMargins.small}} />

    return (
      <Box style={styleContainer}>
        <Input
          autoCorrect={true}
          autoFocus={false}
          hideUnderline={true}
          hintText='Write a message'
          inputStyle={styleInputText}
          multiline={true}
          onBlur={this._onBlur}
          onChangeText={this._onChangeText}
          ref={this._setRef}
          small={true}
          style={styleInput}
          value={this.state.text}
          {...multilineOpts}
        />
        {action}
      </Box>
    )
  }
}

const styleInputText = {
  ...globalStyles.fontRegular,
  fontSize: 14,
  lineHeight: 18,
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  minHeight: 48,
}

const styleInput = {
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

export default ConversationInput

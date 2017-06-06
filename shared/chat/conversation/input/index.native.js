// @flow
/* eslint-env browser */
import ImagePicker from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Icon, Input, Text, ClickableBox} from '../../../common-adapters'
import {globalMargins, globalStyles, globalColors} from '../../../styles'
import {isIOS} from '../../../constants/platform'

import type {AttachmentInput} from '../../../constants/chat'
import type {Props} from '.'

class ConversationInput extends Component<void, Props, void> {
  _waitingOnEndEditing: boolean = false

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.editingMessage !== nextProps.editingMessage) {
      if (nextProps.editingMessage && nextProps.editingMessage.type === 'Text') {
        this.props.setText(nextProps.editingMessage.message.stringValue())
        this.props.inputFocus()
      }
    }
    if (this.props.text !== nextProps.text) {
      this.props.onUpdateTyping(!!nextProps.text)
    }
  }

  _onBlur = () => {
    if (this.props.editingMessage) {
      this.props.onShowEditor(null)
      this.props.setText('')
    }
  }

  _onSubmit = () => {
    // Force autocorrect
    this._waitingOnEndEditing = true
    // We want autocorrect to work when we click send, so we just blur the input and wait for it to be done updating its value
    this.props.inputBlur()
  }

  _openFilePicker = () => {
    ImagePicker.showImagePicker({}, response => {
      if (response.didCancel) {
        return
      }
      const filename = isIOS ? response.uri.replace('file://', '') : response.path
      const conversationIDKey = this.props.selectedConversationIDKey
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
  _onEndEditing = (...args) => {
    // We only submit when it got blurred and we're waiting for submission
    if (!this._waitingOnEndEditing) {
      return
    }

    this._waitingOnEndEditing = false

    const text = this.props.text
    if (!text) {
      return
    }

    if (this.props.isLoading) {
      console.log('Ignoring chat submit while still loading')
      return
    }

    this.props.setText('')
    this.props.inputClear()
    if (this.props.editingMessage) {
      this.props.onEditMessage(this.props.editingMessage, text)
    } else {
      this.props.onPostMessage(text)
    }
  }

  render() {
    // Auto-growing multiline doesn't work smoothly on Android yet.
    const multilineOpts = isIOS ? {rowsMax: 3, rowsMin: 1} : {rowsMax: 2, rowsMin: 2}

    return (
      <Box style={styleContainer}>
        <Input
          autoCorrect={true}
          autoCapitalize="sentences"
          autoFocus={false}
          hideUnderline={true}
          hintText="Write a message"
          inputStyle={styleInputText}
          multiline={true}
          onBlur={this._onBlur}
          onChangeText={this.props.setText}
          onEndEditing={this._onEndEditing}
          ref={this.props.inputSetRef}
          small={true}
          style={styleInput}
          value={this.props.text}
          {...multilineOpts}
        />
        {this.props.typing.length > 0 && <Typing typing={this.props.typing} />}
        <Action
          text={this.props.text}
          onSubmit={this._onSubmit}
          editingMessage={this.props.editingMessage}
          openFilePicker={this._openFilePicker}
          isLoading={this.props.isLoading}
        />
      </Box>
    )
  }
}

const Typing = ({typing}) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    }}
  >
    <Icon type="icon-typing-24" style={{width: 20}} />
  </Box>
)

const Action = ({text, onSubmit, editingMessage, openFilePicker, isLoading}) =>
  text
    ? <ClickableBox feedback={false} onClick={onSubmit}>
        <Box style={styleActionText}>
          <Text type="BodyBigLink" style={{...(isLoading ? {color: globalColors.grey} : {})}}>
            {editingMessage ? 'Save' : 'Send'}
          </Text>
        </Box>
      </ClickableBox>
    : <Icon onClick={openFilePicker} type="iconfont-camera" style={styleActionButton} />

const styleActionText = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: isIOS ? 'flex-end' : 'center',
  justifyContent: 'center',
  paddingBottom: globalMargins.xtiny,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.small,
  paddingTop: globalMargins.xtiny,
}

const styleActionButton = {
  alignSelf: isIOS ? 'flex-end' : 'center',
  paddingBottom: 5,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.small,
}

const styleInputText = {
  ...globalStyles.fontRegular,
  fontSize: 15,
  lineHeight: 20,
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  ...(isIOS
    ? {
        paddingBottom: globalMargins.tiny,
        paddingTop: globalMargins.tiny,
      }
    : {
        minHeight: 48,
      }),
}

const styleInput = {
  flex: 1,
  marginLeft: globalMargins.tiny,
}

export default ConversationInput

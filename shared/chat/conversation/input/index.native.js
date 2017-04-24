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
  componentWillReceiveProps (nextProps: Props) {
    if (this.props.editingMessage !== nextProps.editingMessage) {
      if (nextProps.editingMessage && nextProps.editingMessage.type === 'Text') {
        this.props.setText(nextProps.editingMessage.message.stringValue())
        this.props.inputFocus()
      }
    }
  }

  _onBlur = () => {
    if (this.props.editingMessage) {
      this.props.onShowEditor(null)
      this.props.setText('')
    }
  }

  _onSubmit = () => {
    if (!this.props.text) {
      return
    }

    if (this.props.isLoading) {
      console.log('Ignoring chat submit while still loading')
      return
    }

    if (this.props.editingMessage) {
      this.props.onEditMessage(this.props.editingMessage, this.props.text)
    } else {
      this.props.onPostMessage(this.props.text)
    }
    this.props.setText('')
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

  render () {
    // Auto-growing multiline doesn't work smoothly on Android yet.
    const multilineOpts = isIOS ? {rowsMax: 3, rowsMin: 1} : {rowsMax: 2, rowsMin: 2}

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
          onChangeText={this.props.setText}
          ref={this.props.inputSetRef}
          small={true}
          style={styleInput}
          value={this.props.text}
          {...multilineOpts}
        />
        <Action text={this.props.text} onSubmit={this._onSubmit} editingMessage={this.props.editingMessage} openFilePicker={this._openFilePicker} isLoading={this.props.isLoading} />
      </Box>
    )
  }
}

const Action = ({text, onSubmit, editingMessage, openFilePicker, isLoading}) => (
  text ? (
    <ClickableBox feedback={false} onClick={onSubmit}>
      <Box style={{padding: globalMargins.small}}>
        <Text type='BodyBigLink' style={{...(isLoading ? {color: globalColors.grey} : {})}}>{editingMessage ? 'Save' : 'Send'}</Text>
      </Box>
    </ClickableBox>
  ) : (
    <Icon onClick={openFilePicker} type='iconfont-camera' style={{padding: globalMargins.small}} />
  )
)

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

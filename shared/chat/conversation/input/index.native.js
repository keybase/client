// @flow
/* eslint-env browser */
import {showImagePicker} from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../common-adapters'
import {globalMargins, globalStyles, globalColors} from '../../../styles'
import {isIOS} from '../../../constants/platform'

import type {AttachmentInput} from '../../../constants/chat'
import type {Props} from '.'

// TODO we don't autocorrect the last word on submit. We had a solution using blur but this also dismisses they keyboard each time
// See if there's a better workaround later

class ConversationInput extends Component<Props> {
  _setEditing(props: Props) {
    if (!props.editingMessage || props.editingMessage.type !== 'Text') {
      return
    }

    this.props.setText(props.editingMessage.message.stringValue())
    this.props.inputFocus()
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.editingMessage !== nextProps.editingMessage) {
      this._setEditing(nextProps)
    }
    if (this.props.text !== nextProps.text) {
      this.props.onUpdateTyping(!!nextProps.text)
    }
  }

  componentDidMount() {
    this._setEditing(this.props)
  }

  _onBlur = () => {
    if (this.props.editingMessage) {
      this.props.onShowEditor(null)
      this.props.setText('')
    }
  }

  _openFilePicker = () => {
    showImagePicker({}, response => {
      if (response.didCancel) {
        return
      }
      if (response.error) {
        console.error(response.error)
        throw new Error(response.error)
      }
      const filename = isIOS ? response.uri.replace('file://', '') : response.path
      const conversationIDKey = this.props.selectedConversationIDKey
      if (!response.didCancel && conversationIDKey) {
        const input: AttachmentInput = {
          conversationIDKey,
          filename: filename || '',
          title: response.fileName || '',
          type: 'Image',
        }
        this.props.onAttach([input])
      }
    })
  }

  _onSubmit = () => {
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
    ? <Box style={styleActionText}>
        <Text
          type="BodyBigLink"
          style={{...(isLoading ? {color: globalColors.grey} : {})}}
          onClick={onSubmit}
        >
          {editingMessage ? 'Save' : 'Send'}
        </Text>
      </Box>
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
  paddingBottom: 2,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

const styleInputText = {}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  flexShrink: 0,
  minHeight: 48,
  ...(isIOS
    ? {
        paddingBottom: globalMargins.tiny,
        paddingTop: globalMargins.tiny,
      }
    : {}),
}

const styleInput = {
  flex: 1,
  marginLeft: globalMargins.tiny,
}

export default ConversationInput

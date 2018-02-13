// @flow
/* eslint-env browser */
// import logger from '../../../../logger'
import {showImagePicker} from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../../common-adapters'
import {globalMargins, globalStyles, globalColors} from '../../../../styles'
import {isIOS} from '../../../../constants/platform'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'

import type {Props} from '.'

let CustomTextInput

// NEVER load this on ios, it kills it
if (!isIOS) {
  CustomTextInput = require('../../../../common-adapters/custom-input.native')
}

// TODO we don't autocorrect the last word on submit. We had a solution using blur but this also dismisses they keyboard each time
// See if there's a better workaround later

class ConversationInput extends Component<Props> {
  // _setEditing(props: Props) {
  // if (!props.editingMessage || props.editingMessage.type !== 'Text') {
  // return
  // }

  // this.props.setText(props.editingMessage.message.stringValue())
  // this.props.inputFocus()
  // }

  // componentWillReceiveProps(nextProps: Props) {
  // if (this.props.editingMessage !== nextProps.editingMessage) {
  // this._setEditing(nextProps)
  // }
  // if (this.props.text !== nextProps.text) {
  // this.props.onUpdateTyping(!!nextProps.text)
  // }
  // }

  // componentDidMount() {
  // this._setEditing(this.props)
  // }

  // _onBlur = () => {
  // this.props.onBlur && this.props.onBlur()
  // if (this.props.isEditing) {
  // // this.props.onShowEditor(null)
  // this.props.setText('')
  // }
  // }

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
      if (!response.didCancel && this.props.conversationIDKey) {
        this.props.onAttach([filename])
      }
    })
  }

  _onSubmit = () => {
    this.props.onSubmit(this.props.text)
  }

  render() {
    // Auto-growing multiline doesn't work smoothly on Android yet.
    const multilineOpts = isIOS ? {rowsMax: 3, rowsMin: 1} : {rowsMax: 2, rowsMin: 2}

    return (
      <Box>
        {this.props.mentionPopupOpen && (
          <MentionHud
            conversationIDKey={this.props.conversationIDKey}
            selectDownCounter={this.props.downArrowCounter}
            selectUpCounter={this.props.upArrowCounter}
            pickSelectedUserCounter={this.props.pickSelectedCounter}
            onPickUser={this.props.insertMention}
            onSelectUser={this.props.insertMention}
            filter={this.props.mentionFilter}
          />
        )}
        {this.props.channelMentionPopupOpen && (
          <ChannelMentionHud
            conversationIDKey={this.props.conversationIDKey}
            selectDownCounter={this.props.downArrowCounter}
            selectUpCounter={this.props.upArrowCounter}
            pickSelectedChannelCounter={this.props.pickSelectedCounter}
            onPickChannel={this.props.insertChannelMention}
            onSelectChannel={this.props.insertChannelMention}
            filter={this.props.channelMentionFilter}
          />
        )}
        <Box style={styleContainer}>
          {isIOS ? (
            <Input
              autoCorrect={true}
              autoCapitalize="sentences"
              autoFocus={false}
              hideUnderline={true}
              hintText="Write a message"
              inputStyle={styleInputText}
              multiline={true}
              onFocus={this.props.onFocus}
              onChangeText={this.props.onChangeText}
              ref={this.props.inputSetRef}
              onSelectionChange={this.props.onSelectionChange}
              small={true}
              style={styleInput}
              value={this.props.text}
              {...multilineOpts}
            />
          ) : (
            <CustomTextInput
              autoCorrect={true}
              autoCapitalize="sentences"
              autoFocus={false}
              autoGrow={true}
              style={styleInput}
              onChangeText={this.props.onChangeText}
              onFocus={this.props.onFocus}
              onSelectionChange={this.props.onSelectionChange}
              placeholder="Write a message"
              underlineColorAndroid={globalColors.transparent}
              multiline={true}
              maxHeight={80}
              numberOfLines={1}
              minHeight={40}
              defaultValue={this.props.text || undefined}
              ref={this.props.inputSetRef}
              blurOnSubmit={false}
            />
          )}
          {this.props.typing.size > 0 && <Typing />}
          <Action
            text={this.props.text}
            onSubmit={this._onSubmit}
            isEditing={this.props.isEditing}
            openFilePicker={this._openFilePicker}
            isLoading={this.props.isLoading}
            insertMentionMarker={this.props.insertMentionMarker}
          />
        </Box>
      </Box>
    )
  }
}

const InputAccessory = Component => props => (
  <Box style={{position: 'relative', width: '100%'}}>
    <Box
      style={{
        bottom: 1,
        display: 'flex',
        left: 0,
        position: 'absolute',
        right: 0,
      }}
    >
      <Component {...props} />
    </Box>
  </Box>
)

const MentionHud = InputAccessory(props => (
  <ConnectedMentionHud style={styleMentionHud} {...props} conversationIDKey={props.conversationIDKey} />
))

const ChannelMentionHud = InputAccessory(props => (
  <ConnectedChannelMentionHud style={styleMentionHud} {...props} />
))

const styleMentionHud = {
  borderColor: globalColors.black_20,
  borderTopWidth: 1,
  height: 160,
  flex: 1,
  width: '100%',
}

const Typing = () => (
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

const Action = ({text, onSubmit, isEditing, openFilePicker, insertMentionMarker, isLoading}) =>
  text ? (
    <Box style={styleActionText}>
      <Text type="BodyBigLink" style={isLoading ? {color: globalColors.grey} : null} onClick={onSubmit}>
        {isEditing ? 'Save' : 'Send'}
      </Text>
    </Box>
  ) : (
    <Box style={styleActionButtonContainer}>
      <Icon onClick={insertMentionMarker} type="iconfont-mention" style={mentionMarkerStyle} />
      <Icon onClick={openFilePicker} type="iconfont-camera" style={styleActionButton} />
    </Box>
  )

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
  fontSize: 21,
  paddingBottom: 2,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

const mentionMarkerStyle = {...styleActionButton, paddingRight: 0}

const styleActionButtonContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
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
  ...(isIOS ? {} : {marginTop: -8, marginBottom: -8}),
}

export default ConversationInput

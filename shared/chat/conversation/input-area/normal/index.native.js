// @flow
/* eslint-env browser */
// import logger from '../../../../logger'
import {showImagePicker} from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../../common-adapters'
import {globalMargins, globalStyles, globalColors, styleSheetCreate} from '../../../../styles'
import {isIOS} from '../../../../constants/platform'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'

import type {Props} from '.'

let CustomTextInput

// NEVER load this on ios, it kills it
if (!isIOS) {
  CustomTextInput = require('../../../../common-adapters/custom-input.native')
}

class ConversationInput extends Component<Props> {
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
        <Box style={styles.container}>
          {isIOS ? (
            <Input
              autoCorrect={true}
              autoCapitalize="sentences"
              autoFocus={false}
              hideUnderline={true}
              hintText="Write a message"
              multiline={true}
              onFocus={this.props.onFocus}
              onChangeText={this.props.onChangeText}
              ref={this.props.inputSetRef}
              onSelectionChange={this.props.onSelectionChange}
              small={true}
              style={styles.input}
              value={this.props.text}
              {...multilineOpts}
            />
          ) : (
            <CustomTextInput
              autoCorrect={true}
              autoCapitalize="sentences"
              autoFocus={false}
              autoGrow={true}
              style={styles.input}
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
  <Box style={styles.accessoryContainer}>
    <Box style={styles.accessory}>
      <Component {...props} />
    </Box>
  </Box>
)

const MentionHud = InputAccessory(props => (
  <ConnectedMentionHud style={styles.mentionHud} {...props} conversationIDKey={props.conversationIDKey} />
))

const ChannelMentionHud = InputAccessory(props => (
  <ConnectedChannelMentionHud style={styles.mentionHud} {...props} />
))

const Typing = () => (
  <Box style={styles.typing}>
    <Icon type="icon-typing-24" style={styles.typingIcon} />
  </Box>
)

const Action = ({text, onSubmit, isEditing, openFilePicker, insertMentionMarker, isLoading}) =>
  text ? (
    <Box style={styles.actionText}>
      <Text type="BodyBigLink" style={isLoading ? styles.actionLoading : null} onClick={onSubmit}>
        {isEditing ? 'Save' : 'Send'}
      </Text>
    </Box>
  ) : (
    <Box style={styles.actionButtonContainer}>
      <Icon
        onClick={insertMentionMarker}
        type="iconfont-mention"
        style={styles.mentionMarkerStyle}
        iconStyle={styles.actionButtonIcon}
      />
      <Icon
        onClick={openFilePicker}
        type="iconfont-camera"
        style={styles.actionButton}
        iconStyle={styles.actionButtonIcon}
      />
    </Box>
  )

const actionButton = {
  alignSelf: isIOS ? 'flex-end' : 'center',
  paddingBottom: 2,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

const styles = styleSheetCreate({
  accessory: {
    bottom: 1,
    display: 'flex',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  accessoryContainer: {
    position: 'relative',
    width: '100%',
  },
  actionButton,
  actionButtonContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  actionButtonIcon: {
    fontSize: 21,
  },
  actionLoading: {
    color: globalColors.grey,
  },
  actionText: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: isIOS ? 'flex-end' : 'center',
    justifyContent: 'center',
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.small,
    paddingTop: globalMargins.xtiny,
  },
  container: {
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
  },
  input: {
    flex: 1,
    marginLeft: globalMargins.tiny,
    ...(isIOS ? {} : {marginBottom: -8, marginTop: -8}),
  },
  mentionHud: {
    borderColor: globalColors.black_20,
    borderTopWidth: 1,
    flex: 1,
    height: 160,
    width: '100%',
  },
  mentionMarkerStyle: {...actionButton, paddingRight: 0},
  typing: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  typingIcon: {
    width: 20,
  },
})

export default ConversationInput

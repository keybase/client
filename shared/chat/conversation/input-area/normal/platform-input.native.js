// @flow
/* eslint-env browser */
import {showImagePicker} from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Box2, Icon, Input, Text} from '../../../../common-adapters'
import {globalMargins, globalStyles, globalColors, styleSheetCreate} from '../../../../styles'
import {isIOS} from '../../../../constants/platform'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'

import type {PlatformInputProps} from './types'

type State = {
  hasText: boolean,
}

class PlatformInput extends Component<PlatformInputProps, State> {
  _input: ?Input

  constructor(props: PlatformInputProps) {
    super(props)
    this.state = {
      hasText: false,
    }
  }

  _inputSetRef = (ref: ?Input) => {
    this._input = ref
    this.props.inputSetRef(ref)
  }

  _openFilePicker = () => {
    showImagePicker({mediaType: 'photo'}, response => {
      if (response.didCancel || !this.props.conversationIDKey) {
        return
      }
      if (response.error) {
        console.error(response.error)
        throw new Error(response.error)
      }
      const filename = isIOS ? response.uri.replace('file://', '') : response.path
      this.props.onAttach([filename])
    })
  }

  _getText = () => {
    return this._input ? this._input.getValue() : ''
  }

  _onChangeText = (text: string) => {
    this.setState({hasText: !!text})
    this.props.onChangeText(text)
  }

  _onSubmit = () => {
    const text = this._getText()
    if (text) {
      this.props.onSubmit(text)
    }
  }

  render = () => {
    const multilineOpts = {rowsMax: 3, rowsMin: 1}

    let hintText = 'Write a message'
    if (this.props.isEditing) {
      hintText = 'Edit your message'
    } else if (this.props.pendingWaiting) {
      hintText = 'Creating conversation...'
    }

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
          {this.props.isEditing && (
            // TODO: Make this box take up the full height.
            <Box style={styles.editingTabStyle}>
              <Text type="BodySmall">Editing:</Text>
              <Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing}>
                Cancel
              </Text>
            </Box>
          )}
          <Input
            autoCorrect={true}
            autoCapitalize="sentences"
            autoFocus={false}
            editable={!this.props.pendingWaiting}
            hideUnderline={true}
            hintText={hintText}
            multiline={true}
            onBlur={this.props.onBlur}
            onFocus={this.props.onFocus}
            // TODO: Call onCancelQuoting on text change or selection
            // change to match desktop.
            onChangeText={this._onChangeText}
            ref={this._inputSetRef}
            small={true}
            style={styles.input}
            uncontrolled={true}
            {...multilineOpts}
          />

          {this.props.typing.size > 0 && <Typing />}
          <Action
            hasText={this.state.hasText}
            onSubmit={this._onSubmit}
            isEditing={this.props.isEditing}
            pendingWaiting={this.props.pendingWaiting}
            openFilePicker={this._openFilePicker}
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

const Action = ({hasText, onSubmit, isEditing, pendingWaiting, openFilePicker, insertMentionMarker}) =>
  hasText ? (
    <Box style={styles.actionText}>
      <Text type="BodyBigLink" onClick={onSubmit}>
        {isEditing ? 'Save' : 'Send'}
      </Text>
    </Box>
  ) : (
    <Box2 direction="horizontal" gap="tiny" gapEnd={true}>
      <Icon
        onClick={pendingWaiting ? undefined : insertMentionMarker}
        type="iconfont-mention"
        style={styles.actionButton}
        fontSize={21}
      />
      <Icon
        onClick={pendingWaiting ? undefined : openFilePicker}
        type="iconfont-camera"
        style={styles.actionButton}
        fontSize={21}
      />
    </Box2>
  )

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
  actionButton: {
    alignSelf: isIOS ? 'flex-end' : 'center',
    paddingBottom: 2,
  },
  actionText: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-end',
    backgroundColor: globalColors.fastBlank,
    borderTopColor: globalColors.black_05,
    borderTopWidth: 1,
    flexShrink: 0,
    minHeight: 48,
    paddingBottom: 6,
    paddingRight: 6,
    paddingTop: 6,
  },
  editingTabStyle: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    backgroundColor: globalColors.yellow_60,
    height: '100%',
  },
  input: {
    marginLeft: globalMargins.tiny,
    paddingBottom: 6,
    paddingTop: 6,
    ...(isIOS
      ? {}
      : {
          marginBottom: -4, // android has a bug where the lineheight isn't respected
          marginTop: -4, // android has a bug where the lineheight isn't respected
        }),
  },
  mentionHud: {
    borderColor: globalColors.black_20,
    borderTopWidth: 1,
    flex: 1,
    height: 160,
    width: '100%',
  },
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

export default PlatformInput

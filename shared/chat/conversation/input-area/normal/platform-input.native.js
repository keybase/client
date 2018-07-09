// @flow
/* eslint-env browser */
import {showImagePicker} from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Box2, Icon, Input, Text, iconCastPlatformStyles} from '../../../../common-adapters'
import {globalMargins, globalStyles, globalColors, platformStyles, styleSheetCreate} from '../../../../styles'
import {isIOS, isLargeScreen} from '../../../../constants/platform'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'
import {
  NativeKeyboard,
  NativeTouchableWithoutFeedback,
} from '../../../../common-adapters/native-wrappers.native'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import {ExplodingMeta} from './shared'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import type {PlatformInputProps} from './types'
import flags from '../../../../util/feature-flags'

type State = {
  hasText: boolean,
}

class PlatformInput extends Component<PlatformInputProps & FloatingMenuParentProps, State> {
  _input: ?Input

  constructor(props: PlatformInputProps & FloatingMenuParentProps) {
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

  _toggleShowingMenu = () => {
    // Hide the keyboard on mobile when showing the menu.
    NativeKeyboard.dismiss()
    this.props.onSeenExplodingMessages()
    this.props.toggleShowingMenu()
  }

  render = () => {
    let hintText = 'Write a message'
    if (this.props.isExploding) {
      hintText = isLargeScreen ? 'Write an exploding message' : 'Exploding message'
    } else if (this.props.isEditing) {
      hintText = 'Edit your message'
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
        {this.props.showingMenu && (
          <SetExplodingMessagePicker
            attachTo={this.props.attachmentRef}
            conversationIDKey={this.props.conversationIDKey}
            onHidden={this.props.toggleShowingMenu}
            visible={this.props.showingMenu}
          />
        )}
        <Box style={styles.container}>
          {this.props.isEditing && (
            <Box style={styles.editingTabStyle}>
              <Text type="BodySmall">Edit:</Text>
              <Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing}>
                Cancel
              </Text>
            </Box>
          )}
          <Input
            autoCorrect={true}
            autoCapitalize="sentences"
            autoFocus={false}
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
            rowsMax={3}
            rowsMin={1}
          />

          {this.props.typing.size > 0 && <Typing />}
          <Action
            hasText={this.state.hasText}
            onSubmit={this._onSubmit}
            isEditing={this.props.isEditing}
            openExplodingPicker={this._toggleShowingMenu}
            openFilePicker={this._openFilePicker}
            insertMentionMarker={this.props.insertMentionMarker}
            isExploding={this.props.isExploding}
            isExplodingNew={this.props.isExplodingNew}
            explodingModeSeconds={this.props.explodingModeSeconds}
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
    <Icon type="icon-typing-24" style={iconCastPlatformStyles(styles.typingIcon)} />
  </Box>
)

const Action = ({
  hasText,
  onSubmit,
  isEditing,
  openExplodingPicker,
  openFilePicker,
  insertMentionMarker,
  isExploding,
  isExplodingNew,
  explodingModeSeconds,
}) =>
  hasText ? (
    <Box2 direction="horizontal" gap="small" style={styles.actionText}>
      {flags.explodingMessagesEnabled &&
        isExploding &&
        !isEditing && (
          <ExplodingIcon
            explodingModeSeconds={explodingModeSeconds}
            isExploding={isExploding}
            isExplodingNew={isExplodingNew}
            openExplodingPicker={openExplodingPicker}
          />
        )}
      <Text type="BodyBigLink" onClick={onSubmit}>
        {isEditing ? 'Save' : 'Send'}
      </Text>
    </Box2>
  ) : (
    <Box2 direction="horizontal" gap="small" style={styles.actionIconsContainer}>
      {flags.explodingMessagesEnabled && (
        <ExplodingIcon
          explodingModeSeconds={explodingModeSeconds}
          isExploding={isExploding}
          isExplodingNew={isExplodingNew}
          openExplodingPicker={openExplodingPicker}
        />
      )}
      <Box style={styles.actionButtonWrapper}>
        <Icon
          onClick={insertMentionMarker}
          type="iconfont-mention"
          style={iconCastPlatformStyles(styles.actionButton)}
          fontSize={22}
        />
      </Box>
      <Box style={styles.actionButtonWrapper}>
        <Icon
          onClick={openFilePicker}
          type="iconfont-camera"
          style={iconCastPlatformStyles(styles.actionButton)}
          fontSize={22}
        />
      </Box>
    </Box2>
  )

const ExplodingIcon = ({explodingModeSeconds, isExploding, isExplodingNew, openExplodingPicker}) => (
  <NativeTouchableWithoutFeedback onPress={openExplodingPicker}>
    <Box style={explodingIconContainer}>
      <Icon
        color={isExploding ? globalColors.black_75 : null}
        style={iconCastPlatformStyles(styles.actionButton)}
        type="iconfont-bomb"
        fontSize={22}
      />
      <ExplodingMeta explodingModeSeconds={explodingModeSeconds} isNew={isExplodingNew} />
    </Box>
  </NativeTouchableWithoutFeedback>
)

const containerPadding = 6
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
  },
  actionButtonWrapper: platformStyles({
    common: {
      paddingLeft: containerPadding,
      paddingRight: containerPadding,
      paddingTop: containerPadding,
    },
  }),
  actionIconsContainer: {
    paddingRight: globalMargins.small - containerPadding,
  },
  actionText: {
    alignSelf: 'flex-end',
    paddingBottom: globalMargins.xsmall,
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
    paddingRight: containerPadding,
  },
  editingTabStyle: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    backgroundColor: globalColors.yellow3,
    flexShrink: 0,
    height: '100%',
    minWidth: 32,
    padding: globalMargins.xtiny,
  },
  input: {
    marginLeft: globalMargins.tiny,
    paddingBottom: 12,
    paddingTop: 12,
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
    alignSelf: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginRight: globalMargins.tiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
  typingIcon: {
    width: 20,
  },
})

const explodingIconContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    marginRight: -3,
    paddingLeft: containerPadding,
    paddingRight: containerPadding,
    paddingTop: containerPadding,
  },
})

export default FloatingMenuParentHOC(PlatformInput)

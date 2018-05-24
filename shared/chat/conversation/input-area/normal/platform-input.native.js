// @flow
/* eslint-env browser */
import {showImagePicker} from 'react-native-image-picker'
import React, {Component} from 'react'
import {Box, Box2, Icon, Input, Text, iconCastPlatformStyles} from '../../../../common-adapters'
import {globalMargins, globalStyles, globalColors, styleSheetCreate} from '../../../../styles'
import {isIOS} from '../../../../constants/platform'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'
import {NativeTouchableWithoutFeedback} from '../../../../common-adapters/native-wrappers.native'
import SetExplodingMessagePicker from '../../messages/set-explode-popup'
import {ExplodingMeta} from './shared'
import {messageExplodeDescriptions} from '../../../../constants/chat2'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import type {PlatformInputProps} from './types'

type State = {
  explodingPickerOpen: boolean,
  hasText: boolean,
}

class PlatformInput extends Component<PlatformInputProps & FloatingMenuParentProps, State> {
  _input: ?Input

  constructor(props: PlatformInputProps & FloatingMenuParentProps) {
    super(props)
    this.state = {
      explodingPickerOpen: false,
      hasText: false,
    }
  }

  _inputSetRef = (ref: ?Input) => {
    this._input = ref
    this.props.inputSetRef(ref)
  }

  _explodingPickerToggle = () => {
    this.setState(({explodingPickerOpen}) => ({explodingPickerOpen: !explodingPickerOpen}))
  }

  _selectExplodingMode = selected => {
    this.props.selectExplodingMode(selected.seconds)
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
    let hintText = 'Write a message'
    if (this.props.isExploding) {
      hintText = 'Write an exploding message'
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
        {this.state.explodingPickerOpen && (
          <SetExplodingMessagePicker
            attachTo={this.props.attachmentRef}
            isNew={true}
            items={messageExplodeDescriptions.sort((a, b) => (a.seconds < b.seconds ? 1 : 0))}
            onHidden={this._explodingPickerToggle}
            onSelect={this._selectExplodingMode}
            selected={messageExplodeDescriptions.find(
              exploded => exploded.seconds === this.props.explodingModeSeconds
            )}
            visible={this.state.explodingPickerOpen}
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
            openExplodingPicker={this._explodingPickerToggle}
            openFilePicker={this._openFilePicker}
            insertMentionMarker={this.props.insertMentionMarker}
            isExploding={this.props.isExploding}
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
  explodingModeSeconds,
}) =>
  hasText ? (
    <Box style={styles.actionText}>
      <Text type="BodyBigLink" onClick={onSubmit}>
        {isEditing ? 'Save' : 'Send'}
      </Text>
    </Box>
  ) : (
    <Box2 direction="horizontal" gap="small" style={styles.actionIconsContainer}>
      <ExplodingIcon
        explodingModeSeconds={explodingModeSeconds}
        isExploding={isExploding}
        openExplodingPicker={openExplodingPicker}
      />
      <Icon
        onClick={insertMentionMarker}
        type="iconfont-mention"
        style={iconCastPlatformStyles(styles.actionButton)}
        fontSize={21}
      />
      <Icon
        onClick={openFilePicker}
        type="iconfont-camera"
        style={iconCastPlatformStyles(styles.actionButton)}
        fontSize={21}
      />
    </Box2>
  )

const ExplodingIcon = ({explodingModeSeconds, isExploding, openExplodingPicker}) => (
  <NativeTouchableWithoutFeedback onPress={openExplodingPicker}>
    <Box style={styles.explodingIconContainer}>
      <Icon
        color={isExploding ? globalColors.black_75 : null}
        style={iconCastPlatformStyles(styles.actionButton)}
        type="iconfont-bomb"
        fontSize={21}
      />
      <ExplodingMeta explodingModeSeconds={explodingModeSeconds} />
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
    paddingBottom: 2,
  },
  actionIconsContainer: {
    paddingRight: globalMargins.small - containerPadding,
  },
  actionText: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
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
    paddingRight: containerPadding,
  },
  editingTabStyle: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    backgroundColor: globalColors.yellow_60,
    height: '100%',
    padding: 3,
  },
  explodingIconContainer: {
    ...globalStyles.flexBoxRow,
    marginRight: globalMargins.xsmall,
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

export default FloatingMenuParentHOC(PlatformInput)

// @flow
/* eslint-env browser */
import {launchCamera, launchImageLibrary} from 'react-native-image-picker'
import React, {Component} from 'react'
import {
  Box,
  Box2,
  FloatingMenu,
  Icon,
  Input,
  Text,
  iconCastPlatformStyles,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../../../common-adapters'
import {collapseStyles, globalMargins, globalStyles, globalColors, styleSheetCreate} from '../../../../styles'
import {isIOS, isLargeScreen} from '../../../../constants/platform'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'
import {
  NativeKeyboard,
  NativeTouchableWithoutFeedback,
} from '../../../../common-adapters/native-wrappers.native'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import type {PlatformInputProps} from './types'
import FilePickerPopup from '../filepicker-popup'
import {formatDurationShort} from '../../../../util/timestamp'

type menuType = 'exploding' | 'filepickerpopup' | 'insert'

type State = {
  hasText: boolean,
}

class PlatformInput extends Component<PlatformInputProps & OverlayParentProps, State> {
  _input: ?Input
  _whichMenu: menuType

  constructor(props: PlatformInputProps & OverlayParentProps) {
    super(props)
    this.state = {
      hasText: false,
    }
  }

  _inputSetRef = (ref: ?Input) => {
    this._input = ref
    this.props.inputSetRef(ref)
  }

  _launchNativeImagePicker = (mediaType: string, location: string) => {
    let title = 'Select a Photo'
    let takePhotoButtonTitle = 'Take Photo...'
    let permDeniedText = 'Allow Keybase to take photos and choose images from your library?'
    switch (mediaType) {
      case 'photo':
        break
      case 'mixed':
        title = 'Select a Photo or Video'
        takePhotoButtonTitle = 'Take Photo or Video...'
        // 'mixed' never happens on Android, which is when the
        // permissions denied dialog box is shown, but fill it out
        // anyway.
        permDeniedText = 'Allow Keybase to take photos/video and choose images/videos from your library?'
        break
      case 'video':
        title = 'Select a Video'
        takePhotoButtonTitle = 'Take Video...'
        permDeniedText = 'Allow Keybase to take video and choose videos from your library?'
        break
    }
    const permissionDenied = {
      title: 'Permissions needed',
      text: permDeniedText,
      reTryTitle: 'allow in settings',
      okTitle: 'deny',
    }
    const handleSelection = response => {
      if (response.didCancel || !this.props.conversationIDKey) {
        return
      }
      if (response.error) {
        this.props.onFilePickerError(new Error(response.error))
        return
      }
      const filename = isIOS ? response.uri.replace('file://', '') : response.path
      this.props.onAttach([filename])
    }

    switch (location) {
      case 'camera':
        launchCamera({mediaType, title, takePhotoButtonTitle, permissionDenied}, handleSelection)
        break
      case 'library':
        launchImageLibrary({mediaType, title, takePhotoButtonTitle, permissionDenied}, handleSelection)
        break
    }
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

  _toggleShowingMenu = (menu: menuType) => {
    // Hide the keyboard on mobile when showing the menu.
    NativeKeyboard.dismiss()
    this._whichMenu = menu
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
        {this.props.showingMenu && this._whichMenu === 'filepickerpopup' ? (
          <FilePickerPopup
            attachTo={this.props.attachmentRef}
            visible={this.props.showingMenu}
            onHidden={this.props.toggleShowingMenu}
            onSelect={this._launchNativeImagePicker}
          />
        ) : this._whichMenu === 'exploding' ? (
          <SetExplodingMessagePicker
            attachTo={this.props.attachmentRef}
            conversationIDKey={this.props.conversationIDKey}
            onHidden={this.props.toggleShowingMenu}
            visible={this.props.showingMenu}
          />
        ) : (
          <FloatingMenu
            attachTo={this.props.attachmentRef}
            closeOnSelect={true}
            items={[
              {
                onClick: this.props.insertMentionMarker,
                title: '@mention someone',
              },
              {
                onClick: this.props.onInsertEmoji,
                title: 'Insert emoji',
              },
            ]}
            onHidden={this.props.toggleShowingMenu}
            visible={this.props.showingMenu}
          />
        )}
        <Box
          style={collapseStyles([
            styles.container,
            {
              borderTopColor: this.props.isExploding ? globalColors.black_75 : globalColors.black_05,
            },
          ])}
        >
          {!this.props.isEditing && (
            <ExplodingIcon
              explodingModeSeconds={this.props.explodingModeSeconds}
              isExploding={this.props.isExploding}
              isExplodingNew={this.props.isExplodingNew}
              openExplodingPicker={() => this._toggleShowingMenu('exploding')}
            />
          )}
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
            openFilePicker={() => this._toggleShowingMenu('filepickerpopup')}
            openInsertMenu={() => this._toggleShowingMenu('insert')}
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

const Action = ({hasText, onSubmit, isEditing, openFilePicker, openInsertMenu}) =>
  hasText ? (
    <Box2 direction="horizontal" gap="small" style={styles.actionText}>
      <Text type="BodyBigLink" onClick={onSubmit}>
        {isEditing ? 'Save' : 'Send'}
      </Text>
    </Box2>
  ) : (
    <Box2 direction="horizontal" gap="small" style={styles.actionIconsContainer}>
      <Icon
        onClick={openFilePicker}
        type="iconfont-camera"
        style={iconCastPlatformStyles(styles.actionButton)}
        fontSize={22}
      />
      <Icon
        onClick={openInsertMenu}
        type="iconfont-add"
        style={iconCastPlatformStyles(styles.actionButton)}
        fontSize={22}
      />
    </Box2>
  )

const ExplodingIcon = ({explodingModeSeconds, isExploding, isExplodingNew, openExplodingPicker}) => (
  <NativeTouchableWithoutFeedback onPress={openExplodingPicker}>
    <Box style={collapseStyles([styles.timerContainer, isExploding && styles.timerContainerWithText])}>
      {isExploding ? (
        <Text style={collapseStyles([styles.timer, styles.timerText])} type="BodySmallSemibold">
          {formatDurationShort(explodingModeSeconds * 1000)}
        </Text>
      ) : (
        <Icon
          style={iconCastPlatformStyles(collapseStyles([styles.timer, styles.timerIcon]))}
          type="iconfont-timer"
          fontSize={22}
        />
      )}
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
  timer: {
    alignSelf: 'center',
    position: 'absolute',
  },
  timerContainer: {
    height: '100%',
    width: 40,
  },
  timerContainerWithText: {
    backgroundColor: globalColors.black_75,
  },
  timerIcon: {
    bottom: 12,
    paddingLeft: globalMargins.tiny,
  },
  timerText: {
    bottom: 13,
    color: globalColors.white,
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

export default OverlayParentHOC(PlatformInput)

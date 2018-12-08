// @flow
/* eslint-env browser */
import {launchCamera, launchImageLibrary} from 'react-native-image-picker'
import React, {PureComponent} from 'react'
import {
  Animation,
  Box,
  Box2,
  Icon,
  Input,
  Text,
  iconCastPlatformStyles,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../../../common-adapters'
import {
  collapseStyles,
  globalMargins,
  globalStyles,
  globalColors,
  platformStyles,
  styleSheetCreate,
} from '../../../../styles'
import {isIOS, isLargeScreen} from '../../../../constants/platform'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'
import {
  NativeKeyboard,
  NativeTouchableWithoutFeedback,
} from '../../../../common-adapters/native-wrappers.native'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import {ExplodingMeta} from './shared'
import type {PlatformInputProps} from './types'
import flags from '../../../../util/feature-flags'
import FilePickerPopup from '../filepicker-popup'
import WalletsIcon from './wallets-icon/container'

type menuType = 'exploding' | 'filepickerpopup'

type State = {
  hasText: boolean,
}

class PlatformInput extends PureComponent<PlatformInputProps & OverlayParentProps, State> {
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

  _openFilePicker = () => {
    this._toggleShowingMenu('filepickerpopup')
  }

  _launchNativeImagePicker = (mediaType: 'photo' | 'video' | 'mixed', location: string) => {
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
      okTitle: 'deny',
      reTryTitle: 'allow in settings',
      text: permDeniedText,
      title: 'Permissions needed',
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
      if (filename) {
        this.props.onAttach([filename])
      }
    }

    switch (location) {
      case 'camera':
        launchCamera({mediaType, permissionDenied, takePhotoButtonTitle, title}, handleSelection)
        break
      case 'library':
        launchImageLibrary({mediaType, permissionDenied, takePhotoButtonTitle, title}, handleSelection)
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
    if (this.props.isExploding && isLargeScreen) {
      hintText = this.props.showWalletsIcon ? 'Exploding message' : 'Write an exploding message'
    } else if (this.props.isExploding && !isLargeScreen) {
      hintText = this.props.showWalletsIcon ? 'Exploding' : 'Exploding message'
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
            setMentionHudIsShowing={this.props.setMentionHudIsShowing}
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
            setChannelMentionHudIsShowing={this.props.setChannelMentionHudIsShowing}
          />
        )}
        {this.props.showingMenu && this._whichMenu === 'filepickerpopup' ? (
          <FilePickerPopup
            attachTo={this.props.getAttachmentRef}
            visible={this.props.showingMenu}
            onHidden={this.props.toggleShowingMenu}
            onSelect={this._launchNativeImagePicker}
          />
        ) : (
          <SetExplodingMessagePicker
            attachTo={this.props.getAttachmentRef}
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

          {this.props.typing.size > 0 && <Animation animationType="typing" containerStyle={styles.typing} />}
          <Action
            hasText={this.state.hasText}
            onSubmit={this._onSubmit}
            isEditing={this.props.isEditing}
            openExplodingPicker={() => this._toggleShowingMenu('exploding')}
            openFilePicker={this._openFilePicker}
            insertMentionMarker={this.props.insertMentionMarker}
            isExploding={this.props.isExploding}
            isExplodingNew={this.props.isExplodingNew}
            showWalletsIcon={this.props.showWalletsIcon}
            explodingModeSeconds={this.props.explodingModeSeconds}
          />
        </Box>
      </Box>
    )
  }
}

const MentionHud = props => (
  <Box style={styles.accessoryContainer}>
    <Box style={styles.accessory}>
      <ConnectedMentionHud style={styles.mentionHud} {...props} conversationIDKey={props.conversationIDKey} />
    </Box>
  </Box>
)

const ChannelMentionHud = props => (
  <Box style={styles.accessoryContainer}>
    <Box style={styles.accessory}>
      <ConnectedChannelMentionHud style={styles.mentionHud} {...props} />
    </Box>
  </Box>
)

const Action = ({
  explodingModeSeconds,
  hasText,
  insertMentionMarker,
  isEditing,
  isExploding,
  isExplodingNew,
  onSubmit,
  openExplodingPicker,
  openFilePicker,
  showWalletsIcon,
}) =>
  hasText ? (
    <Box2 direction="horizontal" gap="small" style={styles.actionText}>
      {flags.explodingMessagesEnabled && isExploding && !isEditing && (
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
    <Box2 direction="horizontal" style={styles.actionIconsContainer}>
      {flags.explodingMessagesEnabled && (
        <>
          <ExplodingIcon
            explodingModeSeconds={explodingModeSeconds}
            isExploding={isExploding}
            isExplodingNew={isExplodingNew}
            openExplodingPicker={openExplodingPicker}
          />
          {smallGap}
        </>
      )}
      {showWalletsIcon && (
        <WalletsIcon size={22} style={collapseStyles([styles.actionButton, styles.marginRightSmall])} />
      )}
      <Icon
        onClick={insertMentionMarker}
        type="iconfont-mention"
        style={iconCastPlatformStyles(styles.actionButton)}
        fontSize={22}
      />
      {smallGap}
      <Icon
        onClick={openFilePicker}
        type="iconfont-camera"
        style={iconCastPlatformStyles(styles.actionButton)}
        fontSize={22}
      />
    </Box2>
  )

const ExplodingIcon = ({explodingModeSeconds, isExploding, isExplodingNew, openExplodingPicker}) => (
  <NativeTouchableWithoutFeedback onPress={openExplodingPicker}>
    <Box style={explodingIconContainer}>
      <Icon
        color={isExploding ? globalColors.black_75 : null}
        style={iconCastPlatformStyles(styles.actionButton)}
        type="iconfont-timer"
        fontSize={22}
      />
      <ExplodingMeta explodingModeSeconds={explodingModeSeconds} isNew={isExplodingNew} />
    </Box>
  </NativeTouchableWithoutFeedback>
)

const containerPadding = 8
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
    alignItems: 'center',
    backgroundColor: globalColors.fastBlank,
    borderTopColor: globalColors.black_10,
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
    marginRight: globalMargins.tiny,
    ...(isIOS
      ? {}
      : {
          marginBottom: -4, // android has a bug where the lineheight isn't respected
          marginTop: -4, // android has a bug where the lineheight isn't respected
        }),
  },
  marginRightSmall: {
    marginRight: globalMargins.small,
  },
  mentionHud: {
    borderColor: globalColors.black_20,
    borderTopWidth: 1,
    flex: 1,
    height: 160,
    width: '100%',
  },
  smallGap: {
    height: globalMargins.small,
    width: globalMargins.small,
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

// Use manual gap when Box2 is inserting too many (for children that deliberately render nothing)
const smallGap = <Box style={styles.smallGap} />

const explodingIconContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    marginRight: -3,
  },
})

export default OverlayParentHOC(PlatformInput)

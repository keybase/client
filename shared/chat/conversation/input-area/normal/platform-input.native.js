// @flow
/* eslint-env browser */
import {launchCamera, launchImageLibrary} from 'react-native-image-picker'
import React, {PureComponent} from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {isIOS, isLargeScreen} from '../../../../constants/platform'
import {
  NativeKeyboard,
  NativeTouchableWithoutFeedback,
} from '../../../../common-adapters/native-wrappers.native'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import {ExplodingMeta} from './shared'
import Typing from './typing/container'
import FilePickerPopup from '../filepicker-popup'
import WalletsIcon from './wallets-icon/container'
import type {PlatformInputPropsInternal} from './platform-input'
import AddSuggestors, {standardTransformer} from '../suggestors'
import {metaData} from '../../../../common-adapters/text.meta.native'

type menuType = 'exploding' | 'filepickerpopup'

type State = {
  hasText: boolean,
}

class _PlatformInput extends PureComponent<PlatformInputPropsInternal, State> {
  _input: null | Kb.PlainInput
  _lastText: ?string
  _whichMenu: menuType

  constructor(props: PlatformInputPropsInternal) {
    super(props)
    this.state = {
      hasText: false,
    }
  }

  _inputSetRef = (ref: null | Kb.PlainInput) => {
    this._input = ref
    this.props.inputSetRef(ref)
    this.props.inputRef.current = ref
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
    return this._lastText || ''
  }

  _onChangeText = (text: string) => {
    this.setState({hasText: !!text})
    this._lastText = text
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
    this.props.toggleShowingMenu()
  }

  _onLayout = ({
    nativeEvent: {
      layout: {x, y, width, height},
    },
  }) => this.props.setHeight(height)

  _insertMentionMarker = () => {
    if (this._input) {
      const input = this._input
      input.focus()
      input.transformText(
        ({selection: {end, start}, text}) => standardTransformer('@', {position: {end, start}, text}, true),
        true
      )
    }
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
      <Kb.Box onLayout={this._onLayout}>
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
        <Typing conversationIDKey={this.props.conversationIDKey} />
        <Kb.Box style={styles.container}>
          {this.props.isEditing && (
            <Kb.Box style={styles.editingTabStyle}>
              <Kb.Text type="BodySmall">Edit:</Kb.Text>
              <Kb.Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing}>
                Cancel
              </Kb.Text>
            </Kb.Box>
          )}
          <Kb.PlainInput
            autoCorrect={true}
            autoCapitalize="sentences"
            placeholder={hintText}
            multiline={true}
            onBlur={this.props.onBlur}
            onFocus={this.props.onFocus}
            // TODO: Call onCancelQuoting on text change or selection
            // change to match desktop.
            onChangeText={this._onChangeText}
            onSelectionChange={this.props.onSelectionChange}
            ref={this._inputSetRef}
            style={styles.input}
            rowsMax={3}
            rowsMin={1}
          />
          <Action
            hasText={this.state.hasText}
            onSubmit={this._onSubmit}
            isEditing={this.props.isEditing}
            openExplodingPicker={() => this._toggleShowingMenu('exploding')}
            openFilePicker={this._openFilePicker}
            insertMentionMarker={this._insertMentionMarker}
            isExploding={this.props.isExploding}
            showWalletsIcon={this.props.showWalletsIcon}
            explodingModeSeconds={this.props.explodingModeSeconds}
          />
        </Kb.Box>
      </Kb.Box>
    )
  }
}
const PlatformInput = AddSuggestors(_PlatformInput)

const Action = ({
  explodingModeSeconds,
  hasText,
  insertMentionMarker,
  isEditing,
  isExploding,
  onSubmit,
  openExplodingPicker,
  openFilePicker,
  showWalletsIcon,
}) =>
  hasText ? (
    <Kb.Box2 direction="horizontal" gap="small" style={styles.actionText}>
      {isExploding && !isEditing && (
        <ExplodingIcon
          explodingModeSeconds={explodingModeSeconds}
          isExploding={isExploding}
          openExplodingPicker={openExplodingPicker}
        />
      )}
      <Kb.Text type="BodyBigLink" onClick={onSubmit}>
        {isEditing ? 'Save' : 'Send'}
      </Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="horizontal" style={styles.actionIconsContainer}>
      <>
        <ExplodingIcon
          explodingModeSeconds={explodingModeSeconds}
          isExploding={isExploding}
          openExplodingPicker={openExplodingPicker}
        />
        {smallGap}
      </>
      {showWalletsIcon && (
        <WalletsIcon
          size={22}
          style={Styles.collapseStyles([styles.actionButton, styles.marginRightSmall])}
        />
      )}
      <Kb.Icon
        onClick={insertMentionMarker}
        type="iconfont-mention"
        style={Kb.iconCastPlatformStyles(styles.actionButton)}
        fontSize={22}
      />
      {smallGap}
      <Kb.Icon
        onClick={openFilePicker}
        type="iconfont-camera"
        style={Kb.iconCastPlatformStyles(styles.actionButton)}
        fontSize={22}
      />
    </Kb.Box2>
  )

const ExplodingIcon = ({explodingModeSeconds, isExploding, openExplodingPicker}) => (
  <NativeTouchableWithoutFeedback onPress={openExplodingPicker}>
    <Kb.Box style={explodingIconContainer}>
      <Kb.Icon
        color={isExploding ? Styles.globalColors.black_75 : null}
        style={Kb.iconCastPlatformStyles(styles.actionButton)}
        type="iconfont-timer"
        fontSize={22}
      />
      <ExplodingMeta explodingModeSeconds={explodingModeSeconds} />
    </Kb.Box>
  </NativeTouchableWithoutFeedback>
)

const containerPadding = 8
const styles = Styles.styleSheetCreate({
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
    paddingRight: Styles.globalMargins.small - containerPadding,
  },
  actionText: {
    alignSelf: 'flex-end',
    paddingBottom: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.tiny,
  },
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.fastBlank,
    borderTopColor: Styles.globalColors.black_10,
    borderTopWidth: 1,
    flexShrink: 0,
    minHeight: 48,
    paddingRight: containerPadding,
  },
  editingTabStyle: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    backgroundColor: Styles.globalColors.yellow3,
    flexShrink: 0,
    height: '100%',
    minWidth: 32,
    padding: Styles.globalMargins.xtiny,
  },
  input: {
    flex: 1,
    fontSize: metaData['BodyBig'].fontSize,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    ...(isIOS
      ? {}
      : {
          marginBottom: -4, // android has a bug where the lineheight isn't respected
          marginTop: -4, // android has a bug where the lineheight isn't respected
        }),
  },
  marginRightSmall: {
    marginRight: Styles.globalMargins.small,
  },
  mentionHud: {
    borderColor: Styles.globalColors.black_20,
    borderTopWidth: 1,
    flex: 1,
    height: 160,
    width: '100%',
  },
  smallGap: {
    height: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
})

// Use manual gap when Kb.Box2 is inserting too many (for children that deliberately render nothing)
const smallGap = <Kb.Box style={styles.smallGap} />

const explodingIconContainer = Styles.platformStyles({
  common: {
    ...Styles.globalStyles.flexBoxRow,
    marginRight: -3,
  },
})

export default Kb.OverlayParentHOC(PlatformInput)

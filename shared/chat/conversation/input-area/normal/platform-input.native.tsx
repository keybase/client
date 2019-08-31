/* eslint-env browser */
import * as ImagePicker from 'expo-image-picker'
import React, {PureComponent} from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {isIOS, isLargeScreen} from '../../../../constants/platform'
import {
  NativeKeyboard,
  NativeTouchableWithoutFeedback,
} from '../../../../common-adapters/native-wrappers.native'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import Typing from './typing/container'
import FilePickerPopup from '../filepicker-popup'
import MoreMenuPopup from './moremenu-popup'
import {PlatformInputPropsInternal} from './platform-input'
import AddSuggestors, {standardTransformer} from '../suggestors'
import {parseUri, launchCameraAsync, launchImageLibraryAsync} from '../../../../util/expo-image-picker'
import {BotCommandUpdateStatus} from './shared'
import {formatDurationShort} from '../../../../util/timestamp'

type menuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type State = {hasText: boolean}

class _PlatformInput extends PureComponent<PlatformInputPropsInternal, State> {
  _input: null | Kb.PlainInput = null
  _lastText?: string
  _whichMenu?: menuType
  state = {hasText: false}

  _inputSetRef = (ref: null | Kb.PlainInput) => {
    this._input = ref
    this.props.inputSetRef(ref)
    // @ts-ignore this is probably wrong: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31065
    this.props.inputRef.current = ref
  }

  _openFilePicker = () => {
    this._toggleShowingMenu('filepickerpopup')
  }
  _openMoreMenu = () => {
    this._toggleShowingMenu('moremenu')
  }

  _launchNativeImagePicker = (mediaType: 'photo' | 'video' | 'mixed', location: string) => {
    const handleSelection = (result: ImagePicker.ImagePickerResult) => {
      if (result.cancelled === true || !this.props.conversationIDKey) {
        return
      }
      const filename = parseUri(result)
      if (filename) {
        this.props.onAttach([filename])
      }
    }

    switch (location) {
      case 'camera':
        launchCameraAsync(mediaType)
          .then(handleSelection)
          .catch(error => this.props.onFilePickerError(new Error(error)))
        break
      case 'library':
        launchImageLibraryAsync(mediaType)
          .then(handleSelection)
          .catch(error => this.props.onFilePickerError(new Error(error)))
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
      layout: {height},
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

  render() {
    let hintText = 'Write a message'
    if (this.props.isExploding && isLargeScreen) {
      hintText = 'Exploding message'
    } else if (this.props.isExploding && !isLargeScreen) {
      hintText = 'Exploding'
    } else if (this.props.isEditing) {
      hintText = 'Edit your message'
    } else if (this.props.cannotWrite) {
      hintText = `You must be at least ${'aeiou'.includes(this.props.minWriterRole[0]) ? 'an' : 'a'} ${
        this.props.minWriterRole
      } to post`
    }

    return (
      <Kb.Box onLayout={this._onLayout}>
        {this.props.suggestBotCommandsUpdateStatus !== RPCChatTypes.UIBotCommandsUpdateStatus.blank &&
          (this.props.suggestionsVisible ||
            this.props.suggestBotCommandsUpdateStatus ===
              RPCChatTypes.UIBotCommandsUpdateStatus.updating) && (
            <BotCommandUpdateStatus status={this.props.suggestBotCommandsUpdateStatus} />
          )}
        {this.props.showingMenu && this._whichMenu === 'filepickerpopup' ? (
          <FilePickerPopup
            attachTo={this.props.getAttachmentRef}
            visible={this.props.showingMenu}
            onHidden={this.props.toggleShowingMenu}
            onSelect={this._launchNativeImagePicker}
          />
        ) : this._whichMenu === 'moremenu' ? (
          <MoreMenuPopup
            conversationIDKey={this.props.conversationIDKey}
            onHidden={this.props.toggleShowingMenu}
            visible={this.props.showingMenu}
          />
        ) : (
          <SetExplodingMessagePicker
            attachTo={this.props.getAttachmentRef}
            conversationIDKey={this.props.conversationIDKey}
            onHidden={this.props.toggleShowingMenu}
            visible={this.props.showingMenu}
          />
        )}
        {this.props.showTypingStatus && !this.props.suggestionsVisible && (
          <Typing conversationIDKey={this.props.conversationIDKey} />
        )}
        <Kb.Box style={styles.container}>
          {this.props.isEditing && (
            <Kb.Box style={styles.editingTabStyle}>
              <Kb.Text type="BodySmall">Edit:</Kb.Text>
              <Kb.Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing}>
                Cancel
              </Kb.Text>
            </Kb.Box>
          )}
          {!this.props.isEditing && (
            <ExplodingIcon
              explodingModeSeconds={this.props.explodingModeSeconds}
              isExploding={this.props.isExploding}
              openExplodingPicker={() => this._toggleShowingMenu('exploding')}
            />
          )}
          <Kb.PlainInput
            autoCorrect={true}
            autoCapitalize="sentences"
            disabled={
              // Auto generated from flowToTs. Please clean me!
              this.props.cannotWrite !== null && this.props.cannotWrite !== undefined
                ? this.props.cannotWrite
                : false
            }
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
            textType="Body"
            rowsMax={Styles.dimensionHeight < 600 ? 5 : 9}
            rowsMin={1}
          />
          {!this.props.cannotWrite && (
            <Action
              hasText={this.state.hasText}
              onSubmit={this._onSubmit}
              isEditing={this.props.isEditing}
              openFilePicker={this._openFilePicker}
              openMoreMenu={this._openMoreMenu}
              insertMentionMarker={this._insertMentionMarker}
            />
          )}
        </Kb.Box>
      </Kb.Box>
    )
  }
}
const PlatformInput = AddSuggestors(_PlatformInput)

const Action = ({hasText, insertMentionMarker, isEditing, onSubmit, openFilePicker, openMoreMenu}) =>
  hasText ? (
    <Kb.Button
      type="Default"
      small={true}
      style={styles.send}
      onClick={onSubmit}
      label={isEditing ? 'Save' : 'Send'}
    />
  ) : (
    <Kb.Box2 direction="horizontal" style={styles.actionIconsContainer}>
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
      {smallGap}
      <Kb.Icon
        onClick={openMoreMenu}
        type="iconfont-add"
        style={Kb.iconCastPlatformStyles(styles.actionButton)}
        fontSize={22}
      />
    </Kb.Box2>
  )

const ExplodingIcon = ({explodingModeSeconds, isExploding, openExplodingPicker}) => (
  <Kb.Box2 direction="horizontal" style={styles.explodingOuterContainer}>
    <NativeTouchableWithoutFeedback onPress={openExplodingPicker}>
      <Kb.Box style={explodingIconContainer}>
        {isExploding ? (
          <Kb.Box2 direction="horizontal" style={styles.exploding} centerChildren={true}>
            <Kb.Text type="BodyTinyBold" negative={true}>
              {formatDurationShort(explodingModeSeconds * 1000)}
            </Kb.Text>
          </Kb.Box2>
        ) : (
          <Kb.Icon
            color={isExploding ? Styles.globalColors.black : null}
            style={Kb.iconCastPlatformStyles(styles.nonExploding)}
            type="iconfont-timer"
            fontSize={22}
          />
        )}
      </Kb.Box>
    </NativeTouchableWithoutFeedback>
  </Kb.Box2>
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
    overflow: 'hidden',
    paddingRight: containerPadding,
  },
  editingTabStyle: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    backgroundColor: Styles.globalColors.yellowLight,
    flexShrink: 0,
    height: '100%',
    minWidth: 32,
    padding: Styles.globalMargins.xtiny,
  },
  exploding: {
    backgroundColor: Styles.globalColors.black,
    borderRadius: Styles.globalMargins.mediumLarge / 2,
    height: Styles.globalMargins.mediumLarge,
    marginLeft: Styles.globalMargins.tiny,
    width: Styles.globalMargins.mediumLarge,
  },
  explodingOuterContainer: {
    alignSelf: isIOS ? 'flex-end' : 'center',
    paddingBottom: 7,
  },
  input: {
    flex: 1,
    fontSize: 17, // Override Body's font size with BodyBig.
    marginBottom: Styles.globalMargins.xsmall,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.xsmall,
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
  nonExploding: {
    paddingBottom: 5,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: 7,
  },
  send: {
    alignSelf: isIOS ? 'flex-end' : 'center',
    marginBottom: Styles.globalMargins.tiny,
  },
  smallGap: {
    height: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
})

// Use manual gap when Kb.Box2 is inserting too many (for children that deliberately render nothing)
const smallGap = <Kb.Box style={styles.smallGap} />

const explodingIconContainer = {
  ...Styles.globalStyles.flexBoxColumn,
}

export default Kb.OverlayParentHOC(PlatformInput)

import * as ImagePicker from 'expo-image-picker'
import * as Types from '../../../../constants/types/chat2'
import React, {PureComponent} from 'react'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {isIOS, isLargeScreen} from '../../../../constants/platform'
import {LayoutEvent} from '../../../../common-adapters/box'
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
import {indefiniteArticle} from '../../../../util/string'
import AudioRecorder from '../../../audio/audio-recorder.native'

type menuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type State = {expanded: boolean; hasText: boolean}

class _PlatformInput extends PureComponent<PlatformInputPropsInternal, State> {
  private input: null | Kb.PlainInput = null
  private lastText?: string
  private whichMenu?: menuType
  state = {expanded: false, hasText: false}

  private inputSetRef = (ref: null | Kb.PlainInput) => {
    this.input = ref
    this.props.inputSetRef(ref)
    // @ts-ignore this is probably wrong: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31065
    this.props.inputRef.current = ref
  }

  private openFilePicker = () => {
    this.toggleShowingMenu('filepickerpopup')
  }
  private openMoreMenu = () => {
    this.toggleShowingMenu('moremenu')
  }

  private launchNativeImagePicker = (mediaType: 'photo' | 'video' | 'mixed', location: string) => {
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

  private getText = () => {
    return this.lastText || ''
  }

  private onChangeText = (text: string) => {
    this.setState({hasText: !!text})
    this.lastText = text
    this.props.onChangeText(text)
  }

  private onSubmit = () => {
    const text = this.getText()
    if (text) {
      this.props.onSubmit(text)
    }
  }

  private toggleShowingMenu = (menu: menuType) => {
    // Hide the keyboard on mobile when showing the menu.
    NativeKeyboard.dismiss()
    this.whichMenu = menu
    this.props.toggleShowingMenu()
  }

  private onLayout = (p: LayoutEvent) => {
    const {nativeEvent} = p
    const {layout} = nativeEvent
    const {height} = layout
    this.props.setHeight(height)
  }

  private insertMentionMarker = () => {
    if (this.input) {
      const input = this.input
      input.focus()
      input.transformText(
        ({selection: {end, start}, text}) => standardTransformer('@', {position: {end, start}, text}, true),
        true
      )
    }
  }

  private getHintText = () => {
    let hintText = 'Write a message'
    if (this.props.isExploding && isLargeScreen) {
      hintText = 'Exploding message'
    } else if (this.props.isExploding && !isLargeScreen) {
      hintText = 'Exploding'
    } else if (this.props.isEditing) {
      hintText = 'Edit your message'
    } else if (this.props.cannotWrite) {
      hintText = `You must be at least ${indefiniteArticle(this.props.minWriterRole)} ${
        this.props.minWriterRole
      } to post.`
    }
    return hintText
  }

  private getMenu = () => {
    return this.props.showingMenu && this.whichMenu === 'filepickerpopup' ? (
      <FilePickerPopup
        attachTo={this.props.getAttachmentRef}
        visible={this.props.showingMenu}
        onHidden={this.props.toggleShowingMenu}
        onSelect={this.launchNativeImagePicker}
      />
    ) : this.whichMenu === 'moremenu' ? (
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
    )
  }

  private expandInput = () => {
    this.setState(s => ({
      expanded: !s.expanded,
    }))
  }

  render() {
    const commandUpdateStatus = this.props.suggestBotCommandsUpdateStatus !==
      RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank &&
      (this.props.suggestionsVisible ||
        this.props.suggestBotCommandsUpdateStatus === RPCChatTypes.UIBotCommandsUpdateStatusTyp.updating) && (
        <BotCommandUpdateStatus status={this.props.suggestBotCommandsUpdateStatus} />
      )

    const explodingIcon = !this.props.isEditing && !this.props.cannotWrite && (
      <NativeTouchableWithoutFeedback onPress={() => this.toggleShowingMenu('exploding')}>
        <Kb.Box style={explodingIconContainer}>
          {this.props.isExploding ? (
            <Kb.Box2 direction="horizontal" style={styles.exploding} centerChildren={true}>
              <Kb.Text type="BodyTinyBold" negative={true}>
                {formatDurationShort(this.props.explodingModeSeconds * 1000)}
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Icon
              color={this.props.isExploding ? Styles.globalColors.black : null}
              type="iconfont-timer"
              fontSize={22}
            />
          )}
        </Kb.Box>
      </NativeTouchableWithoutFeedback>
    )

    const editing = this.props.isEditing && (
      <Kb.Box style={styles.editingTabStyle}>
        <Kb.Text type="BodySmall">Edit:</Kb.Text>
        <Kb.Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing}>
          Cancel
        </Kb.Text>
      </Kb.Box>
    )

    return (
      <Kb.Box2
        direction="vertical"
        onLayout={this.onLayout}
        fullWidth={true}
        style={
          !this.state.expanded && {
            maxHeight: 145,
          }
        }
      >
        {commandUpdateStatus}
        {this.getMenu()}
        {this.props.showTypingStatus && !this.props.suggestionsVisible && (
          <Typing conversationIDKey={this.props.conversationIDKey} />
        )}
        <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputContainer}>
            {editing}
            <Kb.PlainInput
              autoCorrect={true}
              autoCapitalize="sentences"
              disabled={this.props.cannotWrite ?? false}
              placeholder={this.getHintText()}
              multiline={true}
              onBlur={this.props.onBlur}
              onFocus={this.props.onFocus}
              // TODO: Call onCancelQuoting on text change or selection
              // change to match desktop.
              onChangeText={this.onChangeText}
              onSelectionChange={this.props.onSelectionChange}
              ref={this.inputSetRef}
              style={styles.input}
              textType="Body"
              rowsMin={1}
            />
            <Kb.Icon
              onClick={this.expandInput}
              type={this.state.expanded ? 'iconfont-expand' : 'iconfont-collapse'}
              style={styles.expandIcon}
            />
          </Kb.Box2>
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            gap="small"
            alignItems="flex-end"
            style={styles.actionContainer}
          >
            {explodingIcon}
            <Kb.Icon onClick={this.insertMentionMarker} type="iconfont-mention" />
            <Kb.Icon onClick={this.openFilePicker} type="iconfont-camera" />
            <AudioRecorder conversationIDKey={this.props.conversationIDKey} />
            <Kb.Icon onClick={this.openMoreMenu} type="iconfont-add" />
            <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow} />
            <Kb.Button
              type="Default"
              small={true}
              onClick={this.onSubmit}
              disabled={!this.state.hasText}
              label={this.props.isEditing ? 'Save' : 'Send'}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}
const PlatformInput = AddSuggestors(_PlatformInput)

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      actionContainer: {
        flexShrink: 0,
      },
      actionText: {
        alignSelf: 'flex-end',
        paddingBottom: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.tiny,
      },
      animatedContainer: {
        bottom: 0,
        position: 'absolute',
        right: 0,
      },
      container: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.fastBlank,
        borderTopColor: Styles.globalColors.black_10,
        borderTopWidth: 1,
        flexShrink: 1,
        maxHeight: '100%',
        minHeight: 1,
        overflow: 'hidden',
        padding: Styles.globalMargins.tiny,
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
      expandIcon: {
        marginTop: Styles.globalMargins.xtiny,
      },
      exploding: {
        backgroundColor: Styles.globalColors.black,
        borderRadius: Styles.globalMargins.mediumLarge / 2,
        height: Styles.globalMargins.mediumLarge,
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
        width: Styles.globalMargins.mediumLarge,
      },
      explodingOuterContainer: {
        alignSelf: 'flex-end',
        paddingBottom: isIOS ? 7 : 10,
      },
      input: Styles.platformStyles({
        common: {
          flex: 1,
          marginRight: Styles.globalMargins.tiny,
        },
        isAndroid: {
          // This is to counteract some intrinsic margins the android view has
          marginTop: -8,
        },
      }),
      inputContainer: {
        flexShrink: 1,
        maxHeight: '100%',
        paddingBottom: Styles.globalMargins.tiny,
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
    } as const)
)

// Use manual gap when Kb.Box2 is inserting too many (for children that deliberately render nothing)
const smallGap = <Kb.Box style={styles.smallGap} />

const explodingIconContainer = {
  ...Styles.globalStyles.flexBoxColumn,
}

export default Kb.OverlayParentHOC(PlatformInput)

import * as ImagePicker from 'expo-image-picker'
import * as React from 'react'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {isLargeScreen} from '../../../../constants/platform'
import {LayoutEvent} from '../../../../common-adapters/box'
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
import {
  AnimatedBox2,
  AnimatedIcon,
  AnimationState,
  runToggle,
  runRotateToggle,
} from './platform-input-animation.native'

type menuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type State = {
  animating: boolean // delayed due to setstate, updates after
  afterAnimatingExtraStepWorkaround: boolean // used to twiddle height
  expanded: boolean
  hasText: boolean
}

const defaultMaxHeight = 145
const {block, Value, Clock, add, concat} = Kb.ReAnimated

class _PlatformInput extends React.PureComponent<PlatformInputPropsInternal, State> {
  private input: null | Kb.PlainInput = null
  private lastText?: string
  private whichMenu?: menuType
  private clock = new Clock()
  private animateState = new Value<AnimationState>(AnimationState.none)
  private animateHeight = new Value<number>(defaultMaxHeight)
  // if we should update lastHeight when onLayout happens
  private watchSizeChanges = true
  private lastHeight: undefined | number
  private rotate = new Value<number>(0)
  private rotateClock = new Clock()

  state = {
    afterAnimatingExtraStepWorkaround: false,
    animating: false,
    expanded: false, // updates immediately, used for the icon etc
    hasText: false,
  }

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
    this.watchSizeChanges = true
  }

  private onSubmit = () => {
    const text = this.getText()
    if (text) {
      this.props.onSubmit(text)
      if (this.state.expanded) {
        this.toggleExpandInput()
      }
    }
  }

  private toggleShowingMenu = (menu: menuType) => {
    // Hide the keyboard on mobile when showing the menu.
    Kb.NativeKeyboard.dismiss()
    this.whichMenu = menu
    this.props.toggleShowingMenu()
  }

  private onLayout = (p: LayoutEvent) => {
    const {nativeEvent} = p
    const {layout} = nativeEvent
    const {height} = layout
    if (this.watchSizeChanges) {
      this.lastHeight = height
      this.animateHeight.setValue(height)
    }
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
    if (this.props.isExploding) {
      return isLargeScreen ? `Write an exploding message` : 'Exploding message'
    } else if (this.props.isEditing) {
      return 'Edit your message'
    } else if (this.props.cannotWrite) {
      return `You must be at least ${indefiniteArticle(this.props.minWriterRole)} ${
        this.props.minWriterRole
      } to post.`
    }
    return this.props.inputHintText || 'Write a message'
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

  private onDone = () => {
    this.setState({animating: false}, () => {
      this.setState({afterAnimatingExtraStepWorkaround: false})
    })
  }

  private toggleExpandInput = () => {
    this.watchSizeChanges = false
    // eslint-disable-next-line react/no-access-state-in-setstate
    const nextState = !this.state.expanded
    this.setState({afterAnimatingExtraStepWorkaround: true, expanded: nextState}, () =>
      this.props.onExpanded(nextState)
    )
    this.setState({animating: true}, () => {
      this.animateState.setValue(nextState ? AnimationState.expanding : AnimationState.contracting)
    })
  }

  render() {
    const {suggestionsVisible, suggestBotCommandsUpdateStatus, onCancelEditing, isEditing} = this.props
    const {conversationIDKey, cannotWrite, onBlur, onFocus, onSelectionChange, maxInputArea} = this.props
    const {isExploding, explodingModeSeconds, showTypingStatus} = this.props

    const commandUpdateStatus = suggestBotCommandsUpdateStatus !==
      RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank &&
      (suggestionsVisible ||
        suggestBotCommandsUpdateStatus === RPCChatTypes.UIBotCommandsUpdateStatusTyp.updating) && (
        <BotCommandUpdateStatus status={suggestBotCommandsUpdateStatus} />
      )

    return (
      <AnimatedBox2
        direction="vertical"
        onLayout={this.onLayout}
        fullWidth={true}
        style={[
          {
            flexShrink: 1,
            minHeight: 0,
          },
          this.state.expanded || this.state.animating
            ? {height: this.animateHeight, maxHeight: 9999}
            : // workaround auto height not working?
            this.state.afterAnimatingExtraStepWorkaround
            ? {
                height: this.lastHeight,
                maxHeight: defaultMaxHeight,
              }
            : {height: undefined, maxHeight: defaultMaxHeight},
        ]}
      >
        <Kb.ReAnimated.Code>
          {() => block([runRotateToggle(this.rotateClock, this.animateState, this.rotate)])}
        </Kb.ReAnimated.Code>
        <Kb.ReAnimated.Code key={this.lastHeight}>
          {() =>
            block([
              runToggle(
                this.clock,
                this.animateState,
                this.animateHeight,
                this.lastHeight,
                maxInputArea ?? Styles.dimensionHeight,
                this.onDone
              ),
            ])
          }
        </Kb.ReAnimated.Code>
        {commandUpdateStatus}
        {this.getMenu()}
        {showTypingStatus && !suggestionsVisible && <Typing conversationIDKey={conversationIDKey} />}
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([
            styles.container,
            (this.state.expanded || this.state.animating) && {height: '100%', minHeight: 0},
          ])}
          fullWidth={true}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputContainer}>
            <Kb.PlainInput
              autoCorrect={true}
              autoCapitalize="sentences"
              disabled={cannotWrite ?? false}
              placeholder={this.getHintText()}
              multiline={true}
              onBlur={onBlur}
              onFocus={onFocus}
              // TODO: Call onCancelQuoting on text change or selection
              // change to match desktop.
              onChangeText={this.onChangeText}
              onSelectionChange={onSelectionChange}
              ref={this.inputSetRef}
              style={styles.input}
              textType="Body"
              rowsMin={1}
            />
            <AnimatedExpand expandInput={this.toggleExpandInput} rotate={this.rotate} />
          </Kb.Box2>
          <Buttons
            conversationIDKey={conversationIDKey}
            insertMentionMarker={this.insertMentionMarker}
            openFilePicker={this.openFilePicker}
            openMoreMenu={this.openMoreMenu}
            onSelectionChange={onSelectionChange}
            onSubmit={this.onSubmit}
            hasText={this.state.hasText}
            isEditing={isEditing}
            isExploding={isExploding}
            explodingModeSeconds={explodingModeSeconds}
            cannotWrite={cannotWrite}
            toggleShowingMenu={() => this.toggleShowingMenu('exploding')}
            onCancelEditing={onCancelEditing}
          />
        </Kb.Box2>
      </AnimatedBox2>
    )
  }
}

type ButtonsProps = Pick<
  PlatformInputPropsInternal,
  'conversationIDKey' | 'onSelectionChange' | 'explodingModeSeconds' | 'isExploding' | 'cannotWrite'
> & {
  hasText: boolean
  isEditing: boolean
  openMoreMenu: () => void
  toggleShowingMenu: () => void
  insertMentionMarker: () => void
  openFilePicker: () => void
  onSubmit: () => void
  onCancelEditing: () => void
}

const Buttons = (p: ButtonsProps) => {
  const {conversationIDKey, insertMentionMarker, openFilePicker, openMoreMenu, onSubmit, onCancelEditing} = p
  const {hasText, isEditing, isExploding, explodingModeSeconds, cannotWrite, toggleShowingMenu} = p

  const explodingIcon = !isEditing && !cannotWrite && (
    <Kb.NativeTouchableWithoutFeedback onPress={toggleShowingMenu}>
      <Kb.Box style={styles.explodingWrapper}>
        {isExploding ? (
          <Kb.Box2 direction="horizontal" style={styles.exploding} centerChildren={true}>
            <Kb.Text type="BodyTinyBold" negative={true} style={styles.explodingText}>
              {formatDurationShort(explodingModeSeconds * 1000)}
            </Kb.Text>
          </Kb.Box2>
        ) : (
          <Kb.Icon
            color={isExploding ? Styles.globalColors.black : null}
            type="iconfont-timer"
            fontSize={22}
          />
        )}
      </Kb.Box>
    </Kb.NativeTouchableWithoutFeedback>
  )

  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      gap="small"
      alignItems="center"
      style={styles.actionContainer}
    >
      {isEditing && <Kb.Button mode="Secondary" small={true} onClick={onCancelEditing} label="Cancel" />}
      {explodingIcon}
      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow} />
      {!hasText && (
        <Kb.Box2 direction="horizontal" gap="small" alignItems="flex-end">
          <Kb.Icon onClick={insertMentionMarker} type="iconfont-mention" />
          <Kb.Icon onClick={openFilePicker} type="iconfont-camera" />
          <AudioRecorder conversationIDKey={conversationIDKey} />
          <Kb.Icon onClick={openMoreMenu} type="iconfont-add" />
        </Kb.Box2>
      )}
      {hasText && (
        <Kb.Button
          type="Default"
          small={true}
          onClick={onSubmit}
          disabled={!hasText}
          label={isEditing ? 'Save' : 'Send'}
        />
      )}
    </Kb.Box2>
  )
}

const AnimatedExpand = (p: {expandInput: () => void; rotate: Kb.ReAnimated.Value<number>}) => {
  const {expandInput, rotate} = p
  return (
    <Kb.ClickableBox onClick={expandInput} style={styles.iconContainer}>
      <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.iconTop}>
        <AnimatedIcon
          onClick={expandInput}
          type="iconfont-arrow-full-up"
          fontSize={18}
          style={{
            transform: [{rotate: concat(add(45, rotate), 'deg'), scale: 0.7}],
          }}
          color={Styles.globalColors.black_20}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.iconBottom}>
        <AnimatedIcon
          onClick={expandInput}
          type="iconfont-arrow-full-up"
          fontSize={18}
          style={{
            transform: [
              {
                rotate: concat(add(45, rotate), 'deg'),
                scaleX: -0.7,
                scaleY: -0.7,
              },
            ],
          }}
          color={Styles.globalColors.black_20}
        />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const PlatformInput = AddSuggestors(_PlatformInput)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        flexShrink: 0,
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
        minHeight: 32,
      },
      container: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.fastBlank,
        borderTopColor: Styles.globalColors.black_10,
        borderTopWidth: 1,
        flexGrow: 1,
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
      exploding: {
        backgroundColor: Styles.globalColors.black,
        borderRadius: Styles.globalMargins.mediumLarge / 2,
        height: 28,
        width: 28,
      },
      explodingText: {
        fontSize: 11,
        lineHeight: 16,
      },
      explodingWrapper: {
        height: 30,
        width: 30,
      },
      iconBottom: {
        bottom: 0,
        left: 1,
        position: 'absolute',
      },
      iconContainer: {
        height: 28,
        marginRight: -4,
        position: 'relative',
        width: 28,
      },
      iconTop: {
        position: 'absolute',
        right: 0,
        top: 0,
      },
      input: Styles.platformStyles({
        common: {
          flex: 1,
          flexShrink: 1,
          marginRight: Styles.globalMargins.tiny,
          minHeight: 0,
        },
        isAndroid: {
          // This is to counteract some intrinsic margins the android view has
          marginTop: -8,
        },
      }),
      inputContainer: {
        flexGrow: 1,
        flexShrink: 1,
        maxHeight: '100%',
        paddingBottom: Styles.globalMargins.tiny,
      },
    } as const)
)

export default Kb.OverlayParentHOC(PlatformInput)

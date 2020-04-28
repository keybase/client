import * as ImagePicker from 'expo-image-picker'
import * as React from 'react'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import {isLargeScreen} from '../../../../constants/platform'
import {LayoutEvent} from '../../../../common-adapters/box'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import Typing from './typing/container'
import FilePickerPopup from '../filepicker-popup'
import MoreMenuPopup from './moremenu-popup'
import {PlatformInputPropsInternal} from './platform-input'
import AddSuggestors, {standardTransformer} from '../suggestors'
import {parseUri, launchCameraAsync, launchImageLibraryAsync} from '../../../../util/expo-image-picker'
import {formatDurationShort} from '../../../../util/timestamp'
import {indefiniteArticle} from '../../../../util/string'
import {isOpen} from '../../../../util/keyboard'
import AudioRecorder from '../../../audio/audio-recorder.native'
import {
  AnimatedBox2,
  AnimatedIcon,
  AnimationState,
  runToggle,
  runRotateToggle,
} from './platform-input-animation.native'
import HWKeyboardEvent from 'react-native-hw-keyboard-event'

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

  // Enter should send a message like on desktop, when a hardware keyboard's
  // attached.  On Android we get "hardware" keypresses from soft keyboards,
  // so check whether a soft keyboard's up.
  private handleHardwareEnterPress = (hwKeyEvent: {pressedKey: string}) => {
    switch (hwKeyEvent.pressedKey) {
      case 'enter':
        Styles.isIOS || !isOpen() ? this.onSubmit() : this.insertText('\n')
        break
      case 'shift-enter':
        this.insertText('\n')
    }
  }

  componentDidMount() {
    // @ts-ignore supplied type seems incorrect, has the onHWKeyPressed param as an object
    HWKeyboardEvent.onHWKeyPressed(this.handleHardwareEnterPress)
  }

  componentWillUnmount() {
    HWKeyboardEvent.removeOnHWKeyPressed()
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

  private insertText = (toInsert: string) => {
    if (this.input) {
      const input = this.input
      input.focus()
      input.transformText(
        ({selection: {end, start}, text}) =>
          standardTransformer(toInsert, {position: {end, start}, text}, true),
        true
      )
    }
  }

  private insertMentionMarker = () => {
    this.insertText('@')
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
    const {suggestionsVisible, onCancelEditing, isEditing} = this.props
    const {conversationIDKey, cannotWrite, onBlur, onFocus, onSelectionChange, maxInputArea} = this.props
    const {isExploding, explodingModeSeconds, showTypingStatus} = this.props

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
        {this.getMenu()}
        {showTypingStatus && !suggestionsVisible && <Typing conversationIDKey={conversationIDKey} />}
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([
            styles.container,
            isExploding && styles.explodingContainer,
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
            insertEmoji={this.insertText}
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
  insertEmoji: (emoji: string) => void
  insertMentionMarker: () => void
  openFilePicker: () => void
  onSubmit: () => void
  onCancelEditing: () => void
}

const Buttons = (p: ButtonsProps) => {
  const {
    conversationIDKey,
    insertEmoji,
    insertMentionMarker,
    openFilePicker,
    openMoreMenu,
    onSubmit,
    onCancelEditing,
  } = p
  const {hasText, isEditing, isExploding, explodingModeSeconds, cannotWrite, toggleShowingMenu} = p

  const dispatch = Container.useDispatch()
  const openEmojiPicker = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey, onPickAction: insertEmoji},
            selected: 'chatChooseEmoji',
          },
        ],
      })
    )

  const explodingIcon = !isEditing && !cannotWrite && (
    <Kb.ClickableBox style={styles.explodingWrapper} onClick={toggleShowingMenu}>
      {isExploding ? (
        <Kb.Box2 direction="horizontal" style={styles.exploding} centerChildren={true}>
          <Kb.Text type="BodyTinyBold" negative={true} style={styles.explodingText}>
            {formatDurationShort(explodingModeSeconds * 1000)}
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Icon color={isExploding ? Styles.globalColors.black : null} type="iconfont-timer" />
      )}
    </Kb.ClickableBox>
  )

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.actionContainer}>
      {isEditing && (
        <Kb.Button
          style={styles.editingButton}
          small={true}
          onClick={onCancelEditing}
          label="Cancel"
          type="Dim"
        />
      )}
      {explodingIcon}
      <Kb.Icon padding="tiny" onClick={openEmojiPicker} type="iconfont-emoji" />
      <Kb.Icon padding="tiny" onClick={insertMentionMarker} type="iconfont-mention" />
      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow} />
      {!hasText && (
        <Kb.Box2 direction="horizontal" alignItems="flex-end">
          <Kb.Icon onClick={openFilePicker} padding="tiny" type="iconfont-camera" />
          <AudioRecorder conversationIDKey={conversationIDKey} iconStyle={styles.audioRecorderIconStyle} />
          <Kb.Icon onClick={openMoreMenu} padding="tiny" type="iconfont-add" />
        </Kb.Box2>
      )}
      {hasText && (
        <Kb.Button
          type="Default"
          small={true}
          onClick={onSubmit}
          disabled={!hasText}
          label={isEditing ? 'Save' : 'Send'}
          labelStyle={isExploding ? styles.explodingSendBtnLabel : undefined}
          style={isExploding ? styles.explodingSendBtn : styles.sendBtn}
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
          color={Styles.globalColors.black_35}
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
          color={Styles.globalColors.black_35}
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
        minHeight: 32,
      },
      audioRecorderIconStyle: {
        padding: Styles.globalMargins.tiny,
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
        ...Styles.padding(0, 0, Styles.globalMargins.tiny, 0),
      },
      editingButton: {
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
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
        margin: Styles.globalMargins.xtiny,
        width: 28,
      },
      explodingContainer: {
        borderTopColor: Styles.globalColors.black,
      },
      explodingSendBtn: {
        backgroundColor: Styles.globalColors.black,
        marginRight: Styles.globalMargins.tiny,
      },
      explodingSendBtnLabel: {
        color: Styles.globalColors.white,
      },
      explodingText: {
        fontSize: 11,
        lineHeight: 16,
      },
      explodingWrapper: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        height: 38,
        justifyContent: 'center',
        width: 36,
      },
      iconBottom: {
        bottom: 0,
        left: 1,
        position: 'absolute',
      },
      iconContainer: {
        height: 28,
        marginRight: -Styles.globalMargins.xtiny,
        marginTop: Styles.globalMargins.tiny,
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
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      inputContainer: {
        ...Styles.padding(0, Styles.globalMargins.tiny),
        flexGrow: 1,
        flexShrink: 1,
        maxHeight: '100%',
        paddingBottom: Styles.globalMargins.tiny,
      },
      sendBtn: {
        marginRight: Styles.globalMargins.tiny,
      },
    } as const)
)

export default Kb.OverlayParentHOC(PlatformInput)

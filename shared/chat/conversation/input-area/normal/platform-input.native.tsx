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
import {AnimatedBox2, AnimatedIcon} from './platform-input-animation.native'
import HWKeyboardEvent from 'react-native-hw-keyboard-event'
import {_getNavigator} from '../../../../constants/router2'
import throttle from 'lodash/throttle'
import {useSharedValue, useAnimatedStyle, withTiming} from 'react-native-reanimated'
import {Dimensions} from 'react-native'

type menuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type State = {
  expanded: boolean
  hasText: boolean
}

const normalHeight = 91
const expandedHeight = Dimensions.get('window').height

class _PlatformInput extends React.PureComponent<PlatformInputPropsInternal, State> {
  private input: null | Kb.PlainInput = null
  private lastText?: string
  private whichMenu?: menuType

  state = {
    expanded: false,
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
    if (this.state.hasText !== !!text) {
      this.setState({hasText: !!text})
    }
    this.lastText = text
    this.props.onChangeText(text)
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
    this.setHeightThrottled(height)
  }

  private setHeightThrottled = throttle((h: number) => this.props.setHeight(h))

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

  private toggleExpandInput = () => {
    const nextState = !this.state.expanded
    this.setState({expanded: nextState})
    this.props.onExpanded(nextState)
  }

  render() {
    const {suggestionsVisible, onCancelEditing, isEditing} = this.props
    const {conversationIDKey, cannotWrite, onBlur, onFocus, onSelectionChange} = this.props
    const {isExploding, explodingModeSeconds, showTypingStatus} = this.props

    return (
      <AnimatedContainer expanded={this.state.expanded} onLayout={this.onLayout}>
        {this.getMenu()}
        {showTypingStatus && !suggestionsVisible && <Typing conversationIDKey={conversationIDKey} />}
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([styles.container, isExploding && styles.explodingContainer])}
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
            <AnimatedExpand expanded={this.state.expanded} expandInput={this.toggleExpandInput} />
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
      </AnimatedContainer>
    )
  }
}

const AnimatedContainer = ({children, expanded, onLayout}) => {
  const offset = useSharedValue(expanded ? 1 : 0)
  const as = useAnimatedStyle(() => ({
    maxHeight: withTiming(offset.value ? expandedHeight : normalHeight),
  }))
  React.useEffect(() => {
    offset.value = expanded ? 1 : 0
  }, [expanded, offset])

  return (
    <AnimatedBox2 direction="vertical" onLayout={onLayout} fullWidth={true} style={as}>
      {children}
    </AnimatedBox2>
  )
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
  const openEmojiPicker = React.useCallback(
    () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {conversationIDKey, onPickAction: insertEmoji},
              selected: 'chatChooseEmoji',
            },
          ],
        })
      ),
    [dispatch, conversationIDKey, insertEmoji]
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
        <Kb.Icon
          color={isExploding ? Styles.globalColors.black : null}
          type="iconfont-timer"
          fixOverdraw={true}
        />
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
      <Kb.Icon padding="tiny" onClick={openEmojiPicker} type="iconfont-emoji" fixOverdraw={true} />
      <Kb.Icon padding="tiny" onClick={insertMentionMarker} type="iconfont-mention" fixOverdraw={true} />
      <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexGrow} />
      {!hasText && (
        <Kb.Box2 direction="horizontal" alignItems="flex-end">
          <Kb.Icon onClick={openFilePicker} padding="tiny" type="iconfont-camera" fixOverdraw={true} />
          <AudioRecorder conversationIDKey={conversationIDKey} iconStyle={styles.audioRecorderIconStyle} />
          <Kb.Icon onClick={openMoreMenu} padding="tiny" type="iconfont-add" fixOverdraw={true} />
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

const AnimatedExpand = React.memo((p: {expandInput: () => void; expanded: boolean}) => {
  const {expandInput, expanded} = p
  const offset = useSharedValue(expanded ? 1 : 0)
  const topStyle = useAnimatedStyle(() => ({
    // @ts-ignore
    transform: [{rotate: withTiming(`${offset.value ? 45 + 180 : 45}deg`)}, {scale: 0.7}],
  }))
  const bottomStyle = useAnimatedStyle(() => ({
    // @ts-ignore
    transform: [{rotate: withTiming(`${offset.value ? 45 + 180 : 45}deg`)}, {scaleX: -0.7}, {scaleY: -0.7}],
  }))
  React.useEffect(() => {
    offset.value = expanded ? 1 : 0
  }, [expanded, offset])

  return (
    <Kb.ClickableBox onClick={expandInput} style={styles.iconContainer}>
      <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.iconTop} pointerEvents="none">
        <AnimatedIcon
          fixOverdraw={false}
          type="iconfont-arrow-full-up"
          fontSize={18}
          style={topStyle}
          color={Styles.globalColors.black_35}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.iconBottom} pointerEvents="none">
        <AnimatedIcon
          fixOverdraw={false}
          type="iconfont-arrow-full-up"
          fontSize={18}
          style={bottomStyle}
          color={Styles.globalColors.black_35}
        />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
})

const PlatformInput = AddSuggestors(_PlatformInput)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        flexShrink: 0,
        minHeight: 32,
      },
      audioRecorderIconStyle: {padding: Styles.globalMargins.tiny},
      container: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.fastBlank,
        borderTopColor: Styles.globalColors.black_10,
        borderTopWidth: 1,
        height: '100%',
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
      explodingContainer: {borderTopColor: Styles.globalColors.black},
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
      sendBtn: {marginRight: Styles.globalMargins.tiny},
    } as const)
)

export default Kb.OverlayParentHOC(PlatformInput)

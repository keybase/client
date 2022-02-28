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
import {useSuggestors, standardTransformer} from '../suggestors'
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

type MenuType = 'exploding' | 'filepickerpopup' | 'moremenu'

const defaultMaxHeight = 145
const {block, Value, Clock, add, concat} = Kb.ReAnimated

class PlatformInputInner extends React.PureComponent<PlatformInputPropsInternal> {
  componentDidMount() {
    // Enter should send a message like on desktop, when a hardware keyboard's
    // attached.  On Android we get "hardware" keypresses from soft keyboards,
    // so check whether a soft keyboard's up.
    HWKeyboardEvent.onHWKeyPressed((hwKeyEvent: {pressedKey: string}) => {
      switch (hwKeyEvent.pressedKey) {
        case 'enter':
          Styles.isIOS || !isOpen() ? this.props.onSubmit() : this.insertText('\n')
          break
        case 'shift-enter':
          this.insertText('\n')
      }
    })
  }

  componentWillUnmount() {
    HWKeyboardEvent.removeOnHWKeyPressed()
  }

  private onLayout = (p: LayoutEvent) => {
    const {nativeEvent} = p
    const {layout} = nativeEvent
    const {height} = layout
    if (this.props.watchSizeChanges.current) {
      this.props.lastHeight.current = height
      this.props.animateHeight.current.setValue(height)
    }
    this.props.setHeight(height)
  }

  private insertText = (toInsert: string) => {
    const i = this.props.inputRef.current
    i?.focus()
    i?.transformText(
      ({selection: {end, start}, text}) =>
        standardTransformer(toInsert, {position: {end, start}, text}, true),
      true
    )
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
    return this.props.showingMenu && this.props.whichMenu.current === 'filepickerpopup' ? (
      <FilePickerPopup
        attachTo={this.props.getAttachmentRef}
        visible={this.props.showingMenu}
        onHidden={this.props.toggleShowingMenu}
        onSelect={this.props.launchNativeImagePicker}
      />
    ) : this.props.whichMenu.current === 'moremenu' ? (
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
    this.props.setAnimating(false)
    // still needed?
    // this.setState({afterAnimatingExtraStepWorkaround: false})
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
          this.props.expanded || this.props.animating
            ? {height: this.props.animateHeight.current, maxHeight: 9999}
            : // workaround auto height not working?
            this.props.afterAnimatingExtraStepWorkaround
            ? {
                height: this.props.lastHeight.current,
                maxHeight: defaultMaxHeight,
              }
            : {height: undefined, maxHeight: defaultMaxHeight},
        ]}
      >
        <Kb.ReAnimated.Code>
          {() =>
            block([
              runRotateToggle(
                this.props.rotateClock.current,
                this.props.animateState.current,
                this.props.rotate.current
              ),
            ])
          }
        </Kb.ReAnimated.Code>
        <Kb.ReAnimated.Code key={this.props.lastHeight.current}>
          {() =>
            block([
              runToggle(
                this.props.clock.current,
                this.props.animateState.current,
                this.props.animateHeight.current,
                this.props.lastHeight.current,
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
            (this.props.expanded || this.props.animating) && {height: '100%', minHeight: 0},
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
              onChangeText={(text: string) => {
                this.props.setHasText(!!text)
                this.props.lastText.current = text
                this.props.onChangeText(text)
                this.props.watchSizeChanges.current = true
              }}
              onSelectionChange={onSelectionChange}
              ref={(ref: null | Kb.PlainInput) => {
                this.props.inputSetRef(ref)
                this.props.inputRef.current = ref
              }}
              style={styles.input}
              textType="Body"
              rowsMin={1}
            />
            <AnimatedExpand expandInput={this.props.toggleExpandInput} rotate={this.props.rotate.current} />
          </Kb.Box2>
          <Buttons
            conversationIDKey={conversationIDKey}
            insertEmoji={this.insertText}
            insertMentionMarker={this.insertMentionMarker}
            openFilePicker={() => {
              this.props.ourShowMenu('filepickerpopup')
            }}
            openMoreMenu={() => {
              this.props.ourShowMenu('moremenu')
            }}
            onSelectionChange={onSelectionChange}
            onSubmit={this.props.onSubmit}
            hasText={this.props.hasText}
            isEditing={isEditing}
            isExploding={isExploding}
            explodingModeSeconds={explodingModeSeconds}
            cannotWrite={cannotWrite}
            toggleShowingMenu={() => this.props.ourShowMenu('exploding')}
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

const PlatformInputOuter = (p: any) => {
  const {onExpanded, conversationIDKey, onAttach, onFilePickerError, onSubmit, toggleShowingMenu} = p
  const lastText = React.useRef('')
  const whichMenu = React.useRef<MenuType | undefined>()
  const clock = React.useRef(new Clock())
  const animateState = React.useRef(new Value<AnimationState>(AnimationState.none))
  const animateHeight = React.useRef(new Value<number>(defaultMaxHeight))
  const lastHeight = React.useRef<undefined | number>()
  const rotate = React.useRef(new Value<number>(0))
  const rotateClock = React.useRef(new Clock())

  // if we should update lastHeight when onLayout happens
  const watchSizeChanges = React.useRef(true)

  const [afterAnimatingExtraStepWorkaround, setAfterAnimatingExtraStepWorkaround] = React.useState(false)
  const [animating, setAnimating] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false) // updates immediately, used for the icon etc
  const [hasText, setHasText] = React.useState(false)

  const launchNativeImagePicker = React.useCallback(
    (mediaType: 'photo' | 'video' | 'mixed', location: string) => {
      const handleSelection = (result: ImagePicker.ImagePickerResult) => {
        if (result.cancelled || !conversationIDKey) {
          return
        }
        const filename = parseUri(result)
        if (filename) {
          onAttach([filename])
        }
      }

      switch (location) {
        case 'camera':
          launchCameraAsync(mediaType)
            .then(handleSelection)
            .catch(error => onFilePickerError(new Error(error)))
          break
        case 'library':
          launchImageLibraryAsync(mediaType)
            .then(handleSelection)
            .catch(error => onFilePickerError(new Error(error)))
          break
      }
    },
    [conversationIDKey, onAttach, onFilePickerError]
  )

  const toggleExpandInput = React.useCallback(() => {
    watchSizeChanges.current = false
    const nextState = !expanded
    setAfterAnimatingExtraStepWorkaround(true)
    setExpanded(nextState)
    setAnimating(true)
    animateState.current.setValue(nextState ? AnimationState.expanding : AnimationState.contracting)
  }, [
    watchSizeChanges,
    expanded,
    setAfterAnimatingExtraStepWorkaround,
    setExpanded,
    setAnimating,
    animateState,
  ])

  const onSubmit2 = React.useCallback(() => {
    const text = lastText.current
    if (text) {
      onSubmit(text)
      if (expanded) {
        toggleExpandInput()
      }
    }
  }, [lastText, onSubmit, expanded, toggleExpandInput])

  const ourShowMenu = React.useCallback(
    (menu: MenuType) => {
      // Hide the keyboard on mobile when showing the menu.
      Kb.NativeKeyboard.dismiss()
      whichMenu.current = menu
      toggleShowingMenu()
    },
    [whichMenu, toggleShowingMenu]
  )

  Container.useDepChangeEffect(() => {
    onExpanded(expanded)
  }, [expanded, onExpanded])

  return (
    <PlatformInputInner
      {...p}
      lastText={lastText}
      whichMenu={whichMenu}
      clock={clock}
      animateState={animateState}
      animateHeight={animateHeight}
      watchSizeChanges={watchSizeChanges}
      lastHeight={lastHeight}
      rotate={rotate}
      rotateClock={rotateClock}
      afterAnimatingExtraStepWorkaround={afterAnimatingExtraStepWorkaround}
      setAfterAnimatingExtraStepWorkaround={setAfterAnimatingExtraStepWorkaround}
      animating={animating}
      setAnimating={setAnimating}
      expanded={expanded}
      setExpanded={setExpanded}
      hasText={hasText}
      setHasText={setHasText}
      launchNativeImagePicker={launchNativeImagePicker}
      onSubmit={onSubmit2}
      toggleExpandInput={toggleExpandInput}
      ourShowMenu={ourShowMenu}
    />
  )
}

const PlatformInput = React.forwardRef((p: any, forwardedRef: any) => {
  const {popup, inputRef, onChangeText, onKeyDown, onBlur, onExpanded, onSelectionChange, onFocus} =
    useSuggestors(p)

  return (
    <>
      {popup}
      <PlatformInputOuter
        {...p}
        forwardedRef={forwardedRef}
        inputRef={inputRef}
        onChangeText={onChangeText}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onExpanded={onExpanded}
        onSelectionChange={onSelectionChange}
        onFocus={onFocus}
      />
    </>
  )
})

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

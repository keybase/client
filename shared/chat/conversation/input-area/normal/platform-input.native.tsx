import * as ConfigGen from '../../../../actions/config-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import AudioRecorder from '../../../audio/audio-recorder.native'
import FilePickerPopup from '../filepicker-popup'
import HWKeyboardEvent from 'react-native-hw-keyboard-event'
import MoreMenuPopup from './moremenu-popup'
import SetExplodingMessagePicker from '../../messages/set-explode-popup/container'
import Typing from './typing'
import type * as ImagePicker from 'expo-image-picker'
import type * as Types from '../../../../constants/types/chat2'
import type {LayoutEvent} from '../../../../common-adapters/box'
import type {Props} from './platform-input'
import {NativeKeyboard} from '../../../../common-adapters/mobile.native'
import {formatDurationShort} from '../../../../util/timestamp'
import {isOpen} from '../../../../util/keyboard'
import {parseUri, launchCameraAsync, launchImageLibraryAsync} from '../../../../util/expo-image-picker'
import {standardTransformer} from '../suggestors/common'
import {useSuggestors} from '../suggestors'
import {
  skipAnimations,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from '../../../../common-adapters/reanimated'

const singleLineHeight = 36
const threeLineHeight = 78
const inputAreaHeight = 91

type MenuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type ButtonsProps = Pick<
  Props,
  'conversationIDKey' | 'onSelectionChange' | 'explodingModeSeconds' | 'isExploding' | 'cannotWrite'
> & {
  hasText: boolean
  isEditing: boolean
  toggleShowingMenu: () => void
  insertText: (s: string) => void
  onSubmit: () => void
  ourShowMenu: (m: MenuType) => void
}

const Buttons = (p: ButtonsProps) => {
  const {conversationIDKey, insertText, ourShowMenu, onSubmit} = p
  const {hasText, isEditing, isExploding, explodingModeSeconds, cannotWrite, toggleShowingMenu} = p

  const openFilePicker = React.useCallback(() => {
    ourShowMenu('filepickerpopup')
  }, [ourShowMenu])
  const openMoreMenu = React.useCallback(() => {
    ourShowMenu('moremenu')
  }, [ourShowMenu])

  const insertMentionMarker = React.useCallback(() => {
    insertText('@')
  }, [insertText])

  const dispatch = Container.useDispatch()

  const onCancelEditing = React.useCallback(() => {
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null}))
  }, [conversationIDKey, dispatch])

  const openEmojiPicker = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey, onPickAction: insertText},
            selected: 'chatChooseEmoji',
          },
        ],
      })
    )
  }, [conversationIDKey, dispatch, insertText])

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

const AnimatedIcon = Kb.ReAnimated.createAnimatedComponent(Kb.Icon)
const AnimatedExpand = (() => {
  if (skipAnimations) {
    return React.memo(() => {
      return null
    })
  } else {
    return React.memo((p: {expandInput: () => void; expanded: boolean}) => {
      const {expandInput, expanded} = p
      const offset = useSharedValue(expanded ? 1 : 0)
      const topStyle: any = useAnimatedStyle(() => ({
        // @ts-ignore
        transform: [{rotate: withTiming(`${offset.value ? 45 + 180 : 45}deg`)}, {scale: 0.6}],
      }))
      const bottomStyle: any = useAnimatedStyle(() => ({
        transform: [
          // @ts-ignore
          {rotate: withTiming(`${offset.value ? 45 + 180 : 45}deg`)},
          {scaleX: -0.6},
          {scaleY: -0.6},
        ],
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
  }
})()

type ChatFilePickerProps = {
  attachTo: () => React.Component | null
  showingPopup: boolean
  toggleShowingPopup: () => void
  conversationIDKey: Types.ConversationIDKey
}
const ChatFilePicker = (p: ChatFilePickerProps) => {
  const {attachTo, showingPopup, toggleShowingPopup, conversationIDKey} = p
  const dispatch = Container.useDispatch()
  const launchNativeImagePicker = React.useCallback(
    (mediaType: 'photo' | 'video' | 'mixed', location: string) => {
      const handleSelection = (result: ImagePicker.ImagePickerResult) => {
        if (result.cancelled || !conversationIDKey) {
          return
        }
        const filename = parseUri(result)
        if (filename) {
          const props = {
            conversationIDKey,
            pathAndOutboxIDs: [{outboxID: null, path: filename}],
          }
          dispatch(
            RouteTreeGen.createNavigateAppend({
              path: [{props, selected: 'chatAttachmentGetTitles'}],
            })
          )
        }
      }

      const onFilePickerError = (error: Error) => {
        dispatch(ConfigGen.createFilePickerError({error}))
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
    [dispatch, conversationIDKey]
  )

  return (
    <FilePickerPopup
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      onSelect={launchNativeImagePicker}
    />
  )
}

const PlatformInput = (p: Props) => {
  const [height, setHeight] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false) // updates immediately, used for the icon etc
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const {popup, onChangeText, onBlur, onSelectionChange, onFocus} = useSuggestors({
    conversationIDKey: p.conversationIDKey,
    expanded,
    inputRef,
    onBlur: p.onBlur,
    onChangeText: p.onChangeText,
    onFocus: p.onFocus,
    onKeyDown: p.onKeyDown,
    onSelectionChange: p.onSelectionChange,
    suggestBotCommandsUpdateStatus: p.suggestBotCommandsUpdateStatus,
    suggestionListStyle: Styles.collapseStyles([styles.suggestionList, !!height && {marginBottom: height}]),
    suggestionOverlayStyle: p.suggestionOverlayStyle,
    suggestionSpinnerStyle: Styles.collapseStyles([
      styles.suggestionSpinnerStyle,
      !!height && {marginBottom: height},
    ]),
  })
  const {cannotWrite, conversationIDKey, isEditing, isExploding} = p
  const {onSubmit, explodingModeSeconds, hintText} = p
  const {inputSetRef, showTypingStatus, maxInputArea} = p

  const lastText = React.useRef('')
  const whichMenu = React.useRef<MenuType | undefined>()
  const [hasText, setHasText] = React.useState(false)

  const toggleExpandInput = React.useCallback(() => {
    const nextState = !expanded
    setExpanded(nextState)
  }, [expanded, setExpanded])

  const onSubmit2 = React.useCallback(() => {
    const text = lastText.current
    if (text) {
      onSubmit(text)
      if (expanded) {
        toggleExpandInput()
      }
    }
  }, [lastText, onSubmit, expanded, toggleExpandInput])

  const insertText = React.useCallback(
    (toInsert: string) => {
      const i = inputRef.current
      i?.focus()
      i?.transformText(
        ({selection: {end, start}, text}) =>
          standardTransformer(toInsert, {position: {end, start}, text}, true),
        true
      )
      // TODO likely don't need this with nav 6
      setTimeout(() => {
        i?.focus()
      }, 200)
    },
    [inputRef]
  )

  React.useEffect(() => {
    // Enter should send a message like on desktop, when a hardware keyboard's
    // attached.  On Android we get "hardware" keypresses from soft keyboards,
    // so check whether a soft keyboard's up.
    // @ts-ignore
    HWKeyboardEvent.onHWKeyPressed((hwKeyEvent: any) => {
      switch (hwKeyEvent.pressedKey) {
        case 'enter':
          Styles.isIOS || !isOpen() ? onSubmit2() : insertText('\n')
          break
        case 'shift-enter':
          insertText('\n')
      }
    })
    return () => {
      HWKeyboardEvent.removeOnHWKeyPressed()
    }
  }, [onSubmit2, insertText])

  const {
    popup: menu,
    showingPopup,
    toggleShowingPopup,
  } = Kb.usePopup(
    attachTo => {
      switch (whichMenu.current) {
        case 'filepickerpopup':
          return (
            <ChatFilePicker
              attachTo={attachTo}
              showingPopup={showingPopup}
              toggleShowingPopup={toggleShowingPopup}
              conversationIDKey={conversationIDKey}
            />
          )
        case 'moremenu':
          return (
            <MoreMenuPopup
              conversationIDKey={conversationIDKey}
              onHidden={toggleShowingPopup}
              visible={showingPopup}
            />
          )
        default:
          return (
            <SetExplodingMessagePicker
              attachTo={attachTo}
              conversationIDKey={conversationIDKey}
              onHidden={toggleShowingPopup}
              visible={showingPopup}
            />
          )
      }
    },
    [conversationIDKey]
  )

  const ourShowMenu = React.useCallback(
    (menu: MenuType) => {
      // Hide the keyboard on mobile when showing the menu.
      NativeKeyboard.dismiss()
      whichMenu.current = menu
      toggleShowingPopup()
    },
    [whichMenu, toggleShowingPopup]
  )

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      onLayout={(p: LayoutEvent) => {
        const {nativeEvent} = p
        const {layout} = nativeEvent
        const {height} = layout
        setHeight(height)
      }}
    >
      {popup}
      {menu}
      {showTypingStatus && !popup && <Typing conversationIDKey={conversationIDKey} />}
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.container, isExploding && styles.explodingContainer])}
        fullWidth={true}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputContainer}>
          <AnimatedInput
            autoCorrect={true}
            autoCapitalize="sentences"
            disabled={cannotWrite ?? false}
            placeholder={hintText}
            maxInputArea={maxInputArea}
            multiline={true}
            onBlur={onBlur}
            onFocus={onFocus}
            // TODO: Call onCancelQuoting on text change or selection
            // change to match desktop.
            onChangeText={(text: string) => {
              setHasText(!!text)
              lastText.current = text
              onChangeText(text)
            }}
            onSelectionChange={onSelectionChange}
            ref={(ref: null | Kb.PlainInput) => {
              inputSetRef(ref)
              inputRef.current = ref
            }}
            style={styles.input}
            textType="Body"
            rowsMin={1}
            expanded={expanded}
          />
          <AnimatedExpand expandInput={toggleExpandInput} expanded={expanded} />
        </Kb.Box2>
        <Buttons
          conversationIDKey={conversationIDKey}
          insertText={insertText}
          ourShowMenu={ourShowMenu}
          onSelectionChange={onSelectionChange}
          onSubmit={onSubmit2}
          hasText={hasText}
          isEditing={isEditing}
          isExploding={isExploding}
          explodingModeSeconds={explodingModeSeconds}
          cannotWrite={cannotWrite}
          toggleShowingMenu={() => ourShowMenu('exploding')}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const AnimatedPlainInput = Kb.ReAnimated.createAnimatedComponent(Kb.PlainInput)
const AnimatedInput = (() => {
  if (skipAnimations) {
    return React.forwardRef<any, any>((p: any, ref) => {
      const {expanded, ...rest} = p
      return <AnimatedPlainInput {...rest} ref={ref} style={[rest.style]} />
    })
  } else {
    return React.forwardRef<any, any>((p: any, ref) => {
      const {maxInputArea, expanded, ...rest} = p
      const offset = useSharedValue(expanded ? 1 : 0)
      const maxHeight = maxInputArea - inputAreaHeight - 15
      const as = useAnimatedStyle(() => ({
        maxHeight: withTiming(offset.value ? maxHeight : threeLineHeight),
        minHeight: withTiming(offset.value ? maxHeight : singleLineHeight),
      }))
      React.useEffect(() => {
        offset.value = expanded ? 1 : 0
      }, [expanded, offset])
      return <AnimatedPlainInput {...rest} ref={ref} style={[rest.style, as]} />
    })
  }
})()

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
      explodingSendBtnLabel: {color: Styles.globalColors.white},
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
      suggestionList: Styles.platformStyles({
        isMobile: {
          backgroundColor: Styles.globalColors.white,
          borderColor: Styles.globalColors.black_10,
          borderStyle: 'solid',
          borderTopWidth: 3,
          maxHeight: '50%',
          overflow: 'hidden',
        },
      }),
      suggestionSpinnerStyle: Styles.platformStyles({
        isMobile: {
          bottom: Styles.globalMargins.small,
          position: 'absolute',
          right: Styles.globalMargins.small,
        },
      }),
    } as const)
)

export default PlatformInput

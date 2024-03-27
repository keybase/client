import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import AudioRecorder from '@/chat/audio/audio-recorder.native'
import FilePickerPopup from '../filepicker-popup'
import HWKeyboardEvent from 'react-native-hw-keyboard-event'
import MoreMenuPopup from './moremenu-popup'
import SetExplodingMessagePicker from '@/chat/conversation/messages/set-explode-popup/container'
import Typing from './typing'
import type * as ImagePicker from 'expo-image-picker'
import type {LayoutEvent} from '@/common-adapters/box'
import type {Props} from './platform-input'
import {Keyboard} from 'react-native'
import {formatDurationShort} from '@/util/timestamp'
import {isOpen} from '@/util/keyboard'
import {launchCameraAsync, launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {standardTransformer} from '../suggestors/common'
import {useSuggestors} from '../suggestors'
import {MaxInputAreaContext} from '../../input-area/normal/max-input-area-context'
import {
  createAnimatedComponent,
  skipAnimations,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from '@/common-adapters/reanimated'
import logger from '@/logger'
import {AudioSendWrapper} from '@/chat/audio/audio-send.native'
import {usePickerState} from '@/chat/emoji-picker/use-picker'
import type {Props as PlainInputProps} from '@/common-adapters/plain-input'

const singleLineHeight = 36
const threeLineHeight = 78
const inputAreaHeight = 91

type MenuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type ButtonsProps = Pick<
  Props,
  'explodingModeSeconds' | 'isExploding' | 'cannotWrite' | 'onCancelEditing'
> & {
  hasText: boolean
  isEditing: boolean
  toggleShowingMenu: () => void
  insertText: (s: string) => void
  onSubmit: () => void
  ourShowMenu: (m: MenuType) => void
  onSelectionChange?: (p: {start: number | null; end: number | null}) => void
  showAudioSend: boolean
  setShowAudioSend: (s: boolean) => void
}

const Buttons = React.memo(function Buttons(p: ButtonsProps) {
  const {insertText, ourShowMenu, onSubmit, onCancelEditing} = p
  const {hasText, isEditing, isExploding, explodingModeSeconds, cannotWrite, toggleShowingMenu} = p
  const {showAudioSend, setShowAudioSend} = p

  const openFilePicker = React.useCallback(() => {
    ourShowMenu('filepickerpopup')
  }, [ourShowMenu])
  const openMoreMenu = React.useCallback(() => {
    ourShowMenu('moremenu')
  }, [ourShowMenu])

  const insertMentionMarker = React.useCallback(() => {
    insertText('@')
  }, [insertText])

  const pickKey = 'chatInput'
  const {emojiStr} = usePickerState(s => s.pickerMap.get(pickKey)) ?? {emojiStr: ''}
  const updatePickerMap = usePickerState(s => s.dispatch.updatePickerMap)

  const [lastEmoji, setLastEmoji] = React.useState('')
  if (lastEmoji !== emojiStr) {
    setTimeout(() => {
      setLastEmoji(emojiStr)
      emojiStr && insertText(emojiStr + ' ')
      updatePickerMap(pickKey, undefined)
    }, 1)
  }

  const navigateAppend = C.Chat.useChatNavigateAppend()
  const openEmojiPicker = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, pickKey},
      selected: 'chatChooseEmoji',
    }))
  }, [navigateAppend])

  const explodingIcon = !isEditing && !cannotWrite && (
    <Kb.ClickableBox style={styles.explodingWrapper} onClick={toggleShowingMenu}>
      {isExploding ? (
        <Kb.Box2 direction="horizontal" style={styles.exploding} centerChildren={true}>
          <Kb.Text type="BodyTinyBold" negative={true} style={styles.explodingText}>
            {formatDurationShort(explodingModeSeconds * 1000)}
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Icon color={undefined} type="iconfont-timer" fixOverdraw={true} />
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
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexGrow} />
      {!hasText && (
        <Kb.Box2 direction="horizontal" alignItems="flex-end">
          <Kb.Icon onClick={openFilePicker} padding="tiny" type="iconfont-camera" fixOverdraw={true} />
          <AudioRecorder showAudioSend={showAudioSend} setShowAudioSend={setShowAudioSend} />
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
})

const AnimatedIcon = createAnimatedComponent(Kb.Icon)
const AnimatedExpand = (() => {
  if (skipAnimations) {
    return React.memo(function AnimatedExpand() {
      return null
    })
  } else {
    return React.memo(function AnimatedExpand(p: {expandInput: () => void; expanded: boolean}) {
      const {expandInput, expanded} = p
      const offset = useSharedValue(expanded ? 1 : 0)
      const topStyle = useAnimatedStyle(() => ({
        transform: [{rotate: withTiming(`${offset.value ? 45 + 180 : 45}deg`)}, {scale: 0.6}],
      }))
      const bottomStyle = useAnimatedStyle(() => ({
        transform: [
          {rotate: withTiming(`${offset.value ? 45 + 180 : 45}deg`)},
          {scaleX: -0.6},
          {scaleY: -0.6},
        ],
      }))
      const [lastExpanded, setLastExpanded] = React.useState(expanded)
      if (lastExpanded !== expanded) {
        setLastExpanded(expanded)
        offset.value = expanded ? 1 : 0
      }

      return (
        <Kb.ClickableBox onClick={expandInput} style={styles.iconContainer}>
          <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.iconTop} pointerEvents="none">
            <AnimatedIcon
              fixOverdraw={false}
              type="iconfont-arrow-full-up"
              fontSize={18}
              style={topStyle}
              color={Kb.Styles.globalColors.black_35}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.iconBottom} pointerEvents="none">
            <AnimatedIcon
              fixOverdraw={false}
              type="iconfont-arrow-full-up"
              fontSize={18}
              style={bottomStyle}
              color={Kb.Styles.globalColors.black_35}
            />
          </Kb.Box2>
        </Kb.ClickableBox>
      )
    })
  }
})()

type ChatFilePickerProps = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  showingPopup: boolean
  hidePopup: () => void
}
const ChatFilePicker = (p: ChatFilePickerProps) => {
  const {attachTo, showingPopup, hidePopup} = p
  const conversationIDKey = C.useChatContext(s => s.id)
  const filePickerError = C.useConfigState(s => s.dispatch.filePickerError)
  const navigateAppend = C.Chat.useChatNavigateAppend()
  const launchNativeImagePicker = React.useCallback(
    (mediaType: 'photo' | 'video' | 'mixed', location: string) => {
      const f = async () => {
        const handleSelection = (result: ImagePicker.ImagePickerResult) => {
          if (result.canceled || result.assets.length === 0 || !conversationIDKey) {
            return
          }
          const pathAndOutboxIDs = result.assets.map(a => ({path: a.uri}))
          navigateAppend(conversationIDKey => ({
            props: {conversationIDKey, pathAndOutboxIDs},
            selected: 'chatAttachmentGetTitles',
          }))
        }

        switch (location) {
          case 'camera':
            try {
              const res = await launchCameraAsync(mediaType)
              handleSelection(res)
            } catch (error) {
              filePickerError(new Error(String(error)))
            }
            break
          case 'library':
            try {
              const res = await launchImageLibraryAsync(mediaType, true, true)
              handleSelection(res)
            } catch (error) {
              filePickerError(new Error(String(error)))
            }
            break
        }
      }
      C.ignorePromise(f())
    },
    [navigateAppend, conversationIDKey, filePickerError]
  )

  return (
    <FilePickerPopup
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={hidePopup}
      onSelect={launchNativeImagePicker}
    />
  )
}

const PlatformInput = (p: Props) => {
  const [showAudioSend, setShowAudioSend] = React.useState(false)
  const [height, setHeight] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false) // updates immediately, used for the icon etc
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const silentInput = React.useRef<Kb.PlainInput | null>(null)
  const suggestionListStyle = React.useMemo(() => {
    return Kb.Styles.collapseStyles([styles.suggestionList, !!height && {marginBottom: height}])
  }, [height])
  const suggestionSpinnerStyle = React.useMemo(() => {
    return Kb.Styles.collapseStyles([styles.suggestionSpinnerStyle, !!height && {marginBottom: height}])
  }, [height])
  const {popup, onChangeText, onBlur, onSelectionChange, onFocus} = useSuggestors({
    expanded,
    inputRef,
    onChangeText: p.onChangeText,
    suggestBotCommandsUpdateStatus: p.suggestBotCommandsUpdateStatus,
    suggestionListStyle,
    suggestionOverlayStyle: p.suggestionOverlayStyle,
    suggestionSpinnerStyle,
  })
  const {cannotWrite, isEditing, isExploding} = p
  const {onSubmit, explodingModeSeconds, hintText, onCancelEditing} = p
  const {inputSetRef, showTypingStatus} = p

  const lastText = React.useRef('')
  const whichMenu = React.useRef<MenuType | undefined>()
  const [hasText, setHasText] = React.useState(false)

  const toggleExpandInput = React.useCallback(() => {
    const nextState = !expanded
    setExpanded(nextState)
  }, [expanded, setExpanded])

  const reallySend = React.useCallback(() => {
    const text = inputRef.current?.value
    if (text) {
      onSubmit(text)
      if (expanded) {
        toggleExpandInput()
      }
    }
  }, [expanded, onSubmit, toggleExpandInput])

  // on ios we want to have the autocorrect fill in (especially if its the last word) so we must lose focus
  // in order to not have the keyboard flicker we move focus to a hidden input and back, then submit
  const submitQueued = React.useRef(false)
  const onQueueSubmit = React.useCallback(() => {
    const text = lastText.current
    if (text) {
      submitQueued.current = true
      if (C.isIOS) {
        silentInput.current?.focus()
        inputRef.current?.focus()
      } else {
        reallySend()
      }
    }
  }, [reallySend])

  const onFocusAndMaybeSubmit = React.useCallback(() => {
    // need to submit?
    if (C.isIOS && submitQueued.current) {
      submitQueued.current = false
      reallySend()
    }
    onFocus()
  }, [onFocus, reallySend])

  const insertText = React.useCallback(
    (toInsert: string) => {
      const i = inputRef.current
      i?.focus()
      i?.transformText(
        ({selection: {end, start}, text}) =>
          standardTransformer(toInsert, {position: {end, start}, text}, true),
        true
      )
    },
    [inputRef]
  )

  React.useEffect(() => {
    // Enter should send a message like on desktop, when a hardware keyboard's
    // attached.  On Android we get "hardware" keypresses from soft keyboards,
    // so check whether a soft keyboard's up.
    const cb = (hwKeyEvent: {pressedKey: string}) => {
      switch (hwKeyEvent.pressedKey) {
        case 'enter':
          Kb.Styles.isIOS || !isOpen() ? onQueueSubmit() : insertText('\n')
          break
        case 'shift-enter':
          insertText('\n')
      }
    }
    HWKeyboardEvent.onHWKeyPressed(cb as any)
    return () => {
      HWKeyboardEvent.removeOnHWKeyPressed()
    }
  }, [onQueueSubmit, insertText])

  const makePopup = React.useCallback((p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    switch (whichMenu.current) {
      case 'filepickerpopup':
        return <ChatFilePicker attachTo={attachTo} showingPopup={true} hidePopup={hidePopup} />
      case 'moremenu':
        return <MoreMenuPopup onHidden={hidePopup} visible={true} />
      default:
        return <SetExplodingMessagePicker attachTo={attachTo} onHidden={hidePopup} visible={true} />
    }
  }, [])

  const {popup: menu, showPopup} = Kb.usePopup2(makePopup)

  const ourShowMenu = React.useCallback(
    (menu: MenuType) => {
      // Hide the keyboard on mobile when showing the menu.
      Keyboard.dismiss()
      whichMenu.current = menu
      showPopup()
    },
    [whichMenu, showPopup]
  )

  const openExplodingMenu = React.useCallback(() => {
    ourShowMenu('exploding')
  }, [ourShowMenu])

  const navigateAppend = C.Chat.useChatNavigateAppend()
  const onPasteImage = React.useCallback(
    (uri: string) => {
      try {
        const pathAndOutboxIDs = [{path: uri}]
        navigateAppend(conversationIDKey => ({
          props: {conversationIDKey, pathAndOutboxIDs},
          selected: 'chatAttachmentGetTitles',
        }))
      } catch (e) {
        logger.info('onPasteImage error', e)
      }
    },
    [navigateAppend]
  )

  const onLayout = React.useCallback((p: LayoutEvent) => {
    const {nativeEvent} = p
    const {layout} = nativeEvent
    const {height} = layout
    setHeight(height)
  }, [])

  const onAnimatedInputRef = React.useCallback(
    (ref: Kb.PlainInput | null) => {
      inputSetRef.current = ref
      inputRef.current = ref
    },
    [inputSetRef, inputRef]
  )
  const aiOnChangeText = React.useCallback(
    (text: string) => {
      setHasText(!!text)
      lastText.current = text
      onChangeText(text)
    },
    [setHasText, onChangeText]
  )

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} onLayout={onLayout} style={styles.outerContainer}>
        {popup}
        {menu}
        {showTypingStatus && !popup && <Typing />}
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([styles.container, isExploding && styles.explodingContainer])}
          fullWidth={true}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputContainer}>
            {/* in order to get auto correct submit working we move focus to this and then back so we can 'blur' without losing keyboard */}
            <Kb.PlainInput key="silent" ref={silentInput} style={styles.hidden} />
            <AnimatedInput
              onPasteImage={onPasteImage}
              autoCorrect={true}
              autoCapitalize="sentences"
              disabled={cannotWrite}
              placeholder={hintText}
              multiline={true}
              onBlur={onBlur}
              onFocus={onFocusAndMaybeSubmit}
              onChangeText={aiOnChangeText}
              onSelectionChange={onSelectionChange}
              ref={onAnimatedInputRef}
              style={styles.input}
              textType="Body"
              rowsMin={1}
              expanded={expanded}
            />
            <AnimatedExpand expandInput={toggleExpandInput} expanded={expanded} />
          </Kb.Box2>
          <Buttons
            insertText={insertText}
            ourShowMenu={ourShowMenu}
            onCancelEditing={onCancelEditing}
            onSelectionChange={onSelectionChange}
            onSubmit={onQueueSubmit}
            hasText={hasText}
            isEditing={isEditing}
            isExploding={isExploding}
            explodingModeSeconds={explodingModeSeconds}
            cannotWrite={cannotWrite}
            toggleShowingMenu={openExplodingMenu}
            showAudioSend={showAudioSend}
            setShowAudioSend={setShowAudioSend}
          />
        </Kb.Box2>
      </Kb.Box2>
      {showAudioSend && (
        <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical" style={styles.sendWrapper}>
          <AudioSendWrapper />
        </Kb.Box2>
      )}
    </>
  )
}

const AnimatedPlainInput = createAnimatedComponent(Kb.PlainInput)

const AnimatedInput = (() => {
  if (skipAnimations) {
    return React.memo(
      React.forwardRef<Kb.PlainInput, PlainInputProps & {expanded: boolean}>(function AnimatedInput(p, ref) {
        const {expanded, ...rest} = p
        return <AnimatedPlainInput {...rest} ref={ref} style={[rest.style]} />
      })
    )
  } else {
    return React.memo(
      React.forwardRef<Kb.PlainInput, PlainInputProps & {expanded: boolean}>(function AnimatedInput(p, ref) {
        const maxInputArea = React.useContext(MaxInputAreaContext)
        const {expanded, ...rest} = p
        const [lastExpanded, setLastExpanded] = React.useState(expanded)
        const offset = useSharedValue(expanded ? 1 : 0)
        const maxHeight = maxInputArea - inputAreaHeight - 15
        const as = useAnimatedStyle(() => ({
          maxHeight: withTiming(offset.value ? maxHeight : threeLineHeight),
          minHeight: withTiming(offset.value ? maxHeight : singleLineHeight),
        }))
        if (expanded !== lastExpanded) {
          setLastExpanded(expanded)
          offset.value = expanded ? 1 : 0
        }
        return <AnimatedPlainInput {...rest} ref={ref} style={[p.style, as]} />
      })
    )
  }
})()

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        flexShrink: 0,
        minHeight: 32,
      },
      container: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.fastBlank,
        borderTopColor: Kb.Styles.globalColors.black_10,
        borderTopWidth: 1,
        minHeight: 1,
        overflow: 'hidden',
        ...Kb.Styles.padding(0, 0, Kb.Styles.globalMargins.tiny, 0),
      },
      editingButton: {
        marginLeft: Kb.Styles.globalMargins.tiny,
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      editingTabStyle: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        backgroundColor: Kb.Styles.globalColors.yellowOrYellowAlt,
        flexShrink: 0,
        height: '100%',
        minWidth: 32,
        padding: Kb.Styles.globalMargins.xtiny,
      },
      exploding: {
        backgroundColor: Kb.Styles.globalColors.black,
        borderRadius: Kb.Styles.globalMargins.mediumLarge / 2,
        height: 28,
        margin: Kb.Styles.globalMargins.xtiny,
        width: 28,
      },
      explodingContainer: {borderTopColor: Kb.Styles.globalColors.black},
      explodingSendBtn: {
        backgroundColor: Kb.Styles.globalColors.black,
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      explodingSendBtnLabel: {color: Kb.Styles.globalColors.white},
      explodingText: {
        fontSize: 11,
        lineHeight: 16,
      },
      explodingWrapper: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        height: 38,
        justifyContent: 'center',
        width: 36,
      },
      hidden: {display: 'none'},
      iconBottom: {
        bottom: 0,
        left: 1,
        position: 'absolute',
      },
      iconContainer: {
        height: 28,
        marginRight: -Kb.Styles.globalMargins.xtiny,
        marginTop: Kb.Styles.globalMargins.tiny,
        position: 'relative',
        width: 28,
      },
      iconTop: {
        position: 'absolute',
        right: 0,
        top: 0,
      },
      input: Kb.Styles.platformStyles({
        common: {
          flex: 1,
          flexShrink: 1,
          marginRight: Kb.Styles.globalMargins.tiny,
          minHeight: 0,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      inputContainer: {
        ...Kb.Styles.padding(0, Kb.Styles.globalMargins.tiny),
        flexGrow: 1,
        flexShrink: 1,
        maxHeight: '100%',
        paddingBottom: Kb.Styles.globalMargins.tiny,
      },
      outerContainer: {position: 'relative'},
      sendBtn: {marginRight: Kb.Styles.globalMargins.tiny},
      sendWrapper: {backgroundColor: Kb.Styles.globalColors.white_90, position: 'absolute'},
      suggestionList: Kb.Styles.platformStyles({
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.white,
          borderColor: Kb.Styles.globalColors.black_10,
          borderStyle: 'solid',
          borderTopWidth: 3,
          maxHeight: '50%',
          overflow: 'hidden',
        },
      }),
      suggestionSpinnerStyle: Kb.Styles.platformStyles({
        isMobile: {
          bottom: Kb.Styles.globalMargins.small,
          position: 'absolute',
          right: Kb.Styles.globalMargins.small,
        },
      }),
    }) as const
)

export default PlatformInput

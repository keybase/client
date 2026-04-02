import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import AudioRecorder from '@/chat/audio/audio-recorder.native'
import FilePickerPopup from '../filepicker-popup'
import MoreMenuPopup from './moremenu-popup.native'
import SetExplodingMessagePicker from './set-explode-popup'
import Typing from './typing'
import logger from '@/logger'
import type * as ImagePicker from 'expo-image-picker'
import type {LayoutEvent} from '@/common-adapters/box'
import type {Props as InputLowLevelProps, PlatformInputProps as Props, TextInfo, RefType} from './input'
import {AudioSendWrapper} from '@/chat/audio/audio-send.native'
import {Keyboard, TextInput, type NativeSyntheticEvent, type TextInputSelectionChangeEventData, useColorScheme} from 'react-native'
import {MaxInputAreaContext} from './max-input-area-context'
import {useAnimatedKeyboard} from 'react-native-keyboard-controller'
import {
  default as Animated,
  skipAnimations,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from '@/common-adapters/reanimated'
import {formatDurationShort} from '@/util/timestamp'
import {getTextStyle} from '@/common-adapters/text.styles'
import {launchCameraAsync, launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {onHWKeyPressed, registerPasteImage, removeOnHWKeyPressed} from 'react-native-kb'
import {pickDocumentsAsync} from '@/util/expo-document-picker.native'
import {standardTransformer} from '../suggestors/common'
import {useConfigState} from '@/stores/config'
import {usePickerState} from '@/chat/emoji-picker/use-picker'
import {useSuggestors} from '../suggestors'

// Low-level TextInput wrapper

export function Input(p: InputLowLevelProps) {
  const {style: _style, onChangeText: _onChangeText, multiline, placeholder, ref} = p
  const {textType = 'Body', rowsMax, rowsMin, padding, disabled, onPasteImage} = p
  const {
    autoFocus: _autoFocus,
    autoCorrect,
    autoCapitalize,
    onBlur,
    onFocus,
    onSelectionChange: _onSelectionChange,
  } = p

  const isDarkMode = useColorScheme() === 'dark'
  const [autoFocus, setAutoFocus] = React.useState(_autoFocus)
  const [value, setValue] = React.useState('')
  const [selection, setSelection] = React.useState<{start: number; end?: number | undefined} | undefined>(
    undefined
  )
  const inputRef = React.useRef<TextInput | null>(null)

  const setInputRef = (ti: TextInput | null) => {
    inputRef.current = ti
  }

  const onChangeTextRef = React.useRef(_onChangeText)
  React.useEffect(() => {
    onChangeTextRef.current = _onChangeText
  })
  const [onChangeText] = React.useState(() => (s: string) => {
    setValue(s)
    onChangeTextRef.current?.(s)
  })
  const onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(e.nativeEvent.selection)
    _onSelectionChange?.(e)
  }

  React.useImperativeHandle(ref, () => {
    const i = inputRef.current
    return {
      blur: () => {
        i?.blur()
      },
      clear: () => {
        setValue('')
        onChangeText('')
        setAutoFocus(true)
      },
      focus: () => {
        i?.focus()
      },
      getSelection: () => {
        return selection
      },
      isFocused: () => !!inputRef.current?.isFocused(),
      transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean): void => {
        const ti = fn({selection, text: value})
        if (!reflectChange) {
          return
        }
        onChangeText(ti.text)
        setSelection(ti.selection)
      },
      get value() {
        return value
      },
    }
  }, [onChangeText, selection, value])

  const style = (() => {
    let textStyle = getTextStyle(textType, isDarkMode)
    // RN TextInput plays better without this
    if (Kb.Styles.isIOS) {
      const {lineHeight, ...rest} = textStyle
      textStyle = rest
    }
    const commonStyle = Kb.Styles.collapseStyles([inputLowLevelStyles.common, textStyle])

    const lineHeight = textStyle.lineHeight
    let lineStyle = new Array<Kb.Styles.StylesCrossPlatform>()
    if (multiline) {
      const defaultRowsToShow = Math.min(2, rowsMax ?? 2)
      const paddingStyles = padding ? Kb.Styles.padding(Kb.Styles.globalMargins[padding]) : {}
      lineStyle = [
        inputLowLevelStyles.multiline,
        {
          minHeight: (rowsMin || defaultRowsToShow) * (lineHeight ?? 0),
        },
        !!rowsMax && {maxHeight: rowsMax * (lineHeight ?? 0)},
        paddingStyles,
      ]
    } else {
      lineStyle = [inputLowLevelStyles.singleline, {maxHeight: lineHeight, minHeight: lineHeight}]
    }

    return Kb.Styles.collapseStyles([commonStyle, ...lineStyle, _style])
  })()

  const onPasteImageImpl = (uris: Array<string>) => {
    if (onPasteImage) {
      onPasteImage(uris)
    }
  }

  const onPaste = onPasteImage ? onPasteImageImpl : undefined

  React.useEffect(() => {
    if (!onPaste) return
    const dereg = registerPasteImage(uris => {
      Keyboard.dismiss()
      onPaste(uris)
    })
    return () => {
      dereg()
    }
  }, [onPaste])

  return (
    <TextInput
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      autoFocus={autoFocus}
      blurOnSubmit={false}
      multiline={multiline}
      onBlur={onBlur}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onSelectionChange={onSelectionChange}
      placeholder={placeholder}
      readOnly={disabled}
      ref={setInputRef}
      selection={selection}
      style={style}
      value={value}
    />
  )
}

const inputLowLevelStyles = Kb.Styles.styleSheetCreate(() => ({
  common: {borderWidth: 0, flexGrow: 1},
  multiline: Kb.Styles.platformStyles({
    isMobile: {
      height: undefined,
      textAlignVertical: 'top', // android centers by default
    },
  }),
  singleline: {padding: 0},
}))

// Sub-components

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

const Buttons = function Buttons(p: ButtonsProps) {
  const {insertText, ourShowMenu, onSubmit, onCancelEditing} = p
  const {hasText, isEditing, isExploding, explodingModeSeconds, cannotWrite, toggleShowingMenu} = p
  const {showAudioSend, setShowAudioSend} = p

  const openFilePicker = () => {
    ourShowMenu('filepickerpopup')
  }
  const openMoreMenu = () => {
    ourShowMenu('moremenu')
  }

  const insertMentionMarker = () => {
    insertText('@')
  }

  const pickKey = 'chatInput'
  const emojiStr = usePickerState(s => s.pickerMap.get(pickKey)?.emojiStr) ?? ''
  const updatePickerMap = usePickerState(s => s.dispatch.updatePickerMap)

  const [lastEmoji, setLastEmoji] = React.useState('')
  React.useEffect(() => {
    if (lastEmoji === emojiStr) {
      return
    }
    setLastEmoji(emojiStr)
    emojiStr && insertText(emojiStr + ' ')
    updatePickerMap(pickKey, undefined)
  }, [emojiStr, insertText, lastEmoji, updatePickerMap])

  const navigateAppend = Chat.useChatNavigateAppend()
  const openEmojiPicker = () => {
    navigateAppend(conversationIDKey => ({
      name: 'chatChooseEmoji',
      params: {conversationIDKey, pickKey},
    }))
  }

  const explodingIcon = !isEditing && !cannotWrite && (
    <Kb.ClickableBox style={styles.explodingWrapper} onClick={toggleShowingMenu}>
      {isExploding ? (
        <Kb.Box2 direction="horizontal" style={styles.exploding} centerChildren={true}>
          <Kb.Text type="BodyTinyBold" negative={true} style={styles.explodingText}>
            {formatDurationShort(explodingModeSeconds * 1000)}
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Icon color={undefined} type="iconfont-timer" />
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
      <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexGrow} />
      {!hasText && (
        <Kb.Box2 direction="horizontal" alignItems="flex-end">
          <Kb.Icon onClick={openFilePicker} padding="tiny" type="iconfont-camera" />
          <AudioRecorder showAudioSend={showAudioSend} setShowAudioSend={setShowAudioSend} />
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
          style={isExploding ? styles.explodingSendBtn : styles.sendBtn}
        />
      )}
    </Kb.Box2>
  )
}

const AnimatedExpand = (() => {
  'use no memo'
  if (skipAnimations) {
    return function AnimatedExpand() {
      return null
    }
  } else {
    return function AnimatedExpand(p: {expandInput: () => void; expanded: boolean}) {
      'use no memo'
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
      const lastExpandedRef = React.useRef(expanded)
      React.useEffect(() => {
        if (lastExpandedRef.current !== expanded) {
          lastExpandedRef.current = expanded
          offset.set(expanded ? 1 : 0)
        }
      }, [expanded, offset])

      return (
        <Kb.ClickableBox onClick={expandInput} style={styles.iconContainer}>
          <Animated.View style={[styles.iconTop, topStyle]} pointerEvents="none">
            <Kb.Icon
              type="iconfont-arrow-full-up"
              fontSize={18}
              color={Kb.Styles.globalColors.black_35}
            />
          </Animated.View>
          <Animated.View style={[styles.iconBottom, bottomStyle]} pointerEvents="none">
            <Kb.Icon
              type="iconfont-arrow-full-up"
              fontSize={18}
              color={Kb.Styles.globalColors.black_35}
            />
          </Animated.View>
        </Kb.ClickableBox>
      )
    }
  }
})()

type ChatFilePickerProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  showingPopup: boolean
  hidePopup: () => void
}
const ChatFilePicker = (p: ChatFilePickerProps) => {
  const {attachTo, showingPopup, hidePopup} = p
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const filePickerError = useConfigState(s => s.dispatch.filePickerError)
  const navigateAppend = Chat.useChatNavigateAppend()
  const launchNativeImagePicker = (mediaType: 'photo' | 'video' | 'mixed' | 'file', location: string) => {
    const f = async () => {
      const handleSelection = (result: ImagePicker.ImagePickerResult) => {
        if (result.canceled || result.assets.length === 0 || !conversationIDKey) {
          return
        }
        const pathAndOutboxIDs = result.assets.map(a => ({path: a.uri}))
        navigateAppend(conversationIDKey => ({
          name: 'chatAttachmentGetTitles',
          params: {conversationIDKey, pathAndOutboxIDs},
        }))
      }

      switch (location) {
        case 'camera':
          try {
            const res = await launchCameraAsync(mediaType as 'photo' | 'video' | 'mixed')
            handleSelection(res)
          } catch (error) {
            filePickerError(new Error(String(error)))
          }
          break
        case 'library':
          try {
            const res = await launchImageLibraryAsync(mediaType as 'photo' | 'video' | 'mixed', true, true)
            handleSelection(res)
          } catch (error) {
            filePickerError(new Error(String(error)))
          }
          break
        case 'file':
          try {
            const res = await pickDocumentsAsync(true)
            if (!res.canceled && res.assets.length > 0) {
              const pathAndOutboxIDs = res.assets.map(a => ({path: a.uri}))
              navigateAppend(conversationIDKey => ({
                name: 'chatAttachmentGetTitles',
                params: {conversationIDKey, pathAndOutboxIDs},
              }))
            }
          } catch (error) {
            filePickerError(new Error(String(error)))
          }
          break
      }
    }
    C.ignorePromise(f())
  }

  return (
    <FilePickerPopup
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={hidePopup}
      onSelect={launchNativeImagePicker}
    />
  )
}

type AnimatedInputProps = Omit<InputLowLevelProps, 'ref'> & {expanded: boolean; inputRef?: React.Ref<RefType>}
const AnimatedInput = (() => {
  if (skipAnimations) {
    return function AnimatedInput(p: AnimatedInputProps) {
      const {expanded, inputRef, ...rest} = p
      return (
        <Animated.View style={[p.style, rest.style]}>
          <Input multiline={true} {...rest} ref={inputRef} style={styles.inputInner} />
        </Animated.View>
      )
    }
  } else {
    return function AnimatedInput(p: AnimatedInputProps) {
      'use no memo'
      const maxInputArea = React.useContext(MaxInputAreaContext)
      const {expanded, inputRef, ...rest} = p
      const lastExpandedRef = React.useRef(expanded)
      const offset = useSharedValue(expanded ? 1 : 0)
      const keyboard = useAnimatedKeyboard()
      const maxHeightBase = maxInputArea - inputAreaHeight - 15
      const as = useAnimatedStyle(() => {
        const maxHeight = maxHeightBase - keyboard.height.value
        return {
          maxHeight: withTiming(offset.value ? maxHeight : threeLineHeight),
          minHeight: withTiming(offset.value ? maxHeight : singleLineHeight),
        }
      })
      React.useEffect(() => {
        if (expanded !== lastExpandedRef.current) {
          lastExpandedRef.current = expanded
          offset.set(expanded ? 1 : 0)
        }
      }, [expanded, offset])
      return (
        <Animated.View style={[p.style, as]}>
          <Input multiline={true} {...rest} ref={inputRef} style={styles.inputInner} />
        </Animated.View>
      )
    }
  }
})()

// Main component

const PlatformInput = (p: Props) => {
  const [showAudioSend, setShowAudioSend] = React.useState(false)
  const [height, setHeight] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false) // updates immediately, used for the icon etc
  const inputRef = React.useRef<RefType | null>(null)
  const suggestionListStyle = Kb.Styles.collapseStyles([styles.suggestionList, !!height && {marginBottom: height}])
  const suggestionSpinnerStyle = Kb.Styles.collapseStyles([styles.suggestionSpinnerStyle, !!height && {marginBottom: height}])
  const {
    popup: suggestorPopup,
    onChangeText,
    onBlur,
    onSelectionChange,
    onFocus,
  } = useSuggestors({
    expanded,
    inputRef,
    onChangeText: p.onChangeText,
    suggestBotCommandsUpdateStatus: p.suggestBotCommandsUpdateStatus,
    suggestionListStyle,
    suggestionOverlayStyle: p.suggestionOverlayStyle,
    suggestionSpinnerStyle,
  })
  const {cannotWrite, isEditing, isExploding, setInputRef, setExplodingMode} = p
  const {onSubmit, explodingModeSeconds, hintText, onCancelEditing} = p

  const lastText = React.useRef('')
  const whichMenu = React.useRef<MenuType | undefined>(undefined)
  const [hasText, setHasText] = React.useState(false)

  const toggleExpandInput = () => {
    const nextState = !expanded
    setExpanded(nextState)
  }

  const insertText = (toInsert: string) => {
    const i = inputRef.current
    i?.transformText(({selection, text}) => {
      return standardTransformer(
        toInsert,
        {position: {end: selection?.end || null, start: selection?.start || null}, text},
        true
      )
    }, true)
  }

  const expandedRef = React.useRef(expanded)
  const onSubmitRef = React.useRef(onSubmit)
  React.useEffect(() => {
    expandedRef.current = expanded
    onSubmitRef.current = onSubmit
  }, [expanded, onSubmit])

  const [onQueueSubmit] = React.useState(() => () => {
    setTimeout(() => {
      const text = lastText.current
      if (text) {
        onSubmitRef.current(text)
        if (expandedRef.current) {
          setExpanded(false)
        }
      }
    }, 60)
  })

  React.useEffect(() => {
    // Enter should send a message like on desktop, when a hardware keyboard's
    // attached.  On Android we get "hardware" keypresses from soft keyboards,
    // so check whether a soft keyboard's up.
    const cb = (hwKeyEvent: {pressedKey: string}) => {
      switch (hwKeyEvent.pressedKey) {
        case 'enter':
          onQueueSubmit()
          break
        case 'shift-enter': {
          const i = inputRef.current
          i?.transformText(({selection, text}) => {
            return standardTransformer(
              '\n',
              {position: {end: selection?.end || null, start: selection?.start || null}, text},
              true
            )
          }, true)
        }
      }
    }
    onHWKeyPressed(cb)
    return () => {
      removeOnHWKeyPressed()
    }
  }, [onQueueSubmit])

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    switch (whichMenu.current) {
      case 'filepickerpopup':
        return <ChatFilePicker attachTo={attachTo} showingPopup={true} hidePopup={hidePopup} />
      case 'moremenu':
        return <MoreMenuPopup onHidden={hidePopup} visible={true} />
      default:
        return (
          <SetExplodingMessagePicker
            attachTo={attachTo}
            onHidden={hidePopup}
            visible={true}
            setExplodingMode={setExplodingMode}
          />
        )
    }
  }

  const {popup: popupMenu, showPopup} = Kb.usePopup2(makePopup)

  const ourShowMenu = (menu: MenuType) => {
    // Hide the keyboard on mobile when showing the menu.
    Keyboard.dismiss()
    whichMenu.current = menu
    showPopup()
  }

  const openExplodingMenu = () => {
    ourShowMenu('exploding')
  }

  const navigateAppend = Chat.useChatNavigateAppend()
  const onPasteImage = (uri: Array<string>) => {
    try {
      const pathAndOutboxIDs = uri.map(path => ({path}))
      navigateAppend(conversationIDKey => ({
        name: 'chatAttachmentGetTitles',
        params: {conversationIDKey, pathAndOutboxIDs},
      }))
    } catch (e) {
      logger.info('onPasteImage error', e)
    }
  }

  const onLayout = (p: LayoutEvent) => {
    const {nativeEvent} = p
    const {layout} = nativeEvent
    const {height} = layout
    setHeight(height)
  }

  const onAnimatedInputRef = (ref: RefType | null) => {
    setInputRef(ref)
    inputRef.current = ref
  }
  const aiOnChangeText = (text: string) => {
    setHasText(!!text)
    lastText.current = text
    onChangeText(text)
  }

  const lastEditRef = React.useRef(isEditing)
  React.useEffect(() => {
    if (isEditing !== lastEditRef.current) {
      lastEditRef.current = isEditing
      if (isEditing) {
        inputRef.current?.focus()
      }
    }
  }, [isEditing])

  const _onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    onSelectionChange(e.nativeEvent.selection)
  }

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} onLayout={onLayout} relative={true}>
        {suggestorPopup}
        {popupMenu}
        {!suggestorPopup && <Typing />}
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([styles.container, isExploding && styles.explodingContainer])}
          fullWidth={true}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputContainer}>
            <AnimatedInput
              onPasteImage={onPasteImage}
              autoCorrect={true}
              autoCapitalize="sentences"
              disabled={cannotWrite}
              placeholder={hintText}
              multiline={true}
              onBlur={onBlur}
              onFocus={onFocus}
              onChangeText={aiOnChangeText}
              onSelectionChange={_onSelectionChange}
              inputRef={onAnimatedInputRef}
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        flexShrink: 0,
        minHeight: 32,
      },
      container: {
        alignItems: 'center',
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
          minHeight: 0,
        },
      }),
      inputContainer: {
        ...Kb.Styles.padding(0, Kb.Styles.globalMargins.tiny),
        flexGrow: 1,
        flexShrink: 1,
        maxHeight: '100%',
        paddingBottom: Kb.Styles.globalMargins.tiny,
      },
      inputInner: {flexGrow: 1},
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

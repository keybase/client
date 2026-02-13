import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import AudioRecorder from '@/chat/audio/audio-recorder.native'
import FilePickerPopup from '../filepicker-popup'
import {onHWKeyPressed, removeOnHWKeyPressed} from 'react-native-kb'
import MoreMenuPopup from './moremenu-popup.native'
import SetExplodingMessagePicker from './set-explode-popup'
import Typing from './typing'
import type * as ImagePicker from 'expo-image-picker'
import type {LayoutEvent} from '@/common-adapters/box'
import type {Props} from './platform-input'
import {Keyboard, type NativeSyntheticEvent, type TextInputSelectionChangeEventData} from 'react-native'
import {formatDurationShort} from '@/util/timestamp'
import {launchCameraAsync, launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {standardTransformer} from '../suggestors/common'
import {useSuggestors} from '../suggestors'
import {MaxInputAreaContext} from './max-input-area-context'
import {
  default as Animated,
  skipAnimations,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from '@/common-adapters/reanimated'
import logger from '@/logger'
import {AudioSendWrapper} from '@/chat/audio/audio-send.native'
import {usePickerState} from '@/chat/emoji-picker/use-picker'
import type {RefType as Input2Ref, Props as Input2Props} from '@/common-adapters/input2'
import {useConfigState} from '@/stores/config'

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

const AnimatedExpand = (() => {
  'use no memo'
  if (skipAnimations) {
    return React.memo(function AnimatedExpand() {
      return null
    })
  } else {
    return React.memo(function AnimatedExpand(p: {expandInput: () => void; expanded: boolean}) {
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
              fixOverdraw={false}
              type="iconfont-arrow-full-up"
              fontSize={18}
              color={Kb.Styles.globalColors.black_35}
            />
          </Animated.View>
          <Animated.View style={[styles.iconBottom, bottomStyle]} pointerEvents="none">
            <Kb.Icon
              fixOverdraw={false}
              type="iconfont-arrow-full-up"
              fontSize={18}
              color={Kb.Styles.globalColors.black_35}
            />
          </Animated.View>
        </Kb.ClickableBox>
      )
    })
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
  const inputRef = React.useRef<Input2Ref | null>(null)
  const suggestionListStyle = React.useMemo(() => {
    return Kb.Styles.collapseStyles([styles.suggestionList, !!height && {marginBottom: height}])
  }, [height])
  const suggestionSpinnerStyle = React.useMemo(() => {
    return Kb.Styles.collapseStyles([styles.suggestionSpinnerStyle, !!height && {marginBottom: height}])
  }, [height])
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
  const {cannotWrite, isEditing, isExploding, setInput2Ref, setExplodingMode} = p
  const {onSubmit, explodingModeSeconds, hintText, onCancelEditing} = p

  const lastText = React.useRef('')
  const whichMenu = React.useRef<MenuType | undefined>(undefined)
  const [hasText, setHasText] = React.useState(false)

  const toggleExpandInput = React.useCallback(() => {
    const nextState = !expanded
    setExpanded(nextState)
  }, [expanded, setExpanded])

  const reallySend = React.useCallback(() => {
    const text = lastText.current
    if (text) {
      onSubmit(text)
      if (expanded) {
        toggleExpandInput()
      }
    }
  }, [expanded, onSubmit, toggleExpandInput])

  const onQueueSubmit = React.useCallback(() => {
    setTimeout(() => {
      reallySend()
    }, 60)
  }, [reallySend])

  const insertText = React.useCallback(
    (toInsert: string) => {
      const i = inputRef.current
      i?.transformText(({selection, text}) => {
        return standardTransformer(
          toInsert,
          {position: {end: selection?.end || null, start: selection?.start || null}, text},
          true
        )
      }, true)
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
          onQueueSubmit()
          break
        case 'shift-enter':
          insertText('\n')
      }
    }
    onHWKeyPressed(cb)
    return () => {
      removeOnHWKeyPressed()
    }
  }, [onQueueSubmit, insertText])

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
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
    },
    [setExplodingMode]
  )

  const {popup: popupMenu, showPopup} = Kb.usePopup2(makePopup)

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

  const navigateAppend = Chat.useChatNavigateAppend()
  const onPasteImage = React.useCallback(
    (uri: Array<string>) => {
      try {
        const pathAndOutboxIDs = uri.map(path => ({path}))
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
    (ref: Input2Ref | null) => {
      setInput2Ref(ref)
      inputRef.current = ref
    },
    [setInput2Ref, inputRef]
  )
  const aiOnChangeText = React.useCallback(
    (text: string) => {
      setHasText(!!text)
      lastText.current = text
      onChangeText(text)
    },
    [setHasText, onChangeText]
  )

  const lastEditRef = React.useRef(isEditing)
  React.useEffect(() => {
    if (isEditing !== lastEditRef.current) {
      lastEditRef.current = isEditing
      if (isEditing) {
        inputRef.current?.focus()
      }
    }
  }, [isEditing])

  const _onSelectionChange = React.useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      onSelectionChange(e.nativeEvent.selection)
    },
    [onSelectionChange]
  )

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} onLayout={onLayout} style={styles.outerContainer}>
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

const AnimatedInput = (() => {
  if (skipAnimations) {
    return React.memo(
      React.forwardRef<Input2Ref, Input2Props & {expanded: boolean}>(function AnimatedInput(p, ref) {
        const {expanded, ...rest} = p
        return (
          <Animated.View style={[p.style, rest.style]}>
            <Kb.Input2 multiline={true} {...rest} ref={ref} style={styles.inputInner} />
          </Animated.View>
        )
      })
    )
  } else {
    return React.memo(
      React.forwardRef<Input2Ref, Input2Props & {expanded: boolean}>(function AnimatedInput(p, ref) {
        'use no memo'
        const maxInputArea = React.useContext(MaxInputAreaContext)
        const {expanded, ...rest} = p
        const lastExpandedRef = React.useRef(expanded)
        const offset = useSharedValue(expanded ? 1 : 0)
        const maxHeight = maxInputArea - inputAreaHeight - 15
        const as = useAnimatedStyle(() => ({
          maxHeight: withTiming(offset.value ? maxHeight : threeLineHeight),
          minHeight: withTiming(offset.value ? maxHeight : singleLineHeight),
        }))
        React.useEffect(() => {
          if (expanded !== lastExpandedRef.current) {
            lastExpandedRef.current = expanded
            offset.set(expanded ? 1 : 0)
          }
        }, [expanded, offset])
        return (
          <Animated.View style={[p.style, as]}>
            <Kb.Input2 multiline={true} {...rest} ref={ref} style={styles.inputInner} />
          </Animated.View>
        )
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
      hidden: {height: 0, maxHeight: 0, maxWidth: 0, width: 0},
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

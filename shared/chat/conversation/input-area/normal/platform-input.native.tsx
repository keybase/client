import * as ConfigGen from '../../../../actions/config-gen'
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
import {parseUri, launchCameraAsync, launchImageLibraryAsync} from '../../../../util/expo-image-picker.native'
import {standardTransformer} from '../suggestors/common'
import {useSuggestors} from '../suggestors'
import {type PastedFile} from '@mattermost/react-native-paste-input'
import {MaxInputAreaContext} from '../../input-area/normal/max-input-area-context'
import {
  createAnimatedComponent,
  skipAnimations,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from '../../../../common-adapters/reanimated'
import logger from '../../../../logger'
import {AudioSendWrapper} from '../../../audio/audio-send.native'

const singleLineHeight = 36
const threeLineHeight = 78
const inputAreaHeight = 91

type MenuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type ButtonsProps = Pick<
  Props,
  'conversationIDKey' | 'explodingModeSeconds' | 'isExploding' | 'cannotWrite' | 'onCancelEditing'
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
  const {conversationIDKey, insertText, ourShowMenu, onSubmit, onCancelEditing} = p
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

  const dispatch = Container.useDispatch()

  const openEmojiPicker = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey, onPickAction: (emoji: string) => insertText(emoji + ' ')},
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
          <AudioRecorder
            conversationIDKey={conversationIDKey}
            showAudioSend={showAudioSend}
            setShowAudioSend={setShowAudioSend}
          />
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
        if (result.canceled || (result.assets.length ?? 0) == 0 || !conversationIDKey) {
          return
        }

        const pathAndOutboxIDs = result.assets.map(p => ({outboxID: null, path: parseUri(p)}))
        const props = {conversationIDKey, pathAndOutboxIDs}
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props, selected: 'chatAttachmentGetTitles'}],
          })
        )
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
          launchImageLibraryAsync(mediaType, true, true)
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
  const [showAudioSend, setShowAudioSend] = React.useState(false)
  const [height, setHeight] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false) // updates immediately, used for the icon etc
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const silentInput = React.useRef<Kb.PlainInput | null>(null)
  const {popup, onChangeText, onBlur, onSelectionChange, onFocus} = useSuggestors({
    conversationIDKey: p.conversationIDKey,
    expanded,
    inputRef,
    onChangeText: p.onChangeText,
    suggestBotCommandsUpdateStatus: p.suggestBotCommandsUpdateStatus,
    suggestionListStyle: Styles.collapseStyles([styles.suggestionList, !!height && {marginBottom: height}]),
    suggestionOverlayStyle: p.suggestionOverlayStyle,
    suggestionSpinnerStyle: Styles.collapseStyles([
      styles.suggestionSpinnerStyle,
      !!height && {marginBottom: height},
    ]),
  })
  const {cannotWrite, conversationIDKey, isEditing, isExploding} = p
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
      if (Container.isIOS) {
        silentInput.current?.focus()
        inputRef.current?.focus()
      } else {
        reallySend()
      }
    }
  }, [reallySend])

  const onFocusAndMaybeSubmit = React.useCallback(() => {
    // need to submit?
    if (Container.isIOS && submitQueued.current) {
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
    // @ts-ignore
    HWKeyboardEvent.onHWKeyPressed((hwKeyEvent: any) => {
      switch (hwKeyEvent.pressedKey) {
        case 'enter':
          Styles.isIOS || !isOpen() ? onQueueSubmit() : insertText('\n')
          break
        case 'shift-enter':
          insertText('\n')
      }
    })
    return () => {
      HWKeyboardEvent.removeOnHWKeyPressed()
    }
  }, [onQueueSubmit, insertText])

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      switch (whichMenu.current) {
        case 'filepickerpopup':
          return (
            <ChatFilePicker
              attachTo={attachTo}
              showingPopup={true}
              toggleShowingPopup={toggleShowingPopup}
              conversationIDKey={conversationIDKey}
            />
          )
        case 'moremenu':
          return (
            <MoreMenuPopup
              conversationIDKey={conversationIDKey}
              onHidden={toggleShowingPopup}
              visible={true}
            />
          )
        default:
          return (
            <SetExplodingMessagePicker
              attachTo={attachTo}
              conversationIDKey={conversationIDKey}
              onHidden={toggleShowingPopup}
              visible={true}
            />
          )
      }
    },
    [conversationIDKey]
  )

  const {popup: menu, toggleShowingPopup} = Kb.usePopup2(makePopup)

  const ourShowMenu = React.useCallback(
    (menu: MenuType) => {
      // Hide the keyboard on mobile when showing the menu.
      NativeKeyboard.dismiss()
      whichMenu.current = menu
      toggleShowingPopup()
    },
    [whichMenu, toggleShowingPopup]
  )

  const openExplodingMenu = React.useCallback(() => {
    ourShowMenu('exploding')
  }, [ourShowMenu])

  const dispatch = Container.useDispatch()
  const onPasteImage = React.useCallback(
    (error: string | null | undefined, files: Array<PastedFile>) => {
      try {
        if (error) return
        const pathAndOutboxIDs = files.reduce<Array<Types.PathAndOutboxID>>((arr, f) => {
          // @ts-ignore actually exists!
          if (!f.error) {
            const filePrefixLen = 'file://'.length
            const uriLen = f.uri?.length ?? 0
            if (uriLen > filePrefixLen) {
              arr.push({outboxID: null, path: f.uri.substring(filePrefixLen)})
            }
          }
          return arr
        }, [])
        if (pathAndOutboxIDs.length) {
          dispatch(
            RouteTreeGen.createNavigateAppend({
              path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'}],
            })
          )
        }
      } catch (e) {
        logger.info('onPasteImage error', e)
      }
    },
    [conversationIDKey, dispatch]
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
        {showTypingStatus && !popup && <Typing conversationIDKey={conversationIDKey} />}
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([styles.container, isExploding && styles.explodingContainer])}
          fullWidth={true}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputContainer}>
            {/* in order to get auto correct submit working we move focus to this and then back so we can 'blur' without losing keyboard */}
            <Kb.PlainInput key="silent" ref={silentInput} style={styles.hidden} />
            <AnimatedInput
              allowImagePaste={true}
              onPasteImage={onPasteImage}
              autoCorrect={true}
              autoCapitalize="sentences"
              disabled={cannotWrite ?? false}
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
            conversationIDKey={conversationIDKey}
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
      React.forwardRef<any, any>(function AnimatedInput(p: any, ref) {
        const {expanded, ...rest} = p
        return <AnimatedPlainInput {...rest} ref={ref} style={[rest.style]} />
      })
    )
  } else {
    return React.memo(
      React.forwardRef<any, any>(function AnimatedInput(p: any, ref) {
        const maxInputArea = React.useContext(MaxInputAreaContext)
        const {expanded, ...rest} = p
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
    )
  }
})()

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        flexShrink: 0,
        minHeight: 32,
      },
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
        backgroundColor: Styles.globalColors.yellowOrYellowAlt,
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
      hidden: {display: 'none'},
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
      outerContainer: {position: 'relative'},
      sendBtn: {marginRight: Styles.globalMargins.tiny},
      sendWrapper: {backgroundColor: Styles.globalColors.white_90, position: 'absolute'},
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

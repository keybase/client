import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as ChatTypes from '@/constants/types/chat/message'
import * as InputState from '../input-state'
import SetExplodingMessagePopup from './set-explode-popup'
import Typing from './typing'
import type {Props as InputLowLevelProps, TextInfo, RefType} from './input.shared'
import type {PlatformInputProps as Props} from './input.shared'
export type {Selection, RefType, TextInfo, PlatformInputProps} from './input.shared'
import {formatDurationShort} from '@/util/timestamp'
import {useSuggestors} from '../suggestors'
import {ScrollContext} from '@/chat/conversation/normal/context'
import {getTextStyle} from '@/common-adapters/text.styles'
import {useColorScheme} from 'react-native'
import {useConversationThreadID} from '../../thread-context'

// ==================== DESKTOP LOW-LEVEL INPUT ====================

// Stub types to avoid dom lib dependency in native tsconfig
type HtmlInputRef = {
  blur: () => void
  focus: () => void
  value: string
  selectionStart: number | null
  selectionEnd: number | null
  click: () => void
  getBoundingClientRect: () => DOMRect
  files?: HtmlFileList | null
}
type HtmlTextAreaRef = {
  blur: () => void
  focus: () => void
  value: string
  selectionStart: number | null
  selectionEnd: number | null
  click: () => void
  getBoundingClientRect: () => DOMRect
}
type HtmlFileList = {
  length: number
  [index: number]: HtmlFile
  [Symbol.iterator]: () => Iterator<HtmlFile>
}
type HtmlFile = {
  name: string
  size: number
  type: string
}
type NativeSyntheticEvent<T> = {nativeEvent: T}
type TextInputSelectionChangeEventData = {selection: {start: number; end: number}}
type DesktopKeyboardEvent = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  type: string
  target: unknown
  preventDefault: () => void
}

const maybeParseInt = (input: string | number, radix: number): number =>
  typeof input === 'string' ? parseInt(input, radix) : input

function DesktopInput(p: InputLowLevelProps) {
  const {style: _style, onChangeText: _onChangeText, multiline, ref} = p
  const {textType = 'Body', rowsMax, rowsMin, padding, placeholder, onKeyUp: _onKeyUp} = p
  const {allowKeyboardEvents, className, disabled, autoFocus, onKeyDown: _onKeyDown, onEnterKeyDown} = p

  const isDarkMode = useColorScheme() === 'dark'

  const [value, setValue] = React.useState('')
  const selectionRef = React.useRef({end: 0, start: 0})
  const inputSingleRef = React.useRef<HtmlInputRef>(null)
  const inputMultiRef = React.useRef<HtmlTextAreaRef>(null)

  const onChangeTextRef = React.useRef(_onChangeText)
  React.useEffect(() => {
    onChangeTextRef.current = _onChangeText
  }, [_onChangeText])
  const [onChange] = React.useState(() => (e: {target: {value: string}}) => {
    const s = e.target.value
    setValue(s)
    onChangeTextRef.current?.(s)
  })
  const onSelect = (e: {currentTarget: {selectionEnd: number | null; selectionStart: number | null}}) => {
    selectionRef.current = {
      end: e.currentTarget.selectionEnd || 0,
      start: e.currentTarget.selectionStart || 0,
    }
  }

  React.useImperativeHandle(ref, () => {
    const i = multiline ? inputMultiRef.current : inputSingleRef.current
    return {
      blur: () => {
        i?.blur()
      },
      clear: () => {
        if (i) {
          i.value = ''
          onChange({target: i})
        }
      },
      focus: () => {
        i?.focus()
      },
      getBoundingClientRect: () => {
        return i?.getBoundingClientRect()
      },
      getSelection: () => {
        return selectionRef.current
      },
      isFocused: () => !!i && (globalThis as {document?: {activeElement: unknown}}).document?.activeElement === i,
      transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean): void => {
        const ti = fn({selection: selectionRef.current, text: value})
        setTimeout(() => {
          setValue(ti.text)
          selectionRef.current = {end: ti.selection?.end ?? 0, start: ti.selection?.start ?? 0}
          setTimeout(() => {
            if (i && ti.selection) {
              if (typeof ti.selection.start === 'number') {
                i.selectionStart = ti.selection.start
              }
              if (typeof ti.selection.end === 'number') {
                i.selectionEnd = ti.selection.end
              }
            }
          }, 10)
          if (reflectChange) {
            setTimeout(() => {
              if (!i) return
              onChange({target: i})
            }, 100)
          }
        }, 0)
      },
      value,
    }
  }, [value, multiline, onChange])

  const rows = multiline ? rowsMin || Math.min(2, rowsMax || 2) : 0
  const style = (() => {
    const textStyle = getTextStyle(textType, isDarkMode)
    if (multiline) {
      const heightStyles: {minHeight: number; maxHeight?: number} = {
        minHeight:
          rows * (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20) +
          (padding ? Kb.Styles.globalMargins[padding] * 2 : 0),
      }

      if (rowsMax) {
        heightStyles.maxHeight =
          rowsMax * (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20)
      }

      const paddingStyles = padding ? Kb.Styles.padding(Kb.Styles.globalMargins[padding]) : {}

      return Kb.Styles.collapseStyles([
        desktopInputLowLevelStyles.noChrome,
        textStyle,
        desktopInputLowLevelStyles.multiline,
        heightStyles,
        paddingStyles,
        _style,
      ])
    } else {
      return Kb.Styles.collapseStyles([
        textStyle,
        desktopInputLowLevelStyles.noChrome,
        _style,
      ])
    }
  })()

  const isComposingIMERef = React.useRef(false)

  const onCompositionStart = () => {
    isComposingIMERef.current = true
  }

  const onCompositionEnd = () => {
    isComposingIMERef.current = false
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isComposingIMERef.current) {
      return
    }
    _onKeyDown?.(e)
    if (onEnterKeyDown && e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
      onEnterKeyDown(e)
    }
  }

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (isComposingIMERef.current) {
      return
    }
    _onKeyUp?.(e)
  }

  const commonProps = {
    autoFocus,
    className,
    onChange,
    onCompositionEnd,
    onCompositionStart,
    onKeyDown,
    onKeyUp,
    onSelect,
    placeholder,
    value,
    ...(disabled ? {readOnly: true} : {}),
    ...((allowKeyboardEvents ?? true) ? {'data-allow-keyboard-shortcuts': 'true'} : {}),
  }

  // commonProps uses stub types so need to cast for JSX compatibility
  const desktopCommonProps = commonProps as unknown as React.HTMLAttributes<HTMLElement>
  return multiline ? (
    <textarea {...desktopCommonProps} style={Kb.Styles.castStyleDesktop(style)} ref={inputMultiRef as React.RefObject<HTMLTextAreaElement>} rows={rows} />
  ) : (
    <input {...desktopCommonProps} ref={inputSingleRef as React.RefObject<HTMLInputElement>} style={Kb.Styles.castStyleDesktop(style)} />
  )
}

const desktopInputLowLevelStyles = Kb.Styles.styleSheetCreate(() => ({
  multiline: Kb.Styles.platformStyles({
    isElectron: {
      fieldSizing: 'content',
      paddingBottom: 0,
      paddingTop: 0,
      resize: 'none',
      width: '100%',
    },
  }),
  noChrome: Kb.Styles.platformStyles({
    isElectron: {
      borderWidth: 0,
      lineHeight: 'unset',
      outline: 'none',
    },
  }),
}))

// ==================== NATIVE LOW-LEVEL INPUT ====================

function NativeInput(p: InputLowLevelProps) {
  type RNTextInput = {
    blur: () => void
    focus: () => void
    clear: () => void
    isFocused: () => boolean
    setNativeProps: (props: {selection?: {start: number; end?: number}}) => void
  }
  type RNKeyboard = {dismiss: () => void}
  const {TextInput, Keyboard} = require('react-native') as {
    TextInput: React.ComponentType<{
      ref?: React.Ref<RNTextInput>
      style?: object | null
      multiline?: boolean
      numberOfLines?: number
      placeholder?: string
      value?: string
      onChangeText?: (text: string) => void
      onSelectionChange?: (e: {nativeEvent: {selection: {start: number; end: number}}}) => void
      onBlur?: ((e: unknown) => void) | undefined
      onFocus?: ((e: unknown) => void) | undefined
      autoFocus?: boolean
      autoCorrect?: boolean
      autoCapitalize?: string
      editable?: boolean
      readOnly?: boolean
      selection?: {start: number; end?: number} | undefined
      scrollEnabled?: boolean
      keyboardType?: string
      returnKeyType?: string
      blurOnSubmit?: boolean
    }>
    Keyboard: RNKeyboard
  }
  const {registerPasteImage, removeOnHWKeyPressed, onHWKeyPressed} = require('react-native-kb') as {
    registerPasteImage: (cb: (uris: Array<string>) => void) => () => void
    removeOnHWKeyPressed: () => void
    onHWKeyPressed: (cb: (e: {pressedKey: string}) => void) => void
  }

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
  const inputRef = React.useRef<RNTextInput | null>(null)

  const setInputRef = (ti: RNTextInput | null) => {
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
    _onSelectionChange?.(e as Parameters<NonNullable<typeof _onSelectionChange>>[0])
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
    if (isIOS) {
      const {lineHeight, ...rest} = textStyle
      textStyle = rest
    }
    const commonStyle = Kb.Styles.collapseStyles([nativeInputLowLevelStyles.common, textStyle])

    const lineHeight = textStyle.lineHeight
    let lineStyle: Array<Kb.Styles.StylesCrossPlatform>
    if (multiline) {
      const defaultRowsToShow = Math.min(2, rowsMax ?? 2)
      const paddingStyles = padding ? Kb.Styles.padding(Kb.Styles.globalMargins[padding]) : {}
      lineStyle = [
        nativeInputLowLevelStyles.multiline,
        {
          minHeight: (rowsMin || defaultRowsToShow) * (lineHeight ?? 0),
        },
        !!rowsMax && {maxHeight: rowsMax * (lineHeight ?? 0)},
        paddingStyles,
      ]
    } else {
      lineStyle = [nativeInputLowLevelStyles.singleline, {maxHeight: lineHeight, minHeight: lineHeight}]
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
  }, [onPaste, Keyboard, registerPasteImage])

  void removeOnHWKeyPressed
  void onHWKeyPressed

  return (
    <TextInput
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      autoFocus={autoFocus}
      blurOnSubmit={false}
      multiline={multiline}
      onBlur={onBlur as ((e: unknown) => void) | undefined}
      onChangeText={onChangeText}
      onFocus={onFocus as ((e: unknown) => void) | undefined}
      onSelectionChange={onSelectionChange}
      placeholder={placeholder}
      readOnly={disabled}
      ref={setInputRef}
      selection={selection}
      style={style as object | null | undefined}
      value={value}
    />
  )
}

const nativeInputLowLevelStyles = Kb.Styles.styleSheetCreate(() => ({
  common: {borderWidth: 0, flexGrow: 1},
  multiline: Kb.Styles.platformStyles({
    isMobile: {
      height: undefined,
      textAlignVertical: 'top',
    },
  }),
  singleline: {padding: 0},
}))

export const Input = isMobile ? NativeInput : DesktopInput

// ==================== DESKTOP PLATFORM INPUT ====================

type HtmlInputRefType = React.RefObject<HtmlInputRef | null>
type InputRefType = React.RefObject<RefType | null>

type ExplodingButtonProps = Pick<Props, 'explodingModeSeconds'> & {
  focusInput: () => void
  setExplodingMode: (mode: number) => void
}
const ExplodingButton = function ExplodingButton(p: ExplodingButtonProps) {
  const {explodingModeSeconds, focusInput, setExplodingMode} = p
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <SetExplodingMessagePopup
        attachTo={attachTo}
        onAfterSelect={focusInput}
        onHidden={hidePopup}
        visible={true}
        setExplodingMode={setExplodingMode}
      />
    )
  }
  const {popup, popupAnchor, showingPopup, showPopup} = Kb.usePopup2(makePopup)

  return (
    <Kb.ClickableBox2
      className={Kb.Styles.classNames({expanded: showingPopup}, 'timer-icon-container')}
      onClick={showPopup}
      ref={popupAnchor}
      style={Kb.Styles.collapseStyles([
        desktopStyles.explodingIconContainer,
        !!explodingModeSeconds && {
          backgroundColor: Kb.Styles.globalColors.black,
        },
      ])}
    >
      {popup}
      <Kb.Box2
        direction="vertical"
        style={desktopStyles.explodingInsideWrapper}
        tooltip={explodingModeSeconds ? undefined : 'Timer'}
        justifyContent="center"
      >
        {explodingModeSeconds ? (
          <Kb.Text type="BodyTinyBold" negative={true}>
            {formatDurationShort(explodingModeSeconds * 1000)}
          </Kb.Text>
        ) : (
          <Kb.Icon
            className={Kb.Styles.classNames('timer-icon', 'hover_color_black')}
            onClick={showPopup}
            padding="xtiny"
            type="iconfont-timer"
          />
        )}
      </Kb.Box2>
    </Kb.ClickableBox2>
  )
}

type EmojiButtonProps = {inputRef: InputRefType}
const EmojiButton = function EmojiButton(p: EmojiButtonProps) {
  const {EmojiPickerDesktop} = require('@/chat/emoji-picker/container') as {EmojiPickerDesktop: React.ComponentType<{conversationIDKey: string; onPickAction: (s: string) => void; onDidPick: () => void}>}
  const {inputRef} = p
  const conversationIDKey = useConversationThreadID()
  const insertEmoji = (emojiColons: string) => {
    inputRef.current?.transformText(({text, selection}) => {
      const newText =
        text.slice(0, selection?.start || 0) + emojiColons + text.slice(selection?.end || 0) + ' '
      const pos = (selection?.start || 0) + emojiColons.length + 1
      return {
        selection: {end: pos, start: pos},
        text: newText,
      }
    }, true)
    inputRef.current?.focus()
  }

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <Kb.Popup attachTo={attachTo} visible={true} onHidden={hidePopup} position="top right">
        <EmojiPickerDesktop
          conversationIDKey={conversationIDKey}
          onPickAction={insertEmoji}
          onDidPick={hidePopup}
        />
      </Kb.Popup>
    )
  }

  const {popup, popupAnchor, showingPopup, showPopup} = Kb.usePopup2(makePopup)

  return (
    <>
      <Kb.Box2
        direction="vertical"
        style={desktopStyles.icon}
        ref={popupAnchor}
        tooltip="Emoji"
        className="tooltip-top-left"
      >
        <Kb.Icon
          color={showingPopup ? Kb.Styles.globalColors.black : undefined}
          onClick={showPopup}
          type="iconfont-emoji"
        />
      </Kb.Box2>
      {popup}
    </>
  )
}

const GiphyButton = function GiphyButton() {
  const toggleGiphyPrefill = InputState.useConversationInputDispatch(s => s.toggleGiphyPrefill)
  const onGiphyToggle = toggleGiphyPrefill

  return (
    <Kb.Box2 direction="vertical" style={desktopStyles.icon} tooltip="GIF" className="tooltip-top-left">
      <Kb.Icon onClick={onGiphyToggle} type="iconfont-gif" />
    </Kb.Box2>
  )
}

const fileListToPaths = (f: HtmlFileList): Array<string> => {
  const KB2 = require('@/util/electron') as {default: {functions: {getPathForFile?: (f: File) => string}}}
  const {getPathForFile} = KB2.default.functions
  return Array.from(f).map(f => getPathForFile?.(f as File) ?? '')
}

const FileButton = function FileButton(p: {setHtmlInputRef: (i: HtmlInputRef | null) => void}) {
  const {setHtmlInputRef} = p
  const htmlInputRef = React.useRef<HtmlInputRef | null>(null)
  const conversationIDKey = useConversationThreadID()
  const pickFile = () => {
    const paths = htmlInputRef.current?.files ? fileListToPaths(htmlInputRef.current.files) : undefined
    const pathAndOutboxIDs = paths?.reduce<Array<{path: string}>>((arr, path: string) => {
      if (path) {
        arr.push({path})
      }
      return arr
    }, [])
    if (pathAndOutboxIDs?.length) {
      C.Router2.navigateAppend({
        name: 'chatAttachmentGetTitles',
        params: {conversationIDKey, pathAndOutboxIDs},
      })
    }

    if (htmlInputRef.current) {
      htmlInputRef.current.value = ''
    }
  }

  const filePickerOpen = () => {
    htmlInputRef.current?.click()
  }

  const setRef = (e: HtmlInputRef | null) => {
    htmlInputRef.current = e
    setHtmlInputRef(e)
  }

  return (
    <Kb.Box2 direction="vertical" style={desktopStyles.icon} tooltip="Attachment" className="tooltip-top-left">
      <Kb.Icon onClick={filePickerOpen} type="iconfont-attachment" />
      <input type="file" style={desktopStyles.hidden} ref={setRef} onChange={pickFile} multiple={true} />
    </Kb.Box2>
  )
}

const DesktopFooter = () => {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" justifyContent="space-between">
      <Typing />
      <Kb.Text lineClamp={1} type="BodyTiny" style={desktopStyles.footer} selectable={true}>
        {`*bold*, _italics_, \`code\`, >quote, !>spoiler<!, @user, @team, #channel`}
      </Kb.Text>
    </Kb.Box2>
  )
}

type UseKeyboardProps = Pick<Props, 'isEditing' | 'onChangeText' | 'showReplyPreview'> & {
  focusInput: () => void
  htmlInputRef: HtmlInputRefType
  onKeyDown?: (evt: React.KeyboardEvent) => void
  onEditLastMessage: () => void
  onCancelEditing: () => void
}
const useKeyboard = (p: UseKeyboardProps) => {
  const {htmlInputRef, focusInput, isEditing, onKeyDown, onCancelEditing} = p
  const {onChangeText, onEditLastMessage, showReplyPreview} = p
  const lastText = React.useRef('')
  const setReplyTo = InputState.useConversationInputDispatch(s => s.setReplyTo)
  const {scrollDown, scrollUp} = React.useContext(ScrollContext)
  const onCancelReply = () => {
    setReplyTo(ChatTypes.numberToOrdinal(0))
  }

  const commonOnKeyDown = (e: React.KeyboardEvent | DesktopKeyboardEvent) => {
    const text = lastText.current
    if (e.key === 'ArrowUp' && !isEditing && !text) {
      e.preventDefault()
      onEditLastMessage()
      return true
    } else if (e.key === 'Escape' && isEditing) {
      onCancelEditing()
      return true
    } else if (e.key === 'Escape' && showReplyPreview) {
      onCancelReply()
      return true
    } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
      htmlInputRef.current?.click()
      return true
    } else if (e.key === 'PageDown') {
      scrollDown()
      return true
    } else if (e.key === 'PageUp') {
      scrollUp()
      return true
    }

    return false
  }

  const globalKeyDownPressHandler = (ev: DesktopKeyboardEvent) => {
    const target = ev.target
    const tagName = (target as {tagName?: string} | null)?.tagName?.toUpperCase()
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
      return
    }

    if (commonOnKeyDown(ev)) {
      return
    }

    const isPasteKey = ev.key === 'v' && (ev.ctrlKey || ev.metaKey)
    const isValidSpecialKey = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Enter',
      'Escape',
    ].includes(ev.key)
    if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
      focusInput()
    }
  }

  const inputKeyDown = (e: React.KeyboardEvent) => {
    commonOnKeyDown(e)
    onKeyDown?.(e)
  }

  const onChangeTextInner = (text: string) => {
    lastText.current = text
    onChangeText(text)
  }

  return {globalKeyDownPressHandler, inputKeyDown, onChangeText: onChangeTextInner}
}

type SideButtonsProps = Pick<Props, 'cannotWrite'> & {
  setHtmlInputRef: (i: HtmlInputRef | null) => void
  inputRef: InputRefType
}

const SideButtons = (p: SideButtonsProps) => {
  const {setHtmlInputRef, cannotWrite, inputRef} = p
  return (
    <Kb.Box2 direction="horizontal" style={desktopStyles.sideButtons}>
      {!cannotWrite && (
        <>
          <GiphyButton />
          <EmojiButton inputRef={inputRef} />
          <FileButton setHtmlInputRef={setHtmlInputRef} />
        </>
      )}
    </Kb.Box2>
  )
}

const DesktopPlatformInput = function DesktopPlatformInput(p: Props) {
  const {KeyEventHandler} = require('@/common-adapters/key-event-handler.desktop') as {KeyEventHandler: React.ComponentType<{onKeyDown: (e: DesktopKeyboardEvent) => void; onKeyPress: (e: DesktopKeyboardEvent) => void; children: React.ReactNode}>}
  const {cannotWrite, explodingModeSeconds, onCancelEditing, setExplodingMode} = p
  const {showReplyPreview, hintText, setInputRef, isEditing, onSubmit} = p
  const htmlInputRef = React.useRef<HtmlInputRef | null>(null)
  const setHtmlInputRef = (i: HtmlInputRef | null) => {
    htmlInputRef.current = i
  }
  const inputRef = React.useRef<RefType | null>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const checkEnterOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.altKey || e.shiftKey || e.metaKey)) {
      e.preventDefault()
      if (inputRef.current) {
        onSubmit(inputRef.current.value)
      }
    }
  }

  const {
    popup,
    onKeyDown,
    onChangeText: onChangeTextSuggestors,
  } = useSuggestors({
    inputRef,
    onChangeText: p.onChangeText,
    onKeyDown: checkEnterOnKeyDown,
    suggestionListStyle: undefined,
    suggestionOverlayStyle: p.suggestionOverlayStyle,
    suggestionSpinnerStyle: desktopStyles.suggestionSpinnerStyle,
  })

  const focusInput = () => {
    inputRef.current?.focus()
  }
  const setEditing = InputState.useConversationInputDispatch(s => s.setEditing)
  const onEditLastMessage = () => {
    setEditing('last')
  }

  const {globalKeyDownPressHandler, inputKeyDown, onChangeText} = useKeyboard({
    focusInput,
    htmlInputRef,
    isEditing,
    onCancelEditing,
    onChangeText: onChangeTextSuggestors,
    onEditLastMessage,
    onKeyDown,
    showReplyPreview,
  })

  const setRefs = (ref: null | RefType) => {
    setInputRef(ref)
    inputRef.current = ref
  }

  return (
    <>
      {popup}
      <KeyEventHandler onKeyDown={globalKeyDownPressHandler} onKeyPress={globalKeyDownPressHandler}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={desktopStyles.container}>
          <Kb.Box2
            direction="horizontal"
            alignItems="flex-end"
            style={Kb.Styles.collapseStyles([
              desktopStyles.inputWrapper,
              isEditing && desktopStyles.inputWrapperEditing,
              explodingModeSeconds && desktopStyles.inputWrapperExplodingMode,
            ])}
          >
            {!isEditing && !cannotWrite && (
              <ExplodingButton
                explodingModeSeconds={explodingModeSeconds}
                focusInput={focusInput}
                setExplodingMode={setExplodingMode}
              />
            )}
            {isEditing && (
              <Kb.Button
                label="Cancel"
                onClick={onCancelEditing}
                small={true}
                style={desktopStyles.cancelEditingBtn}
                type="Dim"
              />
            )}
            <Kb.Box2 direction="horizontal" flex={1} overflow="hidden" style={desktopStyles.inputBox}>
              <DesktopInput
                allowKeyboardEvents={true}
                disabled={cannotWrite}
                autoFocus={false}
                ref={setRefs}
                placeholder={hintText}
                style={Kb.Styles.collapseStyles([desktopStyles.input, isEditing && desktopStyles.inputEditing])}
                onChangeText={onChangeText}
                multiline={true}
                rowsMin={1}
                rowsMax={10}
                onKeyDown={inputKeyDown}
              />
            </Kb.Box2>
            <SideButtons cannotWrite={cannotWrite} setHtmlInputRef={setHtmlInputRef} inputRef={inputRef} />
          </Kb.Box2>
          <DesktopFooter />
        </Kb.Box2>
      </KeyEventHandler>
    </>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      cancelEditingBtn: {margin: Kb.Styles.globalMargins.xtiny},
      container: {
        backgroundColor: Kb.Styles.globalColors.white,
      },
      explodingIconContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          alignSelf: 'stretch',
          borderBottomLeftRadius: 3,
          borderTopLeftRadius: 3,
          justifyContent: 'flex-end',
          textAlign: 'center',
          width: 32,
        },
        isElectron: {
          borderRight: `1px solid ${Kb.Styles.globalColors.black_20}`,
          ...Kb.Styles.desktopStyles.clickable,
        },
      }),
      explodingInsideWrapper: {alignItems: 'center', height: 32},
      footer: {
        alignSelf: 'flex-end',
        color: Kb.Styles.globalColors.black_20,
        marginBottom: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.medium + 2,
        marginTop: 2,
        textAlign: 'right',
      },
      hidden: {display: 'none'},
      icon: {
        alignSelf: 'flex-end',
        marginBottom: 2,
        marginRight: Kb.Styles.globalMargins.xtiny,
        padding: Kb.Styles.globalMargins.xtiny,
      },
      input: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.transparent,
          lineHeight: 22,
          minHeight: 22,
        },
      }),
      inputBox: {
        minWidth: 0,
        paddingBottom: Kb.Styles.globalMargins.xtiny,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: Kb.Styles.globalMargins.tiny - 2,
        textAlign: 'left',
      },
      inputEditing: {color: Kb.Styles.globalColors.blackOrBlack},
      inputWrapper: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.white,
        borderColor: Kb.Styles.globalColors.black_20,
        borderRadius: 4,
        borderStyle: 'solid',
        borderWidth: 1,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.xtiny,
      },
      inputWrapperEditing: {backgroundColor: Kb.Styles.globalColors.yellowOrYellowAlt},
      inputWrapperExplodingMode: {borderColor: Kb.Styles.globalColors.black},
      sideButtons: {alignSelf: 'flex-end'},
      suggestionSpinnerStyle: {
        bottom: Kb.Styles.globalMargins.tiny,
        position: 'absolute',
        right: Kb.Styles.globalMargins.medium,
      },
    }) as const
)

// ==================== NATIVE PLATFORM INPUT ====================

const singleLineHeight = 36
const threeLineHeight = 78
const inputAreaHeight = 91
const maxExpandedSuggestionListHeight = 240
const minExpandedSuggestionListHeight = 120

type MenuType = 'exploding' | 'filepickerpopup' | 'moremenu'

type NativeButtonsProps = Pick<
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

const NativeButtons = function NativeButtons(p: NativeButtonsProps) {
  const AudioRecorder = (require('@/chat/audio/audio-recorder.native') as {default: React.ComponentType<{showAudioSend: boolean; setShowAudioSend: (s: boolean) => void}>}).default
  const {usePickerState} = require('@/chat/emoji-picker/use-picker') as {usePickerState: <T>(s: (state: {pickerMap: Map<string, {emojiStr: string}>; dispatch: {updatePickerMap: (k: string, v: undefined) => void}}) => T) => T}

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

  const lastEmojiRef = React.useRef('')
  React.useEffect(() => {
    if (lastEmojiRef.current === emojiStr) {
      return
    }
    lastEmojiRef.current = emojiStr
    if (emojiStr) {
      insertText(emojiStr + ' ')
      updatePickerMap(pickKey, undefined)
    }
  }, [emojiStr, insertText, updatePickerMap])

  const conversationIDKey = useConversationThreadID()
  const openEmojiPicker = () => {
    C.Router2.navigateAppend({
      name: 'chatChooseEmoji',
      params: {conversationIDKey, pickKey},
    })
  }

  const explodingIcon = !isEditing && !cannotWrite && (
    <Kb.ClickableBox style={nativeStyles.explodingWrapper} onClick={toggleShowingMenu}>
      {isExploding ? (
        <Kb.Box2 direction="horizontal" style={nativeStyles.exploding} centerChildren={true}>
          <Kb.Text type="BodyTinyBold" negative={true} style={nativeStyles.explodingText}>
            {formatDurationShort(explodingModeSeconds * 1000)}
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Icon color={undefined} type="iconfont-timer" />
      )}
    </Kb.ClickableBox>
  )

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={nativeStyles.actionContainer}>
      {isEditing && (
        <Kb.Button
          style={nativeStyles.editingButton}
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
          style={isExploding ? nativeStyles.explodingSendBtn : nativeStyles.sendBtn}
        />
      )}
    </Kb.Box2>
  )
}

const NativeAnimatedExpand = (() => {
  const {skipAnimations, useSharedValue, useAnimatedStyle, withTiming, default: Animated} = require('@/common-adapters/reanimated') as {
    skipAnimations: boolean
    useSharedValue: (v: number) => {set: (v: number) => void; value: number}
    useAnimatedStyle: (fn: () => object) => object
    withTiming: (v: number | string) => number | string
    default: {View: React.ComponentType<{style?: object | Array<object>; pointerEvents?: string; children?: React.ReactNode}>}
  }
  if (skipAnimations) {
    return function NativeAnimatedExpand() {
      return null
    }
  } else {
    return function NativeAnimatedExpand(p: {expandInput: () => void; expanded: boolean}) {
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
        <Kb.ClickableBox onClick={expandInput} style={nativeStyles.iconContainer}>
          <Animated.View style={[nativeStyles.iconTop, topStyle]} pointerEvents="none">
            <Kb.Icon
              type="iconfont-arrow-full-up"
              fontSize={18}
              color={Kb.Styles.globalColors.black_35}
            />
          </Animated.View>
          <Animated.View style={[nativeStyles.iconBottom, bottomStyle]} pointerEvents="none">
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

type NativeChatFilePickerProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  showingPopup: boolean
  hidePopup: () => void
}
const NativeChatFilePicker = (p: NativeChatFilePickerProps) => {
  const FilePickerPopup = (require('../filepicker-popup') as {default: React.ComponentType<{attachTo?: React.RefObject<Kb.MeasureRef | null>; visible: boolean; onHidden: () => void; onSelect: (mediaType: string, location: string) => void}>}).default
  const {launchCameraAsync, launchImageLibraryAsync} = require('@/util/expo-image-picker') as {
    launchCameraAsync: (mediaType: string) => Promise<{canceled: boolean; assets: Array<{uri: string}>}>
    launchImageLibraryAsync: (mediaType: string, allowMultiple: boolean, allowVideo: boolean) => Promise<{canceled: boolean; assets: Array<{uri: string}>}>
  }
  const {pickDocumentsAsync} = require('@/util/expo-document-picker.native') as {
    pickDocumentsAsync: (allowMultiple: boolean) => Promise<{canceled: boolean; assets: Array<{uri: string}>}>
  }
  const {filePickerError} = require('@/util/storeless-actions') as {filePickerError: (e: Error) => void}

  const {attachTo, showingPopup, hidePopup} = p
  const conversationIDKey = useConversationThreadID()
  const launchNativeImagePicker = (mediaType: string, location: string) => {
    const f = async () => {
      const handleSelection = (result: {canceled: boolean; assets: Array<{uri: string}>}) => {
        if (result.canceled || result.assets.length === 0) {
          return
        }
        const pathAndOutboxIDs = result.assets.map(a => ({path: a.uri}))
        C.Router2.navigateAppend({
          name: 'chatAttachmentGetTitles',
          params: {conversationIDKey, pathAndOutboxIDs},
        })
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
        case 'file':
          try {
            const res = await pickDocumentsAsync(true)
            if (!res.canceled && res.assets.length > 0) {
              const pathAndOutboxIDs = res.assets.map(a => ({path: a.uri}))
              C.Router2.navigateAppend({
                name: 'chatAttachmentGetTitles',
                params: {conversationIDKey, pathAndOutboxIDs},
              })
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

type NativeAnimatedInputProps = Omit<InputLowLevelProps, 'ref'> & {
  expanded: boolean
  inputRef?: React.Ref<RefType>
  reservedHeight?: number
}
const NativeAnimatedInput = (() => {
  const {skipAnimations, useSharedValue, useAnimatedStyle, withTiming, default: Animated} = require('@/common-adapters/reanimated') as {
    skipAnimations: boolean
    useSharedValue: (v: number) => {set: (v: number) => void; value: number}
    useAnimatedStyle: (fn: () => object) => object
    withTiming: (v: number | string) => number | string
    default: {View: React.ComponentType<{style?: object | Array<object>; pointerEvents?: string; children?: React.ReactNode}>}
  }
  const {MaxInputAreaContext} = require('./max-input-area-context') as {MaxInputAreaContext: React.Context<number>}
  if (skipAnimations) {
    return function NativeAnimatedInput(p: NativeAnimatedInputProps) {
      const {expanded: _expanded, inputRef, reservedHeight: _reservedHeight, ...rest} = p
      return (
        <Animated.View style={[p.style, rest.style]}>
          <NativeInput multiline={true} {...rest} ref={inputRef} style={nativeStyles.inputInner} />
        </Animated.View>
      )
    }
  } else {
    return function NativeAnimatedInput(p: NativeAnimatedInputProps) {
      'use no memo'
      const maxInputArea = React.useContext(MaxInputAreaContext)
      const {expanded, inputRef, reservedHeight = 0, ...rest} = p
      const lastExpandedRef = React.useRef(expanded)
      const offset = useSharedValue(expanded ? 1 : 0)
      const maxHeight = Math.max(threeLineHeight, maxInputArea - inputAreaHeight - 15 - reservedHeight)
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
          <NativeInput multiline={true} {...rest} ref={inputRef} style={nativeStyles.inputInner} />
        </Animated.View>
      )
    }
  }
})()

const NativePlatformInput = (p: Props) => {
  const {AudioSendWrapper} = require('@/chat/audio/audio-send.native') as {AudioSendWrapper: React.ComponentType<object>}
  const {Keyboard} = require('react-native') as {Keyboard: {dismiss: () => void}}
  const {onHWKeyPressed, removeOnHWKeyPressed} = require('react-native-kb') as {
    onHWKeyPressed: (cb: (e: {pressedKey: string}) => void) => void
    removeOnHWKeyPressed: () => void
  }
  const {standardTransformer} = require('../suggestors/common') as {standardTransformer: (text: string, opts: {position: {start: number | null; end: number | null}; text: string}, replaceWord: boolean) => TextInfo}
  const logger = require('@/logger').default as {info: (s: string, ...args: unknown[]) => void}
  const {MaxInputAreaContext} = require('./max-input-area-context') as {MaxInputAreaContext: React.Context<number>}
  type LayoutEvent = {nativeEvent: {layout: {height: number}}}


  const [showAudioSend, setShowAudioSend] = React.useState(false)
  const [height, setHeight] = React.useState(0)
  const [expanded, setExpanded] = React.useState(false)
  const inputRef = React.useRef<RefType | null>(null)
  const maxInputArea = React.useContext(MaxInputAreaContext)
  const preferredExpandedSuggestionListHeight = maxInputArea
    ? Math.max(
        minExpandedSuggestionListHeight,
        Math.min(maxExpandedSuggestionListHeight, Math.floor(maxInputArea * 0.35))
      )
    : 0
  const maxSuggestionReserveHeight = Math.max(0, maxInputArea - inputAreaHeight - 15 - threeLineHeight)
  const expandedSuggestionListHeight = Math.min(
    preferredExpandedSuggestionListHeight,
    maxSuggestionReserveHeight
  )
  const suggestionListStyle = Kb.Styles.collapseStyles([
    nativeStyles.suggestionList,
    !!height && {marginBottom: height},
    expanded && {maxHeight: expandedSuggestionListHeight},
  ])
  const suggestionSpinnerStyle = Kb.Styles.collapseStyles([nativeStyles.suggestionSpinnerStyle, !!height && {marginBottom: height}])
  const {
    popup: suggestorPopup,
    onChangeText,
    onBlur,
    onSelectionChange,
    onFocus,
    suggestionsShowing,
  } = useSuggestors({
    inputRef,
    onChangeText: p.onChangeText,
    suggestionListStyle,
    suggestionOverlayStyle: p.suggestionOverlayStyle,
    suggestionSpinnerStyle,
  })
  const {cannotWrite, isEditing, isExploding, setInputRef, setExplodingMode} = p
  const {onSubmit, explodingModeSeconds, hintText, onCancelEditing} = p
  const suggestionListReserveHeight = expanded && suggestionsShowing ? expandedSuggestionListHeight : 0

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
  }, [onQueueSubmit, onHWKeyPressed, removeOnHWKeyPressed, standardTransformer])

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    switch (whichMenu.current) {
      case 'filepickerpopup':
        return <NativeChatFilePicker attachTo={attachTo} showingPopup={true} hidePopup={hidePopup} />
      case 'moremenu': {
        const MoreMenuPopup = (require('./moremenu-popup.native') as {default: React.ComponentType<{onHidden: () => void; visible: boolean}>}).default
        return <MoreMenuPopup onHidden={hidePopup} visible={true} />
      }
      default:
        return (
          <SetExplodingMessagePopup
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
    Keyboard.dismiss()
    whichMenu.current = menu
    showPopup()
  }

  const openExplodingMenu = () => {
    ourShowMenu('exploding')
  }

  const conversationIDKey = useConversationThreadID()
  const onPasteImage = (uri: Array<string>) => {
    try {
      const pathAndOutboxIDs = uri.map(path => ({path}))
      C.Router2.navigateAppend({
        name: 'chatAttachmentGetTitles',
        params: {conversationIDKey, pathAndOutboxIDs},
      })
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
          style={Kb.Styles.collapseStyles([nativeStyles.container, isExploding && nativeStyles.explodingContainer])}
          fullWidth={true}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true} style={nativeStyles.inputContainer}>
            <NativeAnimatedInput
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
              style={nativeStyles.input}
              textType="Body"
              rowsMin={1}
              reservedHeight={suggestionListReserveHeight}
              expanded={expanded}
            />
            <NativeAnimatedExpand expandInput={toggleExpandInput} expanded={expanded} />
          </Kb.Box2>
          <NativeButtons
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
        <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical" style={nativeStyles.sendWrapper}>
          <AudioSendWrapper />
        </Kb.Box2>
      )}
    </>
  )
}

const nativeStyles = Kb.Styles.styleSheetCreate(
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

export default isMobile ? NativePlatformInput : DesktopPlatformInput

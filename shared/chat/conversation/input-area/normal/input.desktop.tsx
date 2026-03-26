import * as Chat from '@/stores/chat'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import SetExplodingMessagePopup from './set-explode-popup'
import Typing from './typing'
import type {Props as InputLowLevelProps, TextInfo, RefType} from './input'
import type {PlatformInputProps as Props} from './input'
import {EmojiPickerDesktop} from '@/chat/emoji-picker/container'
import {KeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {formatDurationShort} from '@/util/timestamp'
import {useSuggestors} from '../suggestors'
import {ScrollContext} from '@/chat/conversation/normal/context'
import {getTextStyle} from '@/common-adapters/text.styles'
import {useColorScheme} from 'react-native'
import KB2 from '@/util/electron.desktop'

const {getPathForFile} = KB2.functions

const maybeParseInt = (input: string | number, radix: number): number =>
  typeof input === 'string' ? parseInt(input, radix) : input

export function Input(p: InputLowLevelProps) {
  const {style: _style, onChangeText: _onChangeText, multiline, ref} = p
  const {textType = 'Body', rowsMax, rowsMin, padding, placeholder, onKeyUp: _onKeyUp} = p
  const {allowKeyboardEvents, className, disabled, autoFocus, onKeyDown: _onKeyDown, onEnterKeyDown} = p

  const isDarkMode = useColorScheme() === 'dark'

  const [value, setValue] = React.useState('')
  // this isn't a value react can set on the input, so we need to drive it manually
  const selectionRef = React.useRef({end: 0, start: 0})
  const inputSingleRef = React.useRef<HTMLInputElement>(null)
  const inputMultiRef = React.useRef<HTMLTextAreaElement>(null)

  const onChangeTextRef = React.useRef(_onChangeText)
  React.useEffect(() => {
    onChangeTextRef.current = _onChangeText
  }, [_onChangeText])
  const [onChange] = React.useState(() => (e: {target: HTMLInputElement | HTMLTextAreaElement}) => {
    const s = e.target.value
    setValue(s)
    onChangeTextRef.current?.(s)
  })
  const onSelect = (e: {currentTarget: HTMLInputElement | HTMLTextAreaElement}) => {
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
      isFocused: () => !!i && document.activeElement === i,
      transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean): void => {
        const ti = fn({selection: selectionRef.current, text: value})
        // defer since we can do this in other renders
        setTimeout(() => {
          setValue(ti.text)
          selectionRef.current = {end: ti.selection?.end ?? 0, start: ti.selection?.start ?? 0}
          // defer this else we'll get onSelect called and wipe it out
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
          rowsMax *
          (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20)
      }

      const paddingStyles = padding ? Kb.Styles.padding(Kb.Styles.globalMargins[padding]) : {}

      return Kb.Styles.collapseStyles([
        inputLowLevelStyles.noChrome, // noChrome comes before because we want lineHeight set in multiline
        textStyle,
        inputLowLevelStyles.multiline,
        heightStyles,
        paddingStyles,
        _style,
      ])
    } else {
      return Kb.Styles.collapseStyles([
        textStyle,
        inputLowLevelStyles.noChrome, // noChrome comes after to unset lineHeight in singleline
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

  return multiline ? (
    <textarea {...commonProps} style={Kb.Styles.castStyleDesktop(style)} ref={inputMultiRef} rows={rows} />
  ) : (
    <input {...commonProps} ref={inputSingleRef} style={Kb.Styles.castStyleDesktop(style)} />
  )
}

const inputLowLevelStyles = Kb.Styles.styleSheetCreate(() => ({
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

// Sub-components for the chat input chrome

type HtmlInputRefType = React.RefObject<HTMLInputElement | null>
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
        styles.explodingIconContainer,
        !!explodingModeSeconds && {
          backgroundColor: Kb.Styles.globalColors.black,
        },
      ])}
    >
      {popup}
      <Kb.Box2
        direction="vertical"
        style={styles.explodingInsideWrapper}
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
  const {inputRef} = p
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
        <EmojiPickerDesktop onPickAction={insertEmoji} onDidPick={hidePopup} />
      </Kb.Popup>
    )
  }

  const {popup, popupAnchor, showingPopup, showPopup} = Kb.usePopup2(makePopup)

  return (
    <>
      <Kb.Box2
        direction="vertical"
        style={styles.icon}
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
  const toggleGiphyPrefill = Chat.useChatContext(s => s.dispatch.toggleGiphyPrefill)
  const onGiphyToggle = toggleGiphyPrefill

  return (
    <Kb.Box2 direction="vertical" style={styles.icon} tooltip="GIF" className="tooltip-top-left">
      <Kb.Icon onClick={onGiphyToggle} type="iconfont-gif" />
    </Kb.Box2>
  )
}

const fileListToPaths = (f: FileList): Array<string> => {
  return Array.from(f).map(f => getPathForFile?.(f) ?? '')
}

const FileButton = function FileButton(p: {
  setHtmlInputRef: (i: HTMLInputElement | null) => void
}) {
  const {setHtmlInputRef} = p
  const htmlInputRef = React.useRef<HTMLInputElement | null>(null)
  const navigateAppend = Chat.useChatNavigateAppend()
  const pickFile = () => {
    const paths = htmlInputRef.current?.files ? fileListToPaths(htmlInputRef.current.files) : undefined
    const pathAndOutboxIDs = paths?.reduce<Array<{path: string}>>((arr, path: string) => {
      path && arr.push({path})
      return arr
    }, [])
    if (pathAndOutboxIDs?.length) {
      navigateAppend(conversationIDKey => ({
        name: 'chatAttachmentGetTitles',
        params: {conversationIDKey, pathAndOutboxIDs},
      }))
    }

    if (htmlInputRef.current) {
      htmlInputRef.current.value = ''
    }
  }

  const filePickerOpen = () => {
    htmlInputRef.current?.click()
  }

  const setRef = (e: HTMLInputElement | null) => {
    htmlInputRef.current = e
    setHtmlInputRef(e)
  }

  return (
    <Kb.Box2 direction="vertical" style={styles.icon} tooltip="Attachment" className="tooltip-top-left">
      <Kb.Icon onClick={filePickerOpen} type="iconfont-attachment" />
      <input type="file" style={styles.hidden} ref={setRef} onChange={pickFile} multiple={true} />
    </Kb.Box2>
  )
}

const Footer = () => {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" justifyContent="space-between">
      <Typing />
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.footer} selectable={true}>
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
  const setReplyTo = Chat.useChatContext(s => s.dispatch.setReplyTo)
  const {scrollDown, scrollUp} = React.useContext(ScrollContext)
  const onCancelReply = () => {
    setReplyTo(T.Chat.numberToOrdinal(0))
  }

  const commonOnKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
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

  const globalKeyDownPressHandler = (ev: KeyboardEvent) => {
    const target = ev.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
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
  setHtmlInputRef: (i: HTMLInputElement | null) => void
  inputRef: InputRefType
}

const SideButtons = (p: SideButtonsProps) => {
  const {setHtmlInputRef, cannotWrite, inputRef} = p
  return (
    <Kb.Box2 direction="horizontal" style={styles.sideButtons}>
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

const PlatformInput = function PlatformInput(p: Props) {
  const {cannotWrite, explodingModeSeconds, onCancelEditing, setExplodingMode} = p
  const {showReplyPreview, hintText, setInputRef, isEditing, onSubmit} = p
  const htmlInputRef = React.useRef<HTMLInputElement | null>(null)
  const setHtmlInputRef = (i: HTMLInputElement | null) => {
    htmlInputRef.current = i
  }
  const inputRef = React.useRef<RefType | null>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const checkEnterOnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.altKey || e.shiftKey || e.metaKey)) {
      e.preventDefault()
      inputRef.current && onSubmit(inputRef.current.value)
    }
  }

  const {
    popup,
    onKeyDown,
    onChangeText: onChangeTextSuggestors,
  } = useSuggestors({
    expanded: false,
    inputRef,
    onChangeText: p.onChangeText,
    onKeyDown: checkEnterOnKeyDown,
    suggestBotCommandsUpdateStatus: p.suggestBotCommandsUpdateStatus,
    suggestionListStyle: undefined,
    suggestionOverlayStyle: p.suggestionOverlayStyle,
    suggestionSpinnerStyle: styles.suggestionSpinnerStyle,
  })

  const focusInput = () => {
    inputRef.current?.focus()
  }
  const setEditing = Chat.useChatContext(s => s.dispatch.setEditing)
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
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.Box2
            direction="horizontal"
            alignItems="flex-end"
            style={Kb.Styles.collapseStyles([
              styles.inputWrapper,
              isEditing && styles.inputWrapperEditing,
              explodingModeSeconds && styles.inputWrapperExplodingMode,
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
                style={styles.cancelEditingBtn}
                type="Dim"
              />
            )}
            <Kb.Box2 direction="horizontal" flex={1} overflow="hidden" style={styles.inputBox}>
              <Input
                allowKeyboardEvents={true}
                disabled={cannotWrite}
                autoFocus={false}
                ref={setRefs}
                placeholder={hintText}
                style={Kb.Styles.collapseStyles([styles.input, isEditing && styles.inputEditing])}
                onChangeText={onChangeText}
                multiline={true}
                rowsMin={1}
                rowsMax={10}
                onKeyDown={inputKeyDown}
              />
            </Kb.Box2>
            <SideButtons cannotWrite={cannotWrite} setHtmlInputRef={setHtmlInputRef} inputRef={inputRef} />
          </Kb.Box2>
          <Footer />
        </Kb.Box2>
      </KeyEventHandler>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
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

export default PlatformInput

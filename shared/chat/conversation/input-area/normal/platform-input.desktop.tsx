import * as C from '../../../../constants'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import SetExplodingMessagePopup from '../../messages/set-explode-popup/container'
import Typing from './typing'
import type {Props} from './platform-input'
import {EmojiPickerDesktop} from '../../../emoji-picker/container'
import {KeyEventHandler} from '../../../../common-adapters/key-event-handler.desktop'
import {formatDurationShort} from '../../../../util/timestamp'
import {useSuggestors} from '../suggestors'
import {ScrollContext} from '../../normal/context'

type HtmlInputRefType = React.MutableRefObject<HTMLInputElement | null>
type InputRefType = React.MutableRefObject<Kb.PlainInput | null>

type ExplodingButtonProps = Pick<Props, 'explodingModeSeconds'> & {
  focusInput: () => void
}
const ExplodingButton = (p: ExplodingButtonProps) => {
  const {explodingModeSeconds, focusInput} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <SetExplodingMessagePopup
          attachTo={attachTo}
          onAfterSelect={focusInput}
          onHidden={toggleShowingPopup}
          visible={true}
        />
      )
    },
    [focusInput]
  )
  const {popup, popupAnchor, showingPopup, toggleShowingPopup} = Kb.usePopup2(makePopup)

  return (
    <Kb.ClickableBox2
      className={Kb.Styles.classNames({expanded: showingPopup}, 'timer-icon-container')}
      onClick={toggleShowingPopup}
      ref={popupAnchor}
      style={Kb.Styles.collapseStyles([
        styles.explodingIconContainer,
        !!explodingModeSeconds && {
          backgroundColor: Kb.Styles.globalColors.black,
        },
      ] as any)}
    >
      {popup}
      <Kb.Box2 direction="vertical" style={styles.explodingInsideWrapper}>
        {explodingModeSeconds ? (
          <Kb.Text type="BodyTinyBold" negative={true}>
            {formatDurationShort(explodingModeSeconds * 1000)}
          </Kb.Text>
        ) : (
          <Kb.WithTooltip tooltip="Timer">
            <Kb.Icon
              className={Kb.Styles.classNames('timer-icon', 'hover_color_black')}
              onClick={toggleShowingPopup}
              padding="xtiny"
              type="iconfont-timer"
            />
          </Kb.WithTooltip>
        )}
      </Kb.Box2>
    </Kb.ClickableBox2>
  )
}

type EmojiButtonProps = {inputRef: InputRefType}
const EmojiButton = (p: EmojiButtonProps) => {
  const {inputRef} = p
  const insertEmoji = React.useCallback(
    (emojiColons: string) => {
      inputRef.current?.transformText(({text, selection}) => {
        const newText =
          text.slice(0, selection.start || 0) + emojiColons + text.slice(selection.end || 0) + ' '
        const pos = (selection.start || 0) + emojiColons.length + 1
        return {
          selection: {end: pos, start: pos},
          text: newText,
        }
      }, true)
      inputRef.current?.focus()
    },
    [inputRef]
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.Overlay attachTo={attachTo} visible={true} onHidden={toggleShowingPopup} position="top right">
          <EmojiPickerDesktop onPickAction={insertEmoji} onDidPick={toggleShowingPopup} />
        </Kb.Overlay>
      )
    },
    [insertEmoji]
  )

  const {popup, popupAnchor, showingPopup, toggleShowingPopup} = Kb.usePopup2(makePopup)

  return (
    <>
      <Kb.WithTooltip tooltip="Emoji">
        <Kb.Box2Measure direction="vertical" style={styles.icon} ref={popupAnchor}>
          <Kb.Icon
            color={showingPopup ? Kb.Styles.globalColors.black : undefined}
            onClick={toggleShowingPopup}
            type="iconfont-emoji"
          />
        </Kb.Box2Measure>
      </Kb.WithTooltip>
      {popup}
    </>
  )
}

const GiphyButton = () => {
  const toggleGiphyPrefill = C.useChatContext(s => s.dispatch.toggleGiphyPrefill)
  const onGiphyToggle = toggleGiphyPrefill

  return (
    <Kb.WithTooltip tooltip="GIF">
      <Kb.Box style={styles.icon}>
        <Kb.Icon onClick={onGiphyToggle} type="iconfont-gif" />
      </Kb.Box>
    </Kb.WithTooltip>
  )
}

const fileListToPaths = (f: any): Array<string> =>
  Array.prototype.map.call(f || [], (f: File) => {
    // We rely on path being here, even though it's
    // not part of the File spec.
    return f.path
  }) as any

const FileButton = (p: {htmlInputRef: HtmlInputRefType}) => {
  const {htmlInputRef} = p
  const navigateAppend = C.useChatNavigateAppend()
  const pickFile = React.useCallback(() => {
    const paths = fileListToPaths(htmlInputRef.current?.files)
    const pathAndOutboxIDs = paths.reduce<Array<{path: string}>>((arr, path: string) => {
      path && arr.push({path})
      return arr
    }, [])
    if (pathAndOutboxIDs.length) {
      navigateAppend(conversationIDKey => ({
        props: {conversationIDKey, pathAndOutboxIDs},
        selected: 'chatAttachmentGetTitles',
      }))
    }

    if (htmlInputRef.current) {
      htmlInputRef.current.value = ''
    }
  }, [htmlInputRef, navigateAppend])

  const filePickerOpen = React.useCallback(() => {
    htmlInputRef.current?.click()
  }, [htmlInputRef])

  return (
    <Kb.WithTooltip tooltip="Attachment">
      <Kb.Box style={styles.icon}>
        <Kb.Icon onClick={filePickerOpen} type="iconfont-attachment" />
        <input type="file" style={styles.hidden} ref={htmlInputRef} onChange={pickFile} multiple={true} />
      </Kb.Box>
    </Kb.WithTooltip>
  )
}

const Footer = (p: {focusInput: () => void}) => {
  return (
    <Kb.Box style={styles.footerContainer}>
      <Typing />
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.footer} onClick={p.focusInput} selectable={true}>
        {`*bold*, _italics_, \`code\`, >quote, @user, @team, #channel`}
      </Kb.Text>
    </Kb.Box>
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
  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const {scrollDown, scrollUp} = React.useContext(ScrollContext)
  const onCancelReply = React.useCallback(() => {
    setReplyTo(0)
  }, [setReplyTo])

  // Key-handling code shared by both the input key handler
  // (_onKeyDown) and the global key handler
  // (_globalKeyDownPressHandler).
  const commonOnKeyDown = React.useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
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
    },
    [
      isEditing,
      showReplyPreview,
      htmlInputRef,
      lastText,
      onEditLastMessage,
      onCancelEditing,
      onCancelReply,
      scrollDown,
      scrollUp,
    ]
  )

  const globalKeyDownPressHandler = React.useCallback(
    (ev: KeyboardEvent) => {
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
    },
    [focusInput, commonOnKeyDown]
  )

  const inputKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      commonOnKeyDown(e)
      onKeyDown?.(e)
    },
    [commonOnKeyDown, onKeyDown]
  )

  const onChangeTextInner = React.useCallback(
    (text: string) => {
      lastText.current = text
      onChangeText(text)
    },
    [onChangeText, lastText]
  )

  return {globalKeyDownPressHandler, inputKeyDown, onChangeText: onChangeTextInner}
}

type SideButtonsProps = Pick<Props, 'cannotWrite'> & {
  htmlInputRef: HtmlInputRefType
  inputRef: InputRefType
}

const SideButtons = (p: SideButtonsProps) => {
  const {htmlInputRef, cannotWrite, inputRef} = p
  return (
    <Kb.Box2 direction="horizontal" style={styles.sideButtons}>
      {!cannotWrite && (
        <>
          <GiphyButton />
          <EmojiButton inputRef={inputRef} />
          <FileButton htmlInputRef={htmlInputRef} />
        </>
      )}
    </Kb.Box2>
  )
}

const PlatformInput = React.memo(function PlatformInput(p: Props) {
  const {cannotWrite, explodingModeSeconds, onCancelEditing} = p
  const {showReplyPreview, hintText, inputSetRef, isEditing, onSubmit} = p
  const htmlInputRef = React.useRef<HTMLInputElement>(null)
  const inputRef = React.useRef<Kb.PlainInput | null>(null)
  const conversationIDKey = C.useChatContext(s => s.id)

  // keep focus
  C.useCIDChanged(conversationIDKey, () => {
    inputRef.current?.focus()
  })
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const checkEnterOnKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.altKey || e.shiftKey || e.metaKey)) {
        e.preventDefault()
        inputRef.current && onSubmit(inputRef.current.value)
      }
    },
    [onSubmit]
  )

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

  const focusInput = React.useCallback(() => {
    inputRef.current?.focus()
  }, [inputRef])
  const setEditing = C.useChatContext(s => s.dispatch.setEditing)
  const onEditLastMessage = React.useCallback(() => {
    setEditing(true)
  }, [setEditing])

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

  const setRefs = React.useCallback(
    (ref: null | Kb.PlainInput) => {
      // from normal/index
      inputSetRef.current = ref
      // from suggestors/index
      inputRef.current = ref
    },
    [inputRef, inputSetRef]
  )

  return (
    <>
      {popup}
      <KeyEventHandler onKeyDown={globalKeyDownPressHandler} onKeyPress={globalKeyDownPressHandler}>
        <Kb.Box style={styles.container}>
          <Kb.Box
            style={Kb.Styles.collapseStyles([
              styles.inputWrapper,
              isEditing && styles.inputWrapperEditing,
              explodingModeSeconds && styles.inputWrapperExplodingMode,
            ])}
          >
            {!isEditing && !cannotWrite && (
              <ExplodingButton explodingModeSeconds={explodingModeSeconds} focusInput={focusInput} />
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
            <Kb.Box2 direction="horizontal" style={styles.inputBox}>
              <Kb.PlainInput
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
            <SideButtons cannotWrite={cannotWrite} htmlInputRef={htmlInputRef} inputRef={inputRef} />
          </Kb.Box>
          <Footer focusInput={focusInput} />
        </Kb.Box>
      </KeyEventHandler>
    </>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      cancelEditingBtn: {margin: Kb.Styles.globalMargins.xtiny},
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        backgroundColor: Kb.Styles.globalColors.white,
        width: '100%',
      },
      emojiPickerContainer: Kb.Styles.platformStyles({
        common: {
          borderRadius: 4,
          bottom: 32,
          position: 'absolute',
          right: -64,
        },
        isElectron: {...Kb.Styles.desktopStyles.boxShadow},
      }),
      emojiPickerContainerWrapper: {...Kb.Styles.globalStyles.fillAbsolute},
      emojiPickerRelative: {position: 'relative'},
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
      explodingInsideWrapper: {alignItems: 'center', height: 32, justifyContent: 'center'},
      footer: {
        alignSelf: 'flex-end',
        color: Kb.Styles.globalColors.black_20,
        marginBottom: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.medium + 2,
        marginTop: 2,
        textAlign: 'right',
      },
      footerContainer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
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
          height: 22,
          // Line height change is so that emojis (unicode characters inside
          // textarea) are not clipped at the top. This change is accompanied by
          // a change in padding to offset the increased line height
          lineHeight: 22,
          minHeight: 22,
        },
      }),
      inputBox: {
        flexGrow: 1,
        flexShrink: 0,
        paddingBottom: Kb.Styles.globalMargins.xtiny,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: Kb.Styles.globalMargins.tiny - 2,
        textAlign: 'left',
      },
      inputEditing: {color: Kb.Styles.globalColors.blackOrBlack},
      inputWrapper: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-end',
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
      walletsIcon: {
        alignSelf: 'flex-end',
        marginBottom: 2,
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

export default PlatformInput

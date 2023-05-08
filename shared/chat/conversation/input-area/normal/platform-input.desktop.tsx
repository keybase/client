/* eslint-env browser */
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import SetExplodingMessagePopup from '../../messages/set-explode-popup/container'
import Typing from './typing'
import WalletsIcon from './wallets-icon'
import type * as Types from '../../../../constants/types/chat2'
import type {Props} from './platform-input'
import {EmojiPickerDesktop} from '../../../emoji-picker/container'
import {KeyEventHandler} from '../../../../util/key-event-handler.desktop'
import {formatDurationShort} from '../../../../util/timestamp'
import {useSuggestors} from '../suggestors'

type HtmlInputRefType = React.MutableRefObject<HTMLInputElement | null>
type InputRefType = React.MutableRefObject<Kb.PlainInput | null>

type ExplodingButtonProps = Pick<Props, 'explodingModeSeconds' | 'conversationIDKey'> & {
  focusInput: () => void
}
const ExplodingButton = (p: ExplodingButtonProps) => {
  const {explodingModeSeconds, conversationIDKey, focusInput} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <SetExplodingMessagePopup
          attachTo={attachTo}
          conversationIDKey={conversationIDKey}
          onAfterSelect={focusInput}
          onHidden={toggleShowingPopup}
          visible={true}
        />
      )
    },
    [conversationIDKey, focusInput]
  )
  const {popup, popupAnchor, showingPopup, toggleShowingPopup} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box
      className={Styles.classNames({expanded: showingPopup}, 'timer-icon-container')}
      onClick={toggleShowingPopup}
      forwardedRef={popupAnchor}
      style={Styles.collapseStyles([
        styles.explodingIconContainer,
        styles.explodingIconContainerClickable,
        !!explodingModeSeconds && {
          backgroundColor: Styles.globalColors.black,
        },
      ] as any)}
    >
      {popup}
      {explodingModeSeconds ? (
        <Kb.Text type="BodyTinyBold" negative={true}>
          {formatDurationShort(explodingModeSeconds * 1000)}
        </Kb.Text>
      ) : (
        <Kb.WithTooltip tooltip="Timer">
          <Kb.Icon
            className={Styles.classNames('timer-icon', 'hover_color_black')}
            colorOverride={null}
            onClick={toggleShowingPopup}
            padding="xtiny"
            type="iconfont-timer"
          />
        </Kb.WithTooltip>
      )}
    </Kb.Box>
  )
}

type EmojiButtonProps = Pick<Props, 'conversationIDKey'> & {inputRef: InputRefType}
const EmojiButton = (p: EmojiButtonProps) => {
  const {inputRef, conversationIDKey} = p
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

  const {popup, popupAnchor, showingPopup, toggleShowingPopup} = Kb.usePopup(attachTo => {
    return (
      <Kb.Overlay
        attachTo={attachTo}
        visible={showingPopup}
        onHidden={toggleShowingPopup}
        position="top right"
      >
        <EmojiPickerDesktop
          conversationIDKey={conversationIDKey}
          onPickAction={insertEmoji}
          onDidPick={toggleShowingPopup}
        />
      </Kb.Overlay>
    )
  })

  return (
    <>
      <Kb.WithTooltip tooltip="Emoji">
        <Kb.Box style={styles.icon} ref={popupAnchor}>
          <Kb.Icon
            color={showingPopup ? Styles.globalColors.black : null}
            onClick={toggleShowingPopup}
            type="iconfont-emoji"
          />
        </Kb.Box>
      </Kb.WithTooltip>
      {popup}
    </>
  )
}

const GiphyButton = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const dispatch = Container.useDispatch()
  const onGiphyToggle = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleGiphyPrefill({conversationIDKey}))
  }, [conversationIDKey, dispatch])

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

const FileButton = (p: {conversationIDKey: Types.ConversationIDKey; htmlInputRef: HtmlInputRefType}) => {
  const {htmlInputRef, conversationIDKey} = p
  const dispatch = Container.useDispatch()
  const pickFile = React.useCallback(() => {
    const paths = fileListToPaths(htmlInputRef.current?.files)
    const pathAndOutboxIDs = paths.reduce<Array<{outboxID: null; path: string}>>((arr, path: string) => {
      path && arr.push({outboxID: null, path})
      return arr
    }, [])
    if (pathAndOutboxIDs.length) {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'}],
        })
      )
    }

    if (htmlInputRef.current) {
      htmlInputRef.current.value = ''
    }
  }, [htmlInputRef, dispatch, conversationIDKey])

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

const Footer = (p: {conversationIDKey: Types.ConversationIDKey; focusInput: () => void}) => {
  return (
    <Kb.Box style={styles.footerContainer}>
      <Typing conversationIDKey={p.conversationIDKey} />
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.footer} onClick={p.focusInput} selectable={true}>
        {`*bold*, _italics_, \`code\`, >quote, @user, @team, #channel`}
      </Kb.Text>
    </Kb.Box>
  )
}

type UseKeyboardProps = Pick<
  Props,
  | 'conversationIDKey'
  | 'isEditing'
  | 'onChangeText'
  | 'onRequestScrollDown'
  | 'onRequestScrollUp'
  | 'showReplyPreview'
> & {
  focusInput: () => void
  htmlInputRef: HtmlInputRefType
  onKeyDown?: (evt: React.KeyboardEvent) => void
  onEditLastMessage: () => void
  onCancelEditing: () => void
}
const useKeyboard = (p: UseKeyboardProps) => {
  const {htmlInputRef, focusInput, isEditing, onKeyDown, conversationIDKey, onCancelEditing} = p
  const {onChangeText, onEditLastMessage, onRequestScrollDown, onRequestScrollUp, showReplyPreview} = p
  const lastText = React.useRef('')
  const dispatch = Container.useDispatch()
  const onCancelReply = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey}))
  }, [dispatch, conversationIDKey])

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
        onRequestScrollDown()
        return true
      } else if (e.key === 'PageUp') {
        onRequestScrollUp()
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
      onRequestScrollDown,
      onRequestScrollUp,
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

type SideButtonsProps = Pick<Props, 'conversationIDKey' | 'showWalletsIcon' | 'cannotWrite'> & {
  htmlInputRef: HtmlInputRefType
  inputRef: InputRefType
}

const SideButtons = (p: SideButtonsProps) => {
  const {htmlInputRef, conversationIDKey, cannotWrite, showWalletsIcon, inputRef} = p
  return (
    <>
      {!cannotWrite && showWalletsIcon && (
        <Kb.WithTooltip tooltip="Lumens">
          <WalletsIcon size={16} style={styles.walletsIcon} conversationIDKey={conversationIDKey} />
        </Kb.WithTooltip>
      )}
      {!cannotWrite && (
        <>
          <GiphyButton conversationIDKey={conversationIDKey} />
          <EmojiButton inputRef={inputRef} conversationIDKey={conversationIDKey} />
          <FileButton conversationIDKey={conversationIDKey} htmlInputRef={htmlInputRef} />
        </>
      )}
    </>
  )
}

const getYou = (state: Container.TypedState) => state.config.username

const PlatformInput = React.memo(function PlatformInput(p: Props) {
  const {cannotWrite, conversationIDKey, explodingModeSeconds, onCancelEditing} = p
  const {showWalletsIcon, hintText, inputSetRef, isEditing, onSubmit} = p
  const {onRequestScrollDown, onRequestScrollUp, showReplyPreview} = p
  const htmlInputRef = React.useRef<HTMLInputElement>(null)
  const inputRef = React.useRef<Kb.PlainInput | null>(null)

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
    conversationIDKey,
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
  const dispatch = Container.useDispatch()
  const you = Container.useSelector(getYou)
  const onEditLastMessage = React.useCallback(() => {
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        editLastUser: you,
        ordinal: null,
      })
    )
  }, [dispatch, conversationIDKey, you])

  const {globalKeyDownPressHandler, inputKeyDown, onChangeText} = useKeyboard({
    conversationIDKey,
    focusInput,
    htmlInputRef,
    isEditing,
    onCancelEditing,
    onChangeText: onChangeTextSuggestors,
    onEditLastMessage,
    onKeyDown,
    onRequestScrollDown,
    onRequestScrollUp,
    showReplyPreview,
  })

  return (
    <>
      {popup}
      <KeyEventHandler onKeyDown={globalKeyDownPressHandler} onKeyPress={globalKeyDownPressHandler}>
        <Kb.Box style={styles.container}>
          <Kb.Box
            style={Styles.collapseStyles([
              styles.inputWrapper,
              isEditing && styles.inputWrapperEditing,
              explodingModeSeconds && styles.inputWrapperExplodingMode,
            ])}
          >
            {!isEditing && !cannotWrite && (
              <ExplodingButton
                explodingModeSeconds={explodingModeSeconds}
                conversationIDKey={conversationIDKey}
                focusInput={focusInput}
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
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputBox}>
              <Kb.PlainInput
                allowKeyboardEvents={true}
                disabled={cannotWrite ?? false}
                autoFocus={false}
                ref={(ref: null | Kb.PlainInput) => {
                  // from normal/index
                  inputSetRef.current = ref
                  // from suggestors/index
                  inputRef.current = ref
                }}
                placeholder={hintText}
                style={Styles.collapseStyles([styles.input, isEditing && styles.inputEditing])}
                onChangeText={onChangeText}
                multiline={true}
                rowsMin={1}
                rowsMax={10}
                onKeyDown={inputKeyDown}
              />
            </Kb.Box2>
            <SideButtons
              cannotWrite={cannotWrite}
              conversationIDKey={conversationIDKey}
              showWalletsIcon={showWalletsIcon}
              htmlInputRef={htmlInputRef}
              inputRef={inputRef}
            />
          </Kb.Box>
          <Footer conversationIDKey={conversationIDKey} focusInput={focusInput} />
        </Kb.Box>
      </KeyEventHandler>
    </>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      cancelEditingBtn: {margin: Styles.globalMargins.xtiny},
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        backgroundColor: Styles.globalColors.white,
        width: '100%',
      },
      emojiPickerContainer: Styles.platformStyles({
        common: {
          borderRadius: 4,
          bottom: 32,
          position: 'absolute',
          right: -64,
        },
        isElectron: {...Styles.desktopStyles.boxShadow},
      }),
      emojiPickerContainerWrapper: {...Styles.globalStyles.fillAbsolute},
      emojiPickerRelative: {position: 'relative'},
      explodingIconContainer: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          alignSelf: 'stretch',
          borderBottomLeftRadius: 3,
          borderTopLeftRadius: 3,
          justifyContent: 'center',
          textAlign: 'center',
          width: 32,
        },
        isElectron: {borderRight: `1px solid ${Styles.globalColors.black_20}`},
      }),
      explodingIconContainerClickable: Styles.platformStyles({
        isElectron: {...Styles.desktopStyles.clickable},
      }),
      footer: {
        alignSelf: 'flex-end',
        color: Styles.globalColors.black_20,
        marginBottom: Styles.globalMargins.xtiny,
        marginRight: Styles.globalMargins.medium + 2,
        marginTop: 2,
        textAlign: 'right',
      },
      footerContainer: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      },
      hidden: {display: 'none'},
      icon: {
        alignSelf: 'flex-end',
        marginBottom: 2,
        marginRight: Styles.globalMargins.xtiny,
        padding: Styles.globalMargins.xtiny,
      },
      input: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.transparent,
          height: 22,
          // Line height change is so that emojis (unicode characters inside
          // textarea) are not clipped at the top. This change is accompanied by
          // a change in padding to offset the increased line height
          lineHeight: 22,
          minHeight: 22,
        },
      }),
      inputBox: {
        flex: 1,
        paddingBottom: Styles.globalMargins.xtiny,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: Styles.globalMargins.tiny - 2,
        textAlign: 'left',
      },
      inputEditing: {color: Styles.globalColors.blackOrBlack},
      inputWrapper: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'flex-end',
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.black_20,
        borderRadius: 4,
        borderStyle: 'solid',
        borderWidth: 1,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.xtiny,
      },
      inputWrapperEditing: {backgroundColor: Styles.globalColors.yellowOrYellowAlt},
      inputWrapperExplodingMode: {borderColor: Styles.globalColors.black},
      suggestionSpinnerStyle: {
        bottom: Styles.globalMargins.tiny,
        position: 'absolute',
        right: Styles.globalMargins.medium,
      },
      walletsIcon: {
        alignSelf: 'flex-end',
        marginBottom: 2,
        marginRight: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default PlatformInput

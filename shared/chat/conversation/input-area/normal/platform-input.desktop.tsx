/* eslint-env browser */
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'
import SetExplodingMessagePopup from '../../messages/set-explode-popup/container'
import {formatDurationShort} from '../../../../util/timestamp'
import {KeyEventHandler} from '../../../../util/key-event-handler.desktop'
import WalletsIcon from './wallets-icon/container'
import type {PlatformInputPropsInternal} from './platform-input'
import Typing from './typing/container'
import {useSuggestors} from '../suggestors'
import {indefiniteArticle} from '../../../../util/string'
import * as Container from '../../../../util/container'
import {useMemo} from '../../../../util/memoize'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {EmojiPickerDesktop} from '../../messages/react-button/emoji-picker/container'

const ExplodingButton = (
  p: Pick<
    PlatformInputPropsInternal,
    'showingExplodingMenu' | 'setAttachmentRef' | 'explodingModeSeconds' | 'toggleShowingMenu'
  >
) => {
  const {showingExplodingMenu, setAttachmentRef, explodingModeSeconds, toggleShowingMenu} = p
  return (
    <HoverBox
      className={Styles.classNames({expanded: showingExplodingMenu})}
      onClick={toggleShowingMenu}
      ref={setAttachmentRef}
      style={Styles.collapseStyles([
        styles.explodingIconContainer,
        styles.explodingIconContainerClickable,
        !!explodingModeSeconds && {
          backgroundColor: Styles.globalColors.black,
        },
      ] as const)}
    >
      {explodingModeSeconds ? (
        <Kb.Text type="BodyTinyBold" negative={true}>
          {formatDurationShort(explodingModeSeconds * 1000)}
        </Kb.Text>
      ) : (
        <Kb.WithTooltip tooltip="Timer">
          <Kb.Icon
            className="timer"
            colorOverride={null}
            onClick={toggleShowingMenu}
            padding="xtiny"
            type="iconfont-timer"
          />
        </Kb.WithTooltip>
      )}
    </HoverBox>
  )
}

const EmojiButton = (
  p: Pick<ReturnType<typeof useEmojiPicker>, 'emojiPickerPopupRef' | 'emojiPickerOpen' | 'emojiPickerToggle'>
) => (
  <Kb.WithTooltip tooltip="Emoji">
    <Kb.Box style={styles.icon} ref={p.emojiPickerPopupRef}>
      <Kb.Icon
        color={p.emojiPickerOpen ? Styles.globalColors.black : null}
        onClick={p.emojiPickerToggle}
        type="iconfont-emoji"
      />
    </Kb.Box>
  </Kb.WithTooltip>
)

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

const fileListToPaths = (f: FileList | undefined | null): Array<string> =>
  Array.prototype.map.call((f || []) as any, (f: File) => {
    // We rely on path being here, even though it's
    // not part of the File spec.
    return f.path
  }) as any

const FileButton = (p: {
  conversationIDKey: Types.ConversationIDKey
  htmlInputRef: React.MutableRefObject<HTMLInputElement | null>
}) => {
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

const useEmojiPicker = (
  inputRef: React.MutableRefObject<Kb.PlainInput | null>,
  conversationIDKey: Types.ConversationIDKey
) => {
  const insertEmoji = React.useCallback(
    (emojiColons: string) => {
      inputRef.current?.transformText(({text, selection}) => {
        const newText = text.slice(0, selection.start || 0) + emojiColons + text.slice(selection.end || 0)
        const pos = (selection.start || 0) + emojiColons.length
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
  return {
    emojiPickerOpen: showingPopup,
    emojiPickerPopupRef: popupAnchor,
    emojiPickerToggle: toggleShowingPopup,
    emojiPopup: popup,
  }
}

const useKeyboard = (p: Props, htmlInputRef: React.RefObject<HTMLInputElement>, focusInput: () => void) => {
  const {
    isEditing,
    onCancelReply,
    onCancelEditing,
    onEditLastMessage,
    onKeyDown,
    onRequestScrollDown,
    onRequestScrollUp,
    showReplyPreview,
  } = p

  const lastText = React.useRef('')

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

  return {globalKeyDownPressHandler, inputKeyDown, lastText}
}

type SideButtonsProps = {
  getAttachmentRef: any
  conversationIDKey: any
  focusInput: any
  toggleShowingMenu: any
  showingExplodingMenu: any
  showWalletsIcon: any
  emojiPickerPopupRef: any
  emojiPickerOpen: any
  emojiPickerToggle: any
  htmlInputRef: any
  cannotWrite: any
}

const SideButtons = (p: SideButtonsProps) => {
  const {htmlInputRef, getAttachmentRef, conversationIDKey, focusInput, toggleShowingMenu} = p
  const {
    showingExplodingMenu,
    cannotWrite,
    showWalletsIcon,
    emojiPickerPopupRef,
    emojiPickerOpen,
    emojiPickerToggle,
  } = p
  return (
    <>
      {showingExplodingMenu && (
        <SetExplodingMessagePopup
          attachTo={getAttachmentRef}
          conversationIDKey={conversationIDKey}
          onAfterSelect={focusInput}
          onHidden={toggleShowingMenu}
          visible={showingExplodingMenu}
        />
      )}
      {!cannotWrite && showWalletsIcon && (
        <Kb.WithTooltip tooltip="Lumens">
          <WalletsIcon size={16} style={styles.walletsIcon} conversationIDKey={conversationIDKey} />
        </Kb.WithTooltip>
      )}
      {!cannotWrite && (
        <>
          <GiphyButton conversationIDKey={conversationIDKey} />
          <EmojiButton
            emojiPickerPopupRef={emojiPickerPopupRef}
            emojiPickerOpen={emojiPickerOpen}
            emojiPickerToggle={emojiPickerToggle}
          />
          <FileButton conversationIDKey={conversationIDKey} htmlInputRef={htmlInputRef} />
        </>
      )}
    </>
  )
}

type Props = PlatformInputPropsInternal

const PlatformInputInner = (p: Props) => {
  // TODO move continer props into here so they can go into sub components
  const {cannotWrite, conversationIDKey, explodingModeSeconds, getAttachmentRef, inputHintText} = p
  const {onChangeText, setAttachmentRef, showWalletsIcon, showingMenu, toggleShowingMenu} = p
  const {isExploding, minWriterRole, onCancelEditing, inputRef, inputSetRef, isEditing} = p
  const htmlInputRef = React.useRef<HTMLInputElement>(null)
  const {emojiPickerToggle, emojiPickerOpen, emojiPickerPopupRef, emojiPopup} = useEmojiPicker(
    inputRef,
    conversationIDKey
  )
  const focusInput = React.useCallback(() => {
    inputRef.current?.focus()
  }, [inputRef])
  const hintText = useMemo(() => {
    if (cannotWrite) {
      return `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
    } else if (isEditing) {
      return 'Edit your message'
    } else if (isExploding) {
      return 'Write an exploding message'
    }
    return inputHintText || 'Write a message'
  }, [cannotWrite, minWriterRole, inputHintText, isEditing, isExploding])
  const {globalKeyDownPressHandler, inputKeyDown, lastText} = useKeyboard(p, htmlInputRef, focusInput)
  const onChangeText2 = React.useCallback(
    (text: string) => {
      lastText.current = text
      onChangeText(text)
    },
    [onChangeText, lastText]
  )

  const showingExplodingMenu = showingMenu

  return (
    <>
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
                showingExplodingMenu={showingExplodingMenu}
                setAttachmentRef={setAttachmentRef}
                explodingModeSeconds={explodingModeSeconds}
                toggleShowingMenu={toggleShowingMenu}
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
                  inputSetRef(ref)
                  // from suggestors/index
                  inputRef.current = ref
                }}
                placeholder={hintText}
                style={Styles.collapseStyles([styles.input, isEditing && styles.inputEditing])}
                onChangeText={onChangeText2}
                multiline={true}
                rowsMin={1}
                rowsMax={10}
                onKeyDown={inputKeyDown}
              />
            </Kb.Box2>
            <SideButtons
              cannotWrite={cannotWrite}
              showingExplodingMenu={showingExplodingMenu}
              getAttachmentRef={getAttachmentRef}
              conversationIDKey={conversationIDKey}
              focusInput={focusInput}
              toggleShowingMenu={toggleShowingMenu}
              showWalletsIcon={showWalletsIcon}
              emojiPickerPopupRef={emojiPickerPopupRef}
              emojiPickerOpen={emojiPickerOpen}
              emojiPickerToggle={emojiPickerToggle}
              htmlInputRef={htmlInputRef}
            />
          </Kb.Box>
          <Footer conversationIDKey={conversationIDKey} focusInput={focusInput} />
        </Kb.Box>
      </KeyEventHandler>
      {emojiPopup}
    </>
  )
}

const PlatformInput = React.forwardRef((p: any, forwardedRef: any) => {
  const {popup, inputRef, onChangeText, onKeyDown, onBlur, onExpanded, onSelectionChange, onFocus} =
    useSuggestors(p)

  return (
    <>
      {popup}
      <PlatformInputInner
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
      inputWrapperEditing: {backgroundColor: Styles.globalColors.yellowLight},
      inputWrapperExplodingMode: {borderColor: Styles.globalColors.black},
      walletsIcon: {
        alignSelf: 'flex-end',
        marginBottom: 2,
        marginRight: Styles.globalMargins.xtiny,
      },
    } as const)
)

const HoverBox = Styles.styled(Kb.Box)(() => ({
  ':hover .timer, &.expanded .timer': {
    color: Styles.globalColors.black,
  },
}))

export default Kb.OverlayParentHOC(PlatformInput)

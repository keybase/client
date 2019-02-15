// @flow
/* eslint-env browser */
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../../common-adapters/emoji'
import SetExplodingMessagePopup from '../../messages/set-explode-popup/container'
import {formatDurationShort} from '../../../../util/timestamp'
import {KeyEventHandler} from '../../../../util/key-event-handler.desktop'
import WalletsIcon from './wallets-icon/container'
import type {PlatformInputPropsInternal} from './platform-input'
import Typing from './typing/container'
import AddSuggestors from '../suggestors'

type State = {
  emojiPickerOpen: boolean,
  hasText: boolean,
}

class _PlatformInput extends React.Component<PlatformInputPropsInternal, State> {
  _input: ?Kb.PlainInput
  _lastText: ?string
  _fileInput: ?HTMLInputElement

  constructor(props: PlatformInputPropsInternal) {
    super(props)
    this.state = {
      emojiPickerOpen: false,
      hasText: false,
    }
  }

  _inputSetRef = (ref: null | Kb.PlainInput) => {
    this._input = ref
    this.props.inputSetRef(ref)
    this.props.inputRef.current = ref
  }

  _inputFocus = () => {
    this._input && this._input.focus()
  }

  _emojiPickerToggle = () => {
    this.setState(({emojiPickerOpen}) => ({emojiPickerOpen: !emojiPickerOpen}))
  }

  _filePickerFiles = () => (this._fileInput && this._fileInput.files) || []

  _filePickerOpen = () => {
    this._fileInput && this._fileInput.click()
  }

  _filePickerSetRef = (r: ?HTMLInputElement) => {
    this._fileInput = r
  }

  _filePickerSetValue = (value: string) => {
    if (this._fileInput) this._fileInput.value = value
  }

  _getText = () => {
    return this._lastText || ''
  }

  // Key-handling code shared by both the input key handler
  // (_onKeyDown) and the global key handler
  // (_globalKeyDownPressHandler).
  _commonOnKeyDown = (e: SyntheticKeyboardEvent<> | KeyboardEvent) => {
    const text = this._getText()
    if (e.key === 'ArrowUp' && !this.props.isEditing && !text) {
      e.preventDefault()
      this.props.onEditLastMessage()
      return true
    } else if (e.key === 'Escape' && this.props.isEditing) {
      this.props.onCancelEditing()
      return true
    } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
      this._filePickerOpen()
      return true
    } else if (e.key === 'PageDown') {
      this.props.onRequestScrollDown()
      return true
    } else if (e.key === 'PageUp') {
      this.props.onRequestScrollUp()
      return true
    }

    return false
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>, isComposingIME: boolean) => {
    this._commonOnKeyDown(e)
    this.props.onKeyDown && this.props.onKeyDown(e, isComposingIME)
  }

  _onChangeText = (text: string) => {
    this.setState({hasText: !!text})
    this._lastText = text
    this.props.onChangeText(text)
  }

  _globalKeyDownPressHandler = (ev: KeyboardEvent) => {
    const target = ev.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    if (this._commonOnKeyDown(ev)) {
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
    ].includes(ev.key)
    if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
      this._inputFocus()
    }
  }

  _insertEmoji = (emojiColons: string) => {
    if (this._input) {
      this._input.transformText(({text, selection}) => {
        const newText = text.slice(0, selection.start) + emojiColons + text.slice(selection.end)
        const pos = selection.start + emojiColons.length
        return {
          selection: {
            end: pos,
            start: pos,
          },
          text: newText,
        }
      }, true)
      this._inputFocus()
    }
  }

  _pickerOnClick = emoji => {
    this._insertEmoji(emoji.colons)
    this._emojiPickerToggle()
  }

  _pickFile = () => {
    const fileList = this._filePickerFiles()
    const paths = fileList.length
      ? Array.prototype.map
          .call(fileList, (f: File) => {
            // We rely on path being here, even though it's
            // not part of the File spec.
            // $ForceType
            const path: string = f.path
            return path
          })
          .filter(Boolean)
      : []
    if (paths) {
      this.props.onAttach(paths)
    }
    this._filePickerSetValue('')
  }

  _toggleShowingMenu = () => {
    if (this.props.isEditing) return
    this.props.toggleShowingMenu()
  }

  render = () => {
    let hintText = 'Write a message'
    if (this.props.isExploding) {
      hintText = 'Write an exploding message'
    } else if (this.props.isEditing) {
      hintText = 'Edit your message'
    }

    return (
      <KeyEventHandler
        onKeyDown={this._globalKeyDownPressHandler}
        onKeyPress={this._globalKeyDownPressHandler}
      >
        <Kb.Box style={styles.container}>
          <Kb.Box
            style={Styles.collapseStyles([
              styles.inputWrapper,
              {
                backgroundColor: this.props.isEditing
                  ? Styles.globalColors.yellow3
                  : Styles.globalColors.white,
                borderColor: this.props.explodingModeSeconds
                  ? Styles.globalColors.black
                  : Styles.globalColors.black_20,
              },
            ])}
          >
            {!this.props.isEditing && (
              <HoverBox
                className={Styles.classNames({expanded: this.props.showingMenu})}
                onClick={this._toggleShowingMenu}
                ref={this.props.setAttachmentRef}
                style={Styles.collapseStyles([
                  styles.explodingIconContainer,
                  !!this.props.explodingModeSeconds && {
                    backgroundColor: Styles.globalColors.black,
                  },
                ])}
              >
                {this.props.explodingModeSeconds ? (
                  <Kb.Text type="BodyTinyBold" style={styles.time}>
                    {formatDurationShort(this.props.explodingModeSeconds * 1000)}
                  </Kb.Text>
                ) : (
                  <Kb.Icon
                    className="timer"
                    onClick={this._toggleShowingMenu}
                    style={Kb.iconCastPlatformStyles(styles.timerIcon)}
                    type="iconfont-timer"
                  />
                )}
              </HoverBox>
            )}
            {this.props.isEditing && (
              <Kb.Box onClick={this.props.onCancelEditing} style={styles.cancelEditing}>
                <Kb.Text style={styles.cancelEditingText} type="BodySmallSemibold">
                  Cancel
                </Kb.Text>
              </Kb.Box>
            )}
            <input
              type="file"
              style={styles.hidden}
              ref={this._filePickerSetRef}
              onChange={this._pickFile}
              multiple={true}
            />
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputBox}>
              <Kb.PlainInput
                className={'mousetrap' /* className needed so key handler doesn't ignore hotkeys */}
                autoFocus={false}
                ref={this._inputSetRef}
                placeholder={hintText}
                style={styles.input}
                onChangeText={this._onChangeText}
                multiline={true}
                rowsMin={1}
                rowsMax={10}
                onKeyDown={this._onKeyDown}
              />
            </Kb.Box2>
            {this.props.showingMenu && (
              <SetExplodingMessagePopup
                attachTo={this.props.getAttachmentRef}
                conversationIDKey={this.props.conversationIDKey}
                onAfterSelect={this._inputFocus}
                onHidden={this.props.toggleShowingMenu}
                visible={this.props.showingMenu}
              />
            )}
            {this.state.emojiPickerOpen && (
              <EmojiPicker emojiPickerToggle={this._emojiPickerToggle} onClick={this._pickerOnClick} />
            )}
            {this.props.showWalletsIcon && <WalletsIcon size={16} style={styles.walletsIcon} />}
            <Kb.Icon
              color={this.state.emojiPickerOpen ? Styles.globalColors.black : null}
              onClick={this._emojiPickerToggle}
              style={Kb.iconCastPlatformStyles(styles.icon)}
              type="iconfont-emoji"
            />
            <Kb.Icon
              onClick={this._filePickerOpen}
              style={Kb.iconCastPlatformStyles(styles.icon)}
              type="iconfont-attachment"
            />
          </Kb.Box>
          <Kb.Box style={styles.footerContainer}>
            <Typing conversationIDKey={this.props.conversationIDKey} />
            <Kb.Text
              lineClamp={1}
              type="BodyTiny"
              style={styles.footer}
              onClick={this._inputFocus}
              selectable={true}
            >
              *bold*, _italics_, `code`, >quote
            </Kb.Text>
          </Kb.Box>
        </Kb.Box>
      </KeyEventHandler>
    )
  }
}
const PlatformInput = AddSuggestors(_PlatformInput)

const EmojiPicker = ({emojiPickerToggle, onClick}) => (
  <Kb.Box>
    <Kb.Box style={styles.emojiPickerContainerWrapper} onClick={emojiPickerToggle} />
    <Kb.Box style={styles.emojiPickerRelative}>
      <Kb.Box style={styles.emojiPickerContainer}>
        <Picker
          autoFocus={true}
          onClick={onClick}
          emoji={'ghost'}
          title={'emojibase'}
          backgroundImageFn={backgroundImageFn}
        />
      </Kb.Box>
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  accessory: {
    bottom: 1,
    display: 'flex',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  accessoryContainer: {
    position: 'relative',
    width: '100%',
  },
  boomIcon: Styles.platformStyles({
    common: {
      left: 231,
      marginTop: -30,
      position: 'absolute',
    },
    isElectron: {
      cursor: 'text',
    },
  }),
  cancelEditing: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignSelf: 'stretch',
      backgroundColor: Styles.globalColors.black,
      borderRadius: 2,
      justifyContent: 'center',
      margin: 2,
      marginRight: 0,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
    },
  }),
  cancelEditingText: {
    color: Styles.globalColors.white,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
  emojiPickerContainer: Styles.platformStyles({
    common: {
      borderRadius: 4,
      bottom: 34,
      position: 'absolute',
      right: -22,
    },
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
    },
  }),
  emojiPickerContainerWrapper: {
    ...Styles.globalStyles.fillAbsolute,
  },
  emojiPickerRelative: {
    position: 'relative',
  },
  explodingIconContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignSelf: 'stretch',
      borderBottomLeftRadius: 3,
      borderTopLeftRadius: 3,
      justifyContent: 'flex-end',
      textAlign: 'center',
      width: 32,
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
      borderRight: `1px solid ${Styles.globalColors.black_20}`,
    },
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
  hidden: {
    display: 'none',
  },
  icon: {
    bottom: 6,
    marginRight: Styles.globalMargins.tiny,
    position: 'relative',
  },
  input: {
    backgroundColor: Styles.globalColors.transparent,
    height: 21,
    minHeight: 21,
  },
  inputBox: {
    flex: 1,
    paddingBottom: Styles.globalMargins.xxtiny,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: Styles.globalMargins.tiny,
    textAlign: 'left',
  },
  inputWrapper: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-end',
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  mentionCatcher: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.transparent,
  },
  mentionHud: Styles.platformStyles({
    common: {
      borderRadius: 4,
      height: 224,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
      width: '100%',
    },
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
    },
  }),
  time: {
    bottom: Styles.globalMargins.tiny,
    color: Styles.globalColors.white,
    position: 'relative',
  },
  timerIcon: {
    bottom: 6,
    position: 'relative',
  },
  walletsIcon: {
    alignSelf: 'flex-end',
    marginBottom: 6,
    marginRight: Styles.globalMargins.tiny,
  },
})

const HoverBox = Styles.styled(Kb.Box)({
  ':hover .timer, &.expanded .timer': {
    color: Styles.globalColors.black,
  },
})

export default Kb.OverlayParentHOC(PlatformInput)

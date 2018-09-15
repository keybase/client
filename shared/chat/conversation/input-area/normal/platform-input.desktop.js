// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import * as Kb from '../../../../common-adapters'
import {
  collapseStyles,
  desktopStyles,
  glamorous,
  globalColors,
  globalMargins,
  globalStyles,
  platformStyles,
  styleSheetCreate,
} from '../../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../../common-adapters/emoji'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'
import flags from '../../../../util/feature-flags'
import SetExplodingMessagePopup from '../../messages/set-explode-popup/container'
import type {PlatformInputProps} from './types'
import {formatDurationShort} from '../../../../util/timestamp'

const MentionCatcher = ({onClick}) => <Kb.Box onClick={onClick} style={styles.mentionCatcher} />

type State = {
  emojiPickerOpen: boolean,
  hasText: boolean,
}

class PlatformInput extends Component<PlatformInputProps & Kb.OverlayParentProps, State> {
  _input: ?Kb.Input
  _fileInput: ?HTMLInputElement

  constructor(props: PlatformInputProps & Kb.OverlayParentProps) {
    super(props)
    this.state = {
      emojiPickerOpen: false,
      hasText: false,
    }
  }

  _inputSetRef = (ref: ?Kb.Input) => {
    this._input = ref
    this.props.inputSetRef(ref)
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
    return this._input ? this._input.getValue() : ''
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>) => {
    const text = this._getText()
    if (e.key === 'ArrowUp' && !this.props.isEditing && !text) {
      e.preventDefault()
      this.props.onEditLastMessage()
    } else if (e.key === 'Escape' && this.props.isEditing) {
      this.props.onCancelEditing()
    } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
      this._filePickerOpen()
    }

    this.props.onKeyDown && this.props.onKeyDown(e)
  }

  _onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
    e.preventDefault()
    const text = this._getText()
    if (text) {
      this.props.onSubmit(text)
      this.setState({hasText: false})
    }
  }

  _onChangeText = (text: string) => {
    this.setState({hasText: !!text})
    this.props.onChangeText(text)
  }

  componentDidMount = () => {
    this._registerBodyEvents(true)
  }

  componentWillUnmount = () => {
    this._registerBodyEvents(false)
  }

  _registerBodyEvents = (add: boolean) => {
    const body = document.body
    if (!body) {
      return
    }
    if (add) {
      body.addEventListener('keydown', this._globalKeyDownHandler)
      body.addEventListener('keypress', this._globalKeyDownHandler)
    } else {
      body.removeEventListener('keydown', this._globalKeyDownHandler)
      body.removeEventListener('keypress', this._globalKeyDownHandler)
    }
  }

  _globalKeyDownHandler = (ev: KeyboardEvent) => {
    const target = ev.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const isPasteKey = ev.key === 'v' && (ev.ctrlKey || ev.metaKey)
    const isUploadKey = ev.key === 'u' && (ev.ctrlKey || ev.metaKey)
    const isValidSpecialKey = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Enter',
    ].includes(ev.key)
    if (isUploadKey) {
      this._filePickerOpen()
    } else if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
      this._inputFocus()
    }
  }

  _insertEmoji = (emojiColons: string) => {
    if (this._input) {
      this._input.transformText(({text, selection}) => {
        const newText = text.slice(0, selection.start) + emojiColons + text.slice(selection.end)
        const pos = selection.start + emojiColons.length
        return {
          text: newText,
          selection: {
            start: pos,
            end: pos,
          },
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

  _mentionCatcherClick = () => {
    this.props.setMentionPopupOpen(false)
  }

  _channelMentionCatcherClick = () => {
    this.props.setChannelMentionPopupOpen(false)
  }

  _toggleShowingMenu = () => {
    if (this.props.isEditing) return

    this.props.onSeenExplodingMessages()
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
      <Kb.Box style={styles.container}>
        {this.props.mentionPopupOpen && <MentionCatcher onClick={this._mentionCatcherClick} />}
        {this.props.mentionPopupOpen && (
          <MentionHud
            conversationIDKey={this.props.conversationIDKey}
            selectDownCounter={this.props.downArrowCounter}
            selectUpCounter={this.props.upArrowCounter}
            pickSelectedUserCounter={this.props.pickSelectedCounter}
            onPickUser={this.props.insertMention}
            onSelectUser={this.props.switchMention}
            filter={this.props.mentionFilter}
          />
        )}
        {this.props.channelMentionPopupOpen && <MentionCatcher onClick={this._channelMentionCatcherClick} />}
        {this.props.channelMentionPopupOpen && (
          <ChannelMentionHud
            conversationIDKey={this.props.conversationIDKey}
            selectDownCounter={this.props.downArrowCounter}
            selectUpCounter={this.props.upArrowCounter}
            pickSelectedChannelCounter={this.props.pickSelectedCounter}
            onPickChannel={this.props.insertChannelMention}
            onSelectChannel={this.props.switchChannelMention}
            filter={this.props.channelMentionFilter}
          />
        )}
        <Kb.Box
          style={collapseStyles([
            styles.inputWrapper,
            {
              backgroundColor: this.props.isEditing ? globalColors.yellow3 : globalColors.white,
              borderColor: this.props.explodingModeSeconds ? globalColors.black_75 : globalColors.black_20,
            },
          ])}
        >
          {!this.props.isEditing && (
            <HoverBox
              className={this.props.showingMenu ? 'expanded' : ''}
              onClick={this._toggleShowingMenu}
              ref={this.props.setAttachmentRef}
              style={collapseStyles([
                styles.explodingIconContainer,
                {
                  backgroundColor: this.props.explodingModeSeconds
                    ? globalColors.black_75
                    : globalColors.white,
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
          <Kb.Input
            className={'mousetrap' /* className needed so key handler doesn't ignore hotkeys */}
            autoFocus={false}
            small={true}
            style={collapseStyles([
              styles.input,
              {
                backgroundColor: this.props.isEditing ? globalColors.yellow3 : globalColors.white,
              },
            ])}
            ref={this._inputSetRef}
            hintText={hintText}
            hideUnderline={true}
            onChangeText={this._onChangeText}
            uncontrolled={true}
            multiline={true}
            rowsMin={1}
            rowsMax={10}
            onKeyDown={this._onKeyDown}
            onEnterKeyDown={this._onEnterKeyDown}
          />
          {flags.explodingMessagesEnabled &&
            this.props.isExploding &&
            !this.props.isEditing &&
            !this.state.hasText && (
              // This is the `boom!` icon in the placeholder: “Write an exploding message boom!”
              <Kb.Icon
                color={globalColors.black_20}
                fontSize={34}
                hoverColor={globalColors.black_20}
                onClick={this._inputFocus}
                style={Kb.iconCastPlatformStyles(styles.boomIcon)}
                type="iconfont-boom"
              />
            )}
          {flags.explodingMessagesEnabled &&
            this.props.showingMenu && (
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
          <Kb.Icon
            color={this.state.emojiPickerOpen ? globalColors.black_75 : null}
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
          <Kb.Text type="BodySmall" style={styles.isTyping}>
            {isTyping(this.props.typing)}
          </Kb.Text>
          <Kb.Text type="BodySmall" style={styles.footer} onClick={this._inputFocus} selectable={true}>
            *bold*, _italics_, `code`, >quote
          </Kb.Text>
        </Kb.Box>
      </Kb.Box>
    )
  }
}

const isTyping = typing => {
  switch (typing.size) {
    case 0:
      return ''
    case 1:
      return [
        <Kb.Text key={0} type="BodySmallSemibold">
          {typing.first()}
        </Kb.Text>,
        ` is typing`,
      ]
    case 2:
      return [
        <Kb.Text key={0} type="BodySmallSemibold">
          {typing.first()}
        </Kb.Text>,
        ` and `,
        <Kb.Text key={1} type="BodySmallSemibold">
          {typing.skip(1).first()}
        </Kb.Text>,
        ` are typing`,
      ]
    default:
      return [
        <Kb.Text key={0} type="BodySmallSemibold">
          {typing.join(', ')}
        </Kb.Text>,
        ` are typing`,
      ]
  }
}

const InputAccessory = Component => props => (
  <Kb.Box style={styles.accessoryContainer}>
    <Kb.Box style={styles.accessory}>
      <Component {...props} />
    </Kb.Box>
  </Kb.Box>
)

const MentionHud = InputAccessory(props => (
  <ConnectedMentionHud style={styles.mentionHud} {...props} conversationIDKey={props.conversationIDKey} />
))

const ChannelMentionHud = InputAccessory(props => (
  <ConnectedChannelMentionHud style={styles.mentionHud} {...props} />
))

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

const styles = styleSheetCreate({
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
  boomIcon: platformStyles({
    common: {
      left: 231,
      marginTop: -30,
      position: 'absolute',
    },
    isElectron: {
      cursor: 'text',
    },
  }),
  cancelEditing: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignSelf: 'stretch',
      backgroundColor: globalColors.black_75,
      borderRadius: 2,
      justifyContent: 'center',
      margin: 2,
      marginRight: 0,
      paddingLeft: globalMargins.tiny,
      paddingRight: globalMargins.tiny,
    },
    isElectron: {
      ...desktopStyles.clickable,
    },
  }),
  cancelEditingText: {
    color: globalColors.white,
  },
  container: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.white,
    width: '100%',
  },
  emojiPickerContainer: platformStyles({
    common: {
      borderRadius: 4,
      bottom: 34,
      position: 'absolute',
      right: -22,
    },
    isElectron: {
      boxShadow: `0 0 8px 0 ${globalColors.black_20}`,
    },
  }),
  emojiPickerContainerWrapper: {
    ...globalStyles.fillAbsolute,
  },
  emojiPickerRelative: {
    position: 'relative',
  },
  explodingIconContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignSelf: 'stretch',
      borderBottomLeftRadius: 3,
      borderTopLeftRadius: 3,
      justifyContent: 'flex-end',
      textAlign: 'center',
      width: 32,
    },
    isElectron: {
      ...desktopStyles.clickable,
      borderRight: `1px solid ${globalColors.black_20}`,
    },
  }),
  footer: {
    color: globalColors.black_20,
    marginBottom: globalMargins.xtiny,
    marginRight: globalMargins.medium + 2,
    textAlign: 'right',
  },
  footerContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
  },
  hidden: {
    display: 'none',
  },
  icon: {
    bottom: 6,
    marginRight: globalMargins.tiny,
    position: 'relative',
  },
  input: {
    flex: 1,
    paddingBottom: globalMargins.xxtiny,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: globalMargins.tiny,
    textAlign: 'left',
  },
  inputWrapper: {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-end',
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
  },
  isTyping: {
    flexGrow: 1,
    marginBottom: globalMargins.xtiny,
    marginLeft: 58,
    textAlign: 'left',
  },
  mentionCatcher: {
    ...globalStyles.fillAbsolute,
    backgroundColor: globalColors.transparent,
  },
  mentionHud: platformStyles({
    common: {
      borderRadius: 4,
      height: 224,
      marginLeft: globalMargins.small,
      marginRight: globalMargins.small,
      width: '100%',
    },
    isElectron: {
      boxShadow: `0 0 8px 0 ${globalColors.black_20}`,
    },
  }),
  time: {
    bottom: globalMargins.tiny,
    color: globalColors.white,
    position: 'relative',
  },
  timerIcon: {
    bottom: 6,
    position: 'relative',
  },
})

const HoverBox = glamorous(Kb.Box)({
  ':hover .timer, &.expanded .timer': {
    color: globalColors.black_75,
  },
})

export default Kb.OverlayParentHOC(PlatformInput)

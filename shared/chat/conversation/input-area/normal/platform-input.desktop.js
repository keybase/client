// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text, OverlayParentHOC, type OverlayParentProps} from '../../../../common-adapters'
import {
  collapseStyles,
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

const MentionCatcher = ({onClick}) => (
  <Box
    onClick={onClick}
    style={{
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.transparent,
    }}
  />
)

type State = {
  emojiPickerOpen: boolean,
  hasText: boolean,
}

class PlatformInput extends Component<PlatformInputProps & OverlayParentProps, State> {
  _input: ?Input
  _fileInput: ?HTMLInputElement

  constructor(props: PlatformInputProps & OverlayParentProps) {
    super(props)
    this.state = {
      emojiPickerOpen: false,
      hasText: false,
    }
  }

  _inputSetRef = (ref: ?Input) => {
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
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          width: '100%',
        }}
      >
        <Box style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.white, width: '100%'}}>
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
          {this.props.channelMentionPopupOpen && (
            <MentionCatcher onClick={this._channelMentionCatcherClick} />
          )}
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
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              alignItems: 'flex-end',
              backgroundColor: this.props.isEditing ? globalColors.yellow3 : globalColors.white,
              borderColor: this.props.explodingModeSeconds
                ? globalColors.black_75
                : this.props.isEditing
                  ? globalColors.orange
                  : globalColors.black_20,
              borderRadius: 4,
              borderStyle: 'solid',
              borderWidth: 1,
              marginLeft: globalMargins.small,
              marginRight: globalMargins.small,
            }}
          >
            <HoverBox
              className={this.props.isEditing ? 'editing' : ''}
              onClick={this._toggleShowingMenu}
              ref={this.props.setAttachmentRef}
              style={collapseStyles([
                styles.explodingIconContainer,
                {
                  backgroundColor: this.props.explodingModeSeconds
                    ? globalColors.black_75
                    : this.props.isEditing
                      ? globalColors.yellow3
                      : globalColors.white,
                },
                platformStyles({
                  isElectron: {
                    borderRight: `1px solid ${
                      this.props.isEditing ? globalColors.orange : globalColors.black_20
                    }`,
                    cursor: this.props.isEditing ? 'not-allowed' : 'pointer',
                  },
                }),
              ])}
            >
              {this.props.explodingModeSeconds ? (
                <Text
                  type="BodyTinyBold"
                  style={{bottom: globalMargins.tiny, color: globalColors.white, position: 'relative'}}
                >
                  {formatDurationShort(this.props.explodingModeSeconds * 1000)}
                </Text>
              ) : (
                <Icon
                  className="timer"
                  onClick={this.props.isEditing ? undefined : this._toggleShowingMenu}
                  style={platformStyles({
                    common: {
                      bottom: 6,
                      position: 'relative',
                    },
                    isElectron: {
                      cursor: 'inherit',
                    },
                  })}
                  type="iconfont-timer"
                />
              )}
            </HoverBox>
            <input
              type="file"
              style={{display: 'none'}}
              ref={this._filePickerSetRef}
              onChange={this._pickFile}
              multiple={true}
            />
            <Input
              className={'mousetrap' /* className needed so key handler doesn't ignore hotkeys */}
              autoFocus={false}
              small={true}
              style={collapseStyles([
                styleInput,
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
                <Icon
                  color={globalColors.black_20}
                  fontSize={34}
                  hoverColor={globalColors.black_20}
                  onClick={this._inputFocus}
                  style={styleBoomIcon}
                  type="iconfont-boom"
                />
              )}
            {flags.explodingMessagesEnabled &&
              this.props.showingMenu && (
                <SetExplodingMessagePopup
                  attachTo={this.props.attachmentRef}
                  conversationIDKey={this.props.conversationIDKey}
                  onAfterSelect={this._inputFocus}
                  onHidden={this.props.toggleShowingMenu}
                  visible={this.props.showingMenu}
                />
              )}
            {this.state.emojiPickerOpen && (
              <EmojiPicker emojiPickerToggle={this._emojiPickerToggle} onClick={this._pickerOnClick} />
            )}
            <Icon onClick={this._emojiPickerToggle} style={styleIcon} type="iconfont-emoji" />
            <Icon onClick={this._filePickerOpen} style={styleIcon} type="iconfont-attachment" />
          </Box>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
            <Text
              type="BodySmall"
              style={{
                flexGrow: 1,
                marginBottom: globalMargins.xtiny,
                marginLeft: 58,
                textAlign: 'left',
              }}
            >
              {isTyping(this.props.typing)}
            </Text>
            <Text type="BodySmall" style={styleFooter} onClick={this._inputFocus} selectable={true}>
              *bold*, _italics_, `code`, >quote
            </Text>
          </Box>
        </Box>
      </Box>
    )
  }
}

const isTyping = typing => {
  switch (typing.size) {
    case 0:
      return ''
    case 1:
      return [
        <Text key={0} type="BodySmallSemibold">
          {typing.first()}
        </Text>,
        ` is typing`,
      ]
    case 2:
      return [
        <Text key={0} type="BodySmallSemibold">
          {typing.first()}
        </Text>,
        ` and `,
        <Text key={1} type="BodySmallSemibold">
          {typing.skip(1).first()}
        </Text>,
        ` are typing`,
      ]
    default:
      return [
        <Text key={0} type="BodySmallSemibold">
          {typing.join(', ')}
        </Text>,
        ` are typing`,
      ]
  }
}

const InputAccessory = Component => props => (
  <Box style={{position: 'relative', width: '100%'}}>
    <Box
      style={{
        bottom: 1,
        display: 'flex',
        left: 0,
        position: 'absolute',
        right: 0,
      }}
    >
      <Component {...props} />
    </Box>
  </Box>
)

const MentionHud = InputAccessory(props => (
  <ConnectedMentionHud style={styleMentionHud} {...props} conversationIDKey={props.conversationIDKey} />
))

const ChannelMentionHud = InputAccessory(props => (
  <ConnectedChannelMentionHud style={styleMentionHud} {...props} />
))

const EmojiPicker = ({emojiPickerToggle, onClick}) => (
  <Box>
    <Box style={{bottom: 0, left: 0, position: 'absolute', right: 0, top: 0}} onClick={emojiPickerToggle} />
    <Box style={{position: 'relative'}}>
      <Box style={{bottom: 0, position: 'absolute', right: 0}}>
        <Picker
          autoFocus={true}
          onClick={onClick}
          emoji={'ghost'}
          title={'emojibase'}
          backgroundImageFn={backgroundImageFn}
        />
      </Box>
    </Box>
  </Box>
)

const styleMentionHud = {
  borderRadius: 4,
  boxShadow: '0 0 8px 0 rgba(0, 0, 0, 0.2)',
  height: 224,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.small,
  width: '100%',
}

const styleInput = {
  flex: 1,
  paddingBottom: globalMargins.xxtiny,
  paddingLeft: 6,
  paddingRight: 6,
  paddingTop: globalMargins.tiny,
  textAlign: 'left',
}
const styleIcon = {
  bottom: 6,
  marginRight: globalMargins.tiny,
  position: 'relative',
}

const styleBoomIcon = platformStyles({
  common: {
    left: 231,
    marginTop: -30,
    position: 'absolute',
  },
  isElectron: {
    cursor: 'text',
  },
})

const styleFooter = {
  color: globalColors.black_20,
  marginBottom: globalMargins.xtiny,
  marginRight: globalMargins.medium + 2,
  textAlign: 'right',
}

const styles = styleSheetCreate({
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
  }),
})

const HoverBox = glamorous(Box)({
  '&:not(.editing):hover .timer': {
    color: globalColors.black_75,
  },
})

export default OverlayParentHOC(PlatformInput)

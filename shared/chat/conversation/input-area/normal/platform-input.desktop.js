// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles, platformStyles} from '../../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../../common-adapters/emoji'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'

import type {PlatformInputProps} from './types'

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
}

class PlatformInput extends Component<PlatformInputProps, State> {
  _input: ?Input
  _fileInput: ?HTMLInputElement

  constructor(props: PlatformInputProps) {
    super(props)
    this.state = {
      emojiPickerOpen: false,
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
    if (this.props.pendingWaiting) {
      return
    }

    // TODO: Also call onCancelQuoting on mobile.
    this.props.onCancelQuoting()

    const text = this._getText()
    if (e.key === 'ArrowUp' && !this.props.isEditing && !text) {
      this.props.onEditLastMessage()
    } else if (e.key === 'Escape' && this.props.isEditing) {
      this.props.onCancelEditing()
    }
    this.props.onKeyDown && this.props.onKeyDown(e)
  }

  _onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
    e.preventDefault()
    const text = this._getText()
    if (text) {
      this.props.onSubmit(text)
    }
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
          text: newText,
          selection: {
            start: pos,
            end: pos,
          },
        }
      })
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

  _onFocus = () => {
    if (!this.props.pendingWaiting) {
      this.props.clearInboxFilter()
    }
  }

  render = () => {
    let hintText = 'Write a message'
    if (this.props.isEditing) {
      hintText = 'Edit your message'
    } else if (this.props.pendingWaiting) {
      hintText = 'Creating conversation...'
    }
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          borderTop: `solid 1px ${globalColors.black_05}`,
          width: '100%',
        }}
      >
        {this.props.isEditing && (
          <Box style={editingTabStyle}>
            <Text type="BodySmall">Editing:</Text>
            <Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing}>
              Cancel
            </Text>
          </Box>
        )}
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
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
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
              editable={!this.props.pendingWaiting}
              onFocus={this._onFocus}
              small={true}
              style={styleInput}
              ref={this._inputSetRef}
              hintText={hintText}
              hideUnderline={true}
              onChangeText={this.props.onChangeText}
              uncontrolled={true}
              multiline={true}
              rowsMin={1}
              rowsMax={5}
              onKeyDown={this._onKeyDown}
              onEnterKeyDown={this._onEnterKeyDown}
            />
            {this.state.emojiPickerOpen && (
              <EmojiPicker emojiPickerToggle={this._emojiPickerToggle} onClick={this._pickerOnClick} />
            )}
            <Icon
              onClick={this.props.pendingWaiting ? undefined : this._emojiPickerToggle}
              style={styleIcon}
              type="iconfont-emoji"
            />
            <Icon
              onClick={this.props.pendingWaiting ? undefined : this._filePickerOpen}
              style={styleIcon}
              type="iconfont-attachment"
            />
          </Box>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
            <Text
              type="BodySmall"
              style={{
                flexGrow: 1,
                marginBottom: globalMargins.xtiny,
                marginLeft: globalMargins.tiny,
                textAlign: 'left',
              }}
            >
              {isTyping(this.props.typing)}
            </Text>
            <Text type="BodySmall" style={{...styleFooter, textAlign: 'right'}} onClick={this._inputFocus}>
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
        <Picker onClick={onClick} emoji={'ghost'} title={'emojibase'} backgroundImageFn={backgroundImageFn} />
      </Box>
    </Box>
  </Box>
)

const editingTabStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  backgroundColor: globalColors.yellow_60,
  padding: 4,
}

const styleMentionHud = {
  borderRadius: 4,
  boxShadow: '0 0 8px 0 rgba(0, 0, 0, 0.2)',
  height: 220,
  marginLeft: 20,
  marginRight: 20,
  width: '100%',
}

const styleInput = {
  backgroundColor: globalColors.white,
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  marginTop: globalMargins.tiny,
  textAlign: 'left',
}
const styleIcon = {
  paddingRight: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
}

const styleFooter = platformStyles({
  isElectron: {
    color: globalColors.black_20,
    cursor: 'text',
    marginBottom: globalMargins.xtiny,
    marginLeft: globalMargins.tiny,
    marginRight: globalMargins.tiny,
    marginTop: 0,
    textAlign: 'right',
  },
})

export default PlatformInput

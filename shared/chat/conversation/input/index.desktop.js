// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {compose, withState, withHandlers} from 'recompose'
import ConnectedMentionHud from '../../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../../channel-mention-hud/mention-hud-container'

import type {Props} from '.'

type InputProps = {
  inputSelections: () => {selectionStart?: number, selectionEnd?: number},
  emojiPickerOpen: boolean,
  emojiPickerToggle: () => void,
  filePickerFiles: () => Array<any>,
  filePickerOpen: () => void,
  filePickerSetValue: (value: any) => void,
  filePickerSetRef: (r: any) => void,
  channelMentionFilter: string,
  channelMentionPopupOpen: boolean,
  setChannelMentionFilter: (filter: string) => void,
  setChannelMentionPopupOpen: (setOpen: boolean) => void,
  mentionFilter: string,
  mentionPopupOpen: boolean,
  setMentionFilter: (filter: string) => void,
  setMentionPopupOpen: (setOpen: boolean) => void,
} & Props

const MentionCatcher = ({onClick}) => (
  <Box
    onClick={onClick}
    style={{
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.transparent,
    }}
  />
)

class ConversationInput extends Component<InputProps, {}> {
  componentDidMount() {
    this._registerBodyEvents(true)
  }

  componentWillUnmount() {
    this._registerBodyEvents(false)
  }

  _registerBodyEvents(add: boolean) {
    const body = document.body
    if (!body) {
      return
    }
    const f = add ? body.addEventListener : body.removeEventListener
    f('keydown', this._globalKeyDownHandler)
    f('keypress', this._globalKeyDownHandler)
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
      this.props.inputFocus()
    }
  }

  _insertEmoji(emojiColons: string) {
    const {selectionStart = 0, selectionEnd = 0} = this.props.inputSelections()
    const nextText = [
      this.props.text.substring(0, selectionStart),
      emojiColons,
      this.props.text.substring(selectionEnd),
    ].join('')
    this.props.setText(nextText)
    this.props.inputFocus()
  }

  _pickerOnClick = emoji => {
    this._insertEmoji(emoji.colons)
    this.props.emojiPickerToggle()
  }

  _pickFile = () => {
    const conversationIDKey = this.props.selectedConversationIDKey
    if (!conversationIDKey) {
      throw new Error('No conversation')
    }
    const files = this.props.filePickerFiles()
    if (files.length <= 0) {
      return
    }

    const inputs = Array.prototype.map.call(files, file => {
      const {path, name, type} = file
      return {
        conversationIDKey,
        filename: path,
        title: name,
        type: type.indexOf('image') >= 0 ? 'Image' : 'Other',
      }
    })

    this.props.onAttach(inputs)
    this.props.filePickerSetValue(null)
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.text !== nextProps.text) {
      this.props.onUpdateTyping(!!nextProps.text)
    }
  }

  _inputSetRef(r) {
    this.props.inputSetRef(r)
  }

  render() {
    return (
      <Box style={{...globalStyles.flexBoxColumn, borderTop: `solid 1px ${globalColors.black_05}`}}>
        {this.props.mentionPopupOpen && (
          <MentionCatcher onClick={() => this.props.setMentionPopupOpen(false)} />
        )}
        {this.props.mentionPopupOpen && (
          <MentionHud
            selectDownCounter={this.props.downArrowCounter}
            selectUpCounter={this.props.upArrowCounter}
            pickSelectedUserCounter={this.props.pickSelectedCounter}
            onPickUser={this.props.insertMention}
            onSelectUser={this.props.switchMention}
            filter={this.props.mentionFilter}
          />
        )}
        {this.props.channelMentionPopupOpen && (
          <MentionCatcher onClick={() => this.props.setChannelMentionPopupOpen(false)} />
        )}
        {this.props.channelMentionPopupOpen && (
          <ChannelMentionHud
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
            ref={this.props.filePickerSetRef}
            onChange={this._pickFile}
            multiple={true}
          />
          <Input
            className={'mousetrap' /* className needed so key handler doesn't ignore hotkeys */}
            autoFocus={false}
            small={true}
            style={styleInput}
            ref={r => this._inputSetRef(r)}
            hintText="Write a message"
            hideUnderline={true}
            onChangeText={this.props.setText}
            value={this.props.text}
            multiline={true}
            rowsMin={1}
            rowsMax={5}
            onKeyDown={this.props.onKeyDown}
            onKeyUp={this.props.onKeyUp}
            onEnterKeyDown={this.props.onEnterKeyDown}
          />
          {this.props.emojiPickerOpen && (
            <EmojiPicker emojiPickerToggle={this.props.emojiPickerToggle} onClick={this._pickerOnClick} />
          )}
          <Icon onClick={this.props.emojiPickerToggle} style={styleIcon} type="iconfont-emoji" />
          <Icon onClick={this.props.filePickerOpen} style={styleIcon} type="iconfont-attachment" />
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
          <Text type="BodySmall" style={{...styleFooter, textAlign: 'right'}} onClick={this.props.inputFocus}>
            *bold*, _italics_, `code`, >quote
          </Text>
        </Box>
      </Box>
    )
  }
}

const isTyping = typing => {
  if (!typing || !typing.length) {
    return ''
  }
  switch (typing.length) {
    case 1:
      return [
        <Text key={0} type="BodySmallSemibold">
          {typing[0]}
        </Text>,
        ` is typing`,
      ]
    case 2:
      return [
        <Text key={0} type="BodySmallSemibold">
          {typing[0]}
        </Text>,
        ` and `,
        <Text key={1} type="BodySmallSemibold">
          {typing[1]}
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

const MentionHud = InputAccessory(props => <ConnectedMentionHud style={styleMentionHud} {...props} />)

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

const styleMentionHud = {
  borderRadius: 4,
  boxShadow: '0 0 8px 0 rgba(0, 0, 0, 0.2)',
  height: 220,
  marginLeft: 20,
  marginRight: 20,
  width: '100%',
}

const styleInput = {
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

const styleFooter = {
  color: globalColors.black_20,
  cursor: 'text',
  marginBottom: globalMargins.xtiny,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  marginTop: 0,
  textAlign: 'right',
}

export default compose(
  withState('emojiPickerOpen', 'setEmojiPickerOpen', false),
  withHandlers(props => {
    let fileInput
    return {
      emojiPickerToggle: ({emojiPickerOpen, setEmojiPickerOpen}) => () =>
        setEmojiPickerOpen(!emojiPickerOpen),
      filePickerFiles: props => () => (fileInput && fileInput.files) || [],
      filePickerOpen: props => () => {
        fileInput && fileInput.click()
      },
      filePickerSetRef: props => (r: any) => {
        fileInput = r
      },
      filePickerSetValue: props => (value: any) => {
        if (fileInput) fileInput.value = value
      },
    }
  })
)(ConversationInput)

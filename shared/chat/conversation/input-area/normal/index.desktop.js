// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles, platformStyles} from '../../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../../common-adapters/emoji'
import {compose, withHandlers, withStateHandlers} from 'recompose'
import ConnectedMentionHud from '../user-mention-hud/mention-hud-container'
import ConnectedChannelMentionHud from '../channel-mention-hud/mention-hud-container'

import type {Props} from '.'

type InputProps = {
  inputSelections: () => {selectionStart?: number, selectionEnd?: number},
  emojiPickerOpen: boolean,
  emojiPickerToggle: () => void,
  filePickerFiles: () => Array<any>,
  filePickerOpen: () => void,
  filePickerSetValue: (value: any) => void,
  filePickerSetRef: (r: any) => void,
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

class ConversationInput extends Component<InputProps> {
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
    const fileList = this.props.filePickerFiles()
    const paths = fileList.length ? Array.prototype.map.call(fileList, f => f.path).filter(Boolean) : []
    if (paths) {
      this.props.onAttach(paths)
    }
    this.props.filePickerSetValue(null)
  }

  _mentionCatcherClick = () => {
    this.props.setMentionPopupOpen(false)
  }

  _channelMentionCatcherClick = () => {
    this.props.setChannelMentionPopupOpen(false)
  }

  render() {
    return (
      <Box style={{...globalStyles.flexBoxColumn, borderTop: `solid 1px ${globalColors.black_05}`}}>
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
            ref={this.props.inputSetRef}
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
          {this.props.isEditing && (
            <Text type="BodySmallPrimaryLink" onClick={this.props.onCancelEditing} style={cancelStyle}>
              Cancel
            </Text>
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

const cancelStyle = {
  marginRight: globalMargins.tiny,
}

export default compose(
  withStateHandlers(
    {emojiPickerOpen: false},
    {emojiPickerToggle: ({emojiPickerOpen}) => () => ({emojiPickerOpen: !emojiPickerOpen})}
  ),
  withHandlers(props => {
    let fileInput
    return {
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

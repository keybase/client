// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {compose, withState, withHandlers} from 'recompose'

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

class ConversationInput extends Component<void, InputProps, void> {
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
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
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

  _pickerOnClick = emoji => {
    this._insertEmoji(emoji.colons)
    this.props.emojiPickerToggle()
  }

  _onKeyDown = (e: SyntheticKeyboardEvent) => {
    if (e.key === 'ArrowUp' && !this.props.text) {
      this.props.onEditLastMessage()
    }
  }

  _onEnterKeyDown = (e: SyntheticKeyboardEvent) => {
    e.preventDefault()

    if (this.props.isLoading) {
      console.log('Ignoring chat submit while still loading')
      return
    }
    if (this.props.text) {
      this.props.onPostMessage(this.props.text)
      this.props.setText('')
    }
  }

  render() {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          borderTop: `solid 1px ${globalColors.black_05}`,
        }}
      >
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'flex-start',
          }}
        >
          <input
            type="file"
            style={{display: 'none'}}
            ref={this.props.filePickerSetRef}
            onChange={this._pickFile}
            multiple={true}
          />
          <Input
            autoFocus={true}
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
            onKeyDown={this._onKeyDown}
            onEnterKeyDown={this._onEnterKeyDown}
          />
          {this.props.emojiPickerOpen &&
            <EmojiPicker
              emojiPickerToggle={this.props.emojiPickerToggle}
              onClick={this._pickerOnClick}
            />}
          <Icon
            onClick={this.props.emojiPickerToggle}
            style={styleIcon}
            type="iconfont-emoji"
          />
          <Icon
            onClick={this.props.filePickerOpen}
            style={styleIcon}
            type="iconfont-attachment"
          />
        </Box>
        <Text
          type="BodySmall"
          style={styleFooter}
          onClick={this.props.inputFocus}
        >
          *bold*, _italics_, `code`, >quote
        </Text>
      </Box>
    )
  }
}

const EmojiPicker = ({emojiPickerToggle, onClick}) => (
  <Box>
    <Box
      style={{bottom: 0, left: 0, position: 'absolute', right: 0, top: 0}}
      onClick={emojiPickerToggle}
    />
    <Box style={{position: 'relative'}}>
      <Box style={{bottom: 0, position: 'absolute', right: 0}}>
        <Picker
          onClick={onClick}
          emoji={'ghost'}
          title={'emojibase'}
          backgroundImageFn={backgroundImageFn}
        />
      </Box>
    </Box>
  </Box>
)

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
  flex: 1,
  marginBottom: globalMargins.xtiny,
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

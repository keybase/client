// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../common-adapters/emoji'
import {compose, withState, withHandlers} from 'recompose'

import type {Props} from '.'

class ConversationInput extends Component<void, Props, void> {
  _fileInput: any;

  componentDidMount () {
    document.body && document.body.addEventListener('keydown', this._globalKeyDownHandler)
    document.body && document.body.addEventListener('keypress', this._globalKeyDownHandler)
  }

  componentWillUnmount () {
    document.body && document.body.removeEventListener('keydown', this._globalKeyDownHandler)
    document.body && document.body.removeEventListener('keypress', this._globalKeyDownHandler)
    this.props.onStoreInputText(this.props.inputValue())
  }

  componentDidUpdate (prevProps: Props) {
    if (!this.props.isLoading && prevProps.isLoading ||
      this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this.props.inputFocus()
    }
  }

  _globalKeyDownHandler = (ev: KeyboardEvent) => {
    const target = ev.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const isPasteKey = ev.key === 'v' && (ev.ctrlKey || ev.metaKey)
    const isValidSpecialKey = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(ev.key)
    if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
      this.props.inputFocus()
    }
  }

  _insertEmoji (emojiColons: string) {
    const {selectionStart = 0, selectionEnd = 0} = this.props.inputSelections()
    const nextText = [this.props.text.substring(0, selectionStart), emojiColons, this.props.text.substring(selectionEnd)].join('')
    this.props.setText(nextText)
    this.props.inputFocus()
  }

  _openFilePicker = () => {
    if (this._fileInput) {
      this._fileInput.click()
    }
  }

  _pickFile = () => {
    const conversationIDKey = this.props.selectedConversationIDKey
    if (!conversationIDKey) {
      throw new Error('No conversation')
    }
    if (this._fileInput && this._fileInput.files && this._fileInput.files.length > 0) {
      const inputs = Array.prototype.map.call(this._fileInput.files, file => {
        const {path, name, type} = file
        return {
          conversationIDKey,
          filename: path,
          title: name,
          type: type.indexOf('image') >= 0 ? 'Image' : 'Other',
        }
      })

      this.props.onAttach(inputs)
      this._fileInput.value = null
    }
  }

  _pickerOnClick = (emoji) => {
    this._insertEmoji(emoji.colons)
    this.props.toggleEmojiPicker()
  }

  _onKeyDown = (e: SyntheticKeyboardEvent) => {
    if (e.key === 'ArrowUp' && !this.props.text) {
      this.props.onEditLastMessage()
    }
  }

  _onEnterKeyDown = (e: SyntheticKeyboardEvent) => {
    e.preventDefault()
    if (this.props.text) {
      this.props.onPostMessage(this.props.text)
      this.props.setText('')
    }
  }

  _setFileInputRef = r => {
    this._fileInput = r
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, borderTop: `solid 1px ${globalColors.black_05}`}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
          <input type='file' style={{display: 'none'}} ref={this._setFileInputRef} onChange={this._pickFile} multiple={true} />
          <Input
            autoFocus={true}
            small={true}
            style={styleInput}
            ref={this.props.inputSetRef}
            hintText='Write a message'
            hideUnderline={true}
            onChangeText={this.props.setText}
            value={this.props.text}
            multiline={true}
            rowsMin={1}
            rowsMax={5}
            onKeyDown={this._onKeyDown}
            onEnterKeyDown={this._onEnterKeyDown}
          />
          {this.props.emojiPickerOpen && (
            <Box>
              <Box style={{position: 'absolute', right: 0, bottom: 0, top: 0, left: 0}} onClick={this.props.toggleEmojiPicker} />
              <Box style={{position: 'relative'}}>
                <Box style={{position: 'absolute', right: 0, bottom: 0}}>
                  <Picker onClick={this._pickerOnClick} emoji={'ghost'} title={'emojibase'} backgroundImageFn={backgroundImageFn} />
                </Box>
              </Box>
            </Box>
          )}
          <Icon onClick={this.props.toggleEmojiPicker}
            style={styleIcon} type='iconfont-emoji' />
          <Icon onClick={this._openFilePicker} style={styleIcon} type='iconfont-attachment' />
        </Box>
        <Text type='BodySmall' style={styleFooter} onClick={this.props.inputFocus}>*bold*, _italics_, `code`, >quote</Text>
      </Box>
    )
  }
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
  flex: 1,
  marginBottom: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
  marginTop: 0,
  textAlign: 'right',
}

export default compose(
  withState('emojiPickerOpen', 'setEmojiPickerOpen', props => props.emojiPickerOpen),
  withHandlers({
    toggleEmojiPicker: ({emojiPickerOpen, setEmojiPickerOpen}) => () => setEmojiPickerOpen(!emojiPickerOpen),
  }),
)(ConversationInput)

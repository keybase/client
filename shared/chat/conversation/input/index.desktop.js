// @flow
/* eslint-env browser */
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../common-adapters/emoji'

import type {Props} from '.'

type State = {
  text: string,
}

class ConversationInput extends Component<void, Props, State> {
  _input: any;
  _fileInput: any;
  state: State;

  _setRef = r => {
    this._input = r
  }

  constructor (props: Props) {
    super(props)
    this.state = {text: this.props.defaultText}
  }

  componentDidMount () {
    document.body && document.body.addEventListener('keydown', this._globalKeyDownHandler)
    document.body && document.body.addEventListener('keypress', this._globalKeyDownHandler)
  }

  componentWillUnmount () {
    document.body && document.body.removeEventListener('keydown', this._globalKeyDownHandler)
    document.body && document.body.removeEventListener('keypress', this._globalKeyDownHandler)
    this.props.onStoreInputText(this.getValue())
  }

  componentDidUpdate (prevProps: Props) {
    if (!this.props.isLoading && prevProps.isLoading) {
      this.focusInput()
    }

    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this.focusInput()
    }
  }

  _globalKeyDownHandler = (ev: KeyboardEvent) => {
    if (!this._input) {
      return
    }

    const target = ev.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const isPasteKey = ev.key === 'v' && (ev.ctrlKey || ev.metaKey)
    const isValidSpecialKey = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(ev.key)
    if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
      this._input.focus()
    }
  }

  _insertEmoji (emojiColons: string) {
    const text: string = this.state.text || ''
    if (this._input) {
      const {selectionStart = 0, selectionEnd = 0} = this._input.selections() || {}
      const nextText = [text.substring(0, selectionStart), emojiColons, text.substring(selectionEnd)].join('')
      this.setState({text: nextText})
      this.focusInput()
    }
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

  focusInput = () => {
    this._input && this._input.focus()
  }

  getValue () {
    return this._input ? this._input.getValue() : ''
  }

  _pickerOnClick = (emoji) => {
    this._insertEmoji(emoji.colons)
    this.props.toggleEmojiPicker()
  }

  _onKeyDown = (e: SyntheticKeyboardEvent) => {
    if (e.key === 'ArrowUp' && !this.state.text) {
      this.props.onEditLastMessage()
    }
  }

  _onEnterKeyDown = (e: SyntheticKeyboardEvent) => {
    e.preventDefault()
    if (this.state.text) {
      this.props.onPostMessage(this.state.text)
      this.setState({text: ''})
    }
  }

  _onChangeText = text => {
    this.setState({text})
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
            ref={this._setRef}
            hintText='Write a message'
            hideUnderline={true}
            onChangeText={this._onChangeText}
            value={this.state.text}
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
        <Text type='BodySmall' style={styleFooter} onClick={this.focusInput}>*bold*, _italics_, `code`, >quote</Text>
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

export default ConversationInput

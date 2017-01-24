// @flow
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../common-adapters/emoji'

import type {Props} from './input'

type State = {
  emojiPickerOpen: boolean,
  text: string,
}

const _cachedInput: {[key: ?string]: ?string} = { }

class Conversation extends Component<void, Props, State> {
  _input: any;
  _fileInput: any;
  _globalKeyDownHandler: (ev: Event) => void;
  state: State;

  _setRef = r => {
    this._input = r
  }

  constructor (props: Props) {
    super(props)
    const {emojiPickerOpen} = props
    this.state = {emojiPickerOpen, text: _cachedInput[props.selectedConversation] || ''}
    this._globalKeyDownHandler = ev => this._handleGlobalKeyPress(ev)
  }

  componentDidMount () {
    document.body.addEventListener('keydown', this._globalKeyDownHandler)
  }

  componentWillUnmount () {
    document.body.removeEventListener('keydown', this._globalKeyDownHandler)
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.selectedConversation !== this.props.selectedConversation) {
      this.focusInput()
      _cachedInput[this.props.selectedConversation] = this.state.text
      this.setState({text: _cachedInput[nextProps.selectedConversation] || ''})
    }
  }

  componentDidUpdate (prevProps: Props) {
    if (!this.props.isLoading && prevProps.isLoading) {
      this.focusInput()
    }
  }

  _handleGlobalKeyPress (ev) {
    if (!this._input) {
      return
    }

    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') {
      return
    }

    this._input.focus()
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

  _onClickEmoji = () => {
    this.setState({emojiPickerOpen: !this.state.emojiPickerOpen})
  }

  _openFilePicker = () => {
    if (this._fileInput) {
      this._fileInput.click()
    }
  }

  _pickFile () {
    if (this._fileInput && this._fileInput.files && this._fileInput.files[0]) {
      const {path, name, type} = this._fileInput.files[0]
      this.props.onAttach(path, name, type.indexOf('image') >= 0 ? 'Image' : 'Other')
      this._fileInput.value = null
    }
  }

  focusInput = () => {
    this._input && this._input.focus()
  }

  _pickerOnClick = (emoji) => {
    this._insertEmoji(emoji.colons)
    this._onClickEmoji()
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, borderTop: `solid 1px ${globalColors.black_05}`}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-start'}}>
          <input type='file' style={{display: 'none'}} ref={r => { this._fileInput = r }} onChange={() => this._pickFile()} />
          <Input
            autoFocus={true}
            small={true}
            style={styleInput}
            ref={this._setRef}
            hintText='Write a message'
            hideUnderline={true}
            onChangeText={text => this.setState({text})}
            value={this.state.text}
            multiline={true}
            rowsMin={1}
            rowsMax={5}
            onEnterKeyDown={(e) => {
              e.preventDefault()
              if (this.state.text) {
                this.props.onPostMessage(this.state.text)
                this.setState({text: ''})
              }
            }}
          />
          {this.state.emojiPickerOpen && (
            <Box>
              <Box style={{position: 'absolute', right: 0, bottom: 0, top: 0, left: 0}} onClick={() => this.setState({emojiPickerOpen: false})} />
              <Box style={{position: 'relative'}}>
                <Box style={{position: 'absolute', right: 0, bottom: 0}}>
                  <Picker onClick={this._pickerOnClick} emoji={'ghost'} title={'emojibase'} backgroundImageFn={backgroundImageFn} />
                </Box>
              </Box>
            </Box>
          )}
          <Icon onClick={this._onClickEmoji} style={styleIcon} type='iconfont-emoji' />
          <Icon onClick={this._openFilePicker} style={styleIcon} type='iconfont-attachment' />
        </Box>
        <Text type='BodySmall' style={styleFooter} onClick={this.focusInput}>*bold*, _italics_, `code`</Text>
      </Box>
    )
  }
}

const styleInput = {
  flex: 1,
  marginTop: globalMargins.tiny,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  textAlign: 'left',
}

const styleIcon = {
  paddingTop: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}

const styleFooter = {
  flex: 1,
  color: globalColors.black_20,
  cursor: 'text',
  textAlign: 'right',
  marginTop: 0,
  marginBottom: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
}

export default Conversation

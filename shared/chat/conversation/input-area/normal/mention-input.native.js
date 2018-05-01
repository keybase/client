// @flow
import * as React from 'react'
import PlatformInput from './platform-input'
import {type MentionInputProps} from './types'
import {Input} from '../../../../common-adapters'

type MentionState = {
  pickSelectedCounter: number,
  mentionFilter: string,
  channelMentionFilter: string,
  mentionPopupOpen: boolean,
  channelMentionPopupOpen: boolean,
  _selection: {selectionStart: number, selectionEnd: number},
}

class MentionInput extends React.Component<MentionInputProps, MentionState> {
  state: MentionState
  _inputRef: ?Input
  constructor() {
    super()
    this.state = {
      pickSelectedCounter: 0,
      mentionFilter: '',
      channelMentionFilter: '',
      mentionPopupOpen: false,
      channelMentionPopupOpen: false,
      _selection: {selectionStart: 0, selectionEnd: 0},
    }
  }

  _inputSetRef = (input: ?Input) => {
    this.props.inputSetRef(input)
    this._inputRef = input
  }

  setMentionPopupOpen = (mentionPopupOpen: boolean) => this.setState({mentionPopupOpen})
  setChannelMentionPopupOpen = (channelMentionPopupOpen: boolean) => this.setState({channelMentionPopupOpen})
  _setMentionFilter = (mentionFilter: string) => this.setState({mentionFilter})
  _setChannelMentionFilter = (channelMentionFilter: string) => this.setState({channelMentionFilter})

  _isPopupOpen = () => this.state.mentionPopupOpen || this.state.channelMentionPopupOpen

  _getWordAtCursor = (text: string, start: number) => {
    const upToCursor = text.substring(0, start)
    const words = upToCursor.split(/ |\n/)
    return words[words.length - 1]
  }

  _onChangeText = (nextText: string) => {
    this.props.onChangeText(nextText)
    const selection = this.state._selection
    const {selectionStart} = selection
    const word = this._getWordAtCursor(nextText, selectionStart)
    if (!this._isPopupOpen() && selection.selectionStart === selection.selectionEnd) {
      if (word[0] === '@') {
        this.setMentionPopupOpen(true)
        this._setMentionFilter(word.substring(1))
      } else if (word[0] === '#') {
        this.setChannelMentionPopupOpen(true)
        this._setChannelMentionFilter(word.substring(1))
      }
    } else if (selection.selectionStart !== selection.selectionEnd) {
      this.state.mentionPopupOpen && this.setMentionPopupOpen(false) && this._setMentionFilter('')
      this.state.channelMentionPopupOpen &&
        this.setChannelMentionPopupOpen(false) &&
        this._setChannelMentionFilter('')
    } else {
      // Close popups if word doesn't begin with marker anymore
      if (this.state.mentionPopupOpen && word[0] !== '@') {
        this._setMentionFilter('')
        this.setMentionPopupOpen(false)
        return
      } else if (this.state.channelMentionPopupOpen && word[0] !== '#') {
        this._setChannelMentionFilter('')
        this.setChannelMentionPopupOpen(false)
        return
      }

      // we haven't exited a mention, set filters
      if (this.state.mentionPopupOpen) {
        this._setMentionFilter(word.substring(1))
      } else if (this.state.channelMentionPopupOpen) {
        this._setChannelMentionFilter(word.substring(1))
      }
    }
  }

  _getText = () => {
    return this._inputRef ? this._inputRef.getValue() : ''
  }

  onBlur = () => {
    this.state.channelMentionPopupOpen && this.setChannelMentionPopupOpen(false)
    this.state.mentionPopupOpen && this.setMentionPopupOpen(false)
  }

  onFocus = () => {
    this._onChangeText(this._getText())
  }

  insertMentionMarker = () => {
    this._replaceWordAtCursor('@')
    this._inputRef && this._inputRef.focus()
  }

  insertMention = (u: string) => {
    this._replaceWordAtCursor(`@${u} `)
  }

  insertChannelMention = (c: string) => {
    this._replaceWordAtCursor(`#${c} `)
  }

  _replaceWordAtCursor = (newWord: string) => {
    if (this._inputRef) {
      this._inputRef.transformText(({text, selection}) => {
        if (selection.start !== selection.end) {
          return {text, selection}
        }
        const pos = selection.start

        const word = this._getWordAtCursor(text, pos)
        const startOfWordIdx = pos - word.length
        if (startOfWordIdx < 0) {
          return {text, selection}
        }

        const newText = text.slice(0, startOfWordIdx) + newWord + text.slice(pos)
        const newPos = startOfWordIdx + newWord.length
        return {
          text: newText,
          selection: {
            start: newPos,
            end: newPos,
          },
        }
      })
    }
  }

  onSelectionChange = (selection: {selectionStart: number, selectionEnd: number}) =>
    this.setState(
      {
        _selection: selection,
      },
      () => this._onChangeText(this._getText())
    )

  render = () => (
    <PlatformInput
      {...this.props}
      {...this.state}
      insertChannelMention={this.insertChannelMention}
      insertMention={this.insertMention}
      setMentionPopupOpen={this.setMentionPopupOpen}
      setChannelMentionPopupOpen={this.setChannelMentionPopupOpen}
      inputSetRef={this._inputSetRef}
      insertMentionMarker={this.insertMentionMarker}
      onBlur={this.onBlur}
      onFocus={this.onFocus}
      onChangeText={this._onChangeText}
      onSelectionChange={this.onSelectionChange}
    />
  )
}

export default MentionInput

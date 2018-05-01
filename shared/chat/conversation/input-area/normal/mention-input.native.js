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

  // Desktop only.
  upArrowCounter: number,
  downArrowCounter: number,
}

class MentionInput extends React.Component<MentionInputProps, MentionState> {
  state: MentionState = {
    upArrowCounter: 0,
    downArrowCounter: 0,
    pickSelectedCounter: 0,
    mentionFilter: '',
    channelMentionFilter: '',
    mentionPopupOpen: false,
    channelMentionPopupOpen: false,
  }
  _inputRef: ?Input

  _inputSetRef = (input: ?Input) => {
    this.props.inputSetRef(input)
    this._inputRef = input
  }

  _setMentionPopupOpen = (mentionPopupOpen: boolean) => {
    this.setState({mentionPopupOpen})
  }

  _setChannelMentionPopupOpen = (channelMentionPopupOpen: boolean) => {
    this.setState({channelMentionPopupOpen})
  }

  _setMentionFilter = (mentionFilter: string) => {
    this.setState({mentionFilter})
  }

  _setChannelMentionFilter = (channelMentionFilter: string) => {
    this.setState({channelMentionFilter})
  }

  _isPopupOpen = () => this.state.mentionPopupOpen || this.state.channelMentionPopupOpen

  _getWordAtCursor = (text: string, start: number) => {
    const upToCursor = text.substring(0, start)
    const words = upToCursor.split(/ |\n/)
    return words[words.length - 1]
  }

  _onChangeText = (nextText: string) => {
    this.props.onChangeText(nextText)
    const selection = this._inputRef ? this._inputRef.selection() : {start: 0, end: 0}
    const {start: selectionStart} = selection
    const word = this._getWordAtCursor(nextText, selectionStart)
    if (!this._isPopupOpen() && selection.start === selection.end) {
      if (word[0] === '@') {
        this._setMentionPopupOpen(true)
        this._setMentionFilter(word.substring(1))
      } else if (word[0] === '#') {
        this._setChannelMentionPopupOpen(true)
        this._setChannelMentionFilter(word.substring(1))
      }
    } else if (selection.start !== selection.end) {
      this.state.mentionPopupOpen && this._setMentionPopupOpen(false) && this._setMentionFilter('')
      this.state.channelMentionPopupOpen &&
        this._setChannelMentionPopupOpen(false) &&
        this._setChannelMentionFilter('')
    } else {
      // Close popups if word doesn't begin with marker anymore
      if (this.state.mentionPopupOpen && word[0] !== '@') {
        this._setMentionFilter('')
        this._setMentionPopupOpen(false)
        return
      } else if (this.state.channelMentionPopupOpen && word[0] !== '#') {
        this._setChannelMentionFilter('')
        this._setChannelMentionPopupOpen(false)
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
    this.state.channelMentionPopupOpen && this._setChannelMentionPopupOpen(false)
    this.state.mentionPopupOpen && this._setMentionPopupOpen(false)
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

  render = () => (
    <PlatformInput
      {...this.props}
      {...this.state}
      insertChannelMention={this.insertChannelMention}
      insertMention={this.insertMention}
      setMentionPopupOpen={this._setMentionPopupOpen}
      setChannelMentionPopupOpen={this._setChannelMentionPopupOpen}
      inputSetRef={this._inputSetRef}
      insertMentionMarker={this.insertMentionMarker}
      onBlur={this.onBlur}
      onFocus={this.onFocus}
      onChangeText={this._onChangeText}
    />
  )
}

export default MentionInput

// @flow
import * as React from 'react'
import PlatformInput from './platform-input'
import {type MentionInputProps} from './types'
import {Input} from '../../../../common-adapters'

type MentionState = {
  upArrowCounter: number,
  downArrowCounter: number,
  pickSelectedCounter: number,
  mentionFilter: string,
  channelMentionFilter: string,
  mentionPopupOpen: boolean,
  channelMentionPopupOpen: boolean,
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

  _inputSetRef = (input: ?Input) => {
    this.props.inputSetRef(input)
    this._inputRef = input
  }

  insertMention = (u: string, options?: {notUser: boolean}) => {
    this._replaceWordAtCursor(`@${u} `)
    this._setMentionPopupOpen(false)

    // This happens if you type @notausername<enter>. We've essentially 'picked' nothing and really want to submit
    // This is a little wonky cause this component doesn't directly know if the list is filtered all the way out
    if (options && options.notUser) {
      this._onSubmit()
    }
  }

  switchMention = (u: string) => {
    this._replaceWordAtCursor(`@${u}`)
  }

  insertChannelMention = (c: string, options?: {notChannel: boolean}) => {
    this._replaceWordAtCursor(`#${c} `)
    this._setChannelMentionPopupOpen(false)

    // This happens if you type #notachannel<enter>. We've essentially 'picked' nothing and really want to submit
    // This is a little wonky cause this component doesn't directly know if the list is filtered all the way out
    if (options && options.notChannel) {
      this._onSubmit()
    }
  }

  switchChannelMention = (c: string) => {
    this._replaceWordAtCursor(`#${c}`)
  }

  _triggerUpArrowCounter = () => {
    this.setState(({upArrowCounter}) => ({upArrowCounter: upArrowCounter + 1}))
  }

  _triggerDownArrowCounter = () => {
    this.setState(({downArrowCounter}) => ({downArrowCounter: downArrowCounter + 1}))
  }

  _triggerPickSelectedCounter = () => {
    this.setState(({pickSelectedCounter}) => ({pickSelectedCounter: pickSelectedCounter + 1}))
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>) => {
    if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
      if (e.key === 'Tab') {
        e.preventDefault()
        // If you tab with a partial name typed, we pick the selected item
        if (this.state.mentionFilter.length > 0 || this.state.channelMentionFilter.length > 0) {
          this._triggerPickSelectedCounter()
          return
        }
        // else we move you up/down
        if (e.shiftKey) {
          this._triggerUpArrowCounter()
        } else {
          this._triggerDownArrowCounter()
        }
        return
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        this._triggerUpArrowCounter()
        return
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        this._triggerDownArrowCounter()
        return
      } else if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this._setMentionPopupOpen(false)
        this._setChannelMentionPopupOpen(false)
        return
      }
    }

    if (e.key === '@') {
      this._setMentionPopupOpen(true)
    } else if (e.key === '#') {
      this._setChannelMentionPopupOpen(true)
    }

    const text = this._inputRef ? this._inputRef.getValue() : ''
    if (this.state.mentionPopupOpen && e.key === 'Backspace') {
      const lastChar = text[text.length - 1]
      if (lastChar === '@') {
        this._setMentionPopupOpen(false)
      }
    }
    if (this.state.channelMentionPopupOpen && e.key === 'Backspace') {
      const lastChar = text[text.length - 1]
      if (lastChar === '#') {
        this._setChannelMentionPopupOpen(false)
      }
    }
  }

  onKeyUp = (e: SyntheticKeyboardEvent<*>) => {
    // Ignore moving within the list
    if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
      if (['ArrowUp', 'ArrowDown', 'Shift', 'Tab'].includes(e.key)) {
        // handled above in _onKeyDown
        return
      }
    }

    // Get the word typed so far
    if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen || e.key === 'Backspace') {
      const text = this._inputRef ? this._inputRef.getValue() : ''
      const selection = this._inputRef ? this._inputRef.selections() : null
      const start = selection ? selection.selectionStart : 0
      const wordSoFar = this._getWordAtCursor(text, start)
      if (wordSoFar && wordSoFar[0] === '@') {
        !this.state.mentionPopupOpen && this._setMentionPopupOpen(true)
        this._setMentionFilter(wordSoFar.substring(1))
      } else if (wordSoFar && wordSoFar[0] === '#') {
        !this.state.channelMentionPopupOpen && this._setChannelMentionPopupOpen(true)
        this._setChannelMentionFilter(wordSoFar.substring(1))
      } else {
        this.state.mentionPopupOpen && this._setMentionPopupOpen(false)
        this.state.channelMentionPopupOpen && this._setChannelMentionPopupOpen(false)
      }
    }
  }

  _getWordAtCursor = (text: string, start: number) => {
    const upToCursor = text.substring(0, start)
    const words = upToCursor.split(/ |\n/)
    return words[words.length - 1]
  }

  _replaceWordAtCursor(newWord: string): void {
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

  onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
    e.preventDefault()

    if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
      this._triggerPickSelectedCounter()
      return
    }
    this._onSubmit()
  }

  _onSubmit = () => {
    const text = this._inputRef ? this._inputRef.getValue() : ''
    if (text) {
      this.props.onSubmit(text)
    }
  }

  render() {
    return (
      <PlatformInput
        {...this.props}
        {...this.state}
        inputSetRef={this._inputSetRef}
        insertMention={this.insertMention}
        switchMention={this.switchMention}
        insertChannelMention={this.insertChannelMention}
        switchChannelMention={this.switchChannelMention}
        onKeyDown={this._onKeyDown}
        onKeyUp={this.onKeyUp}
        onEnterKeyDown={this.onEnterKeyDown}
        setMentionPopupOpen={this._setMentionPopupOpen}
        setChannelMentionPopupOpen={this._setChannelMentionPopupOpen}
      />
    )
  }
}

export default MentionInput

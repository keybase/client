// @flow
import * as React from 'react'
import {type Props} from '.'
import logger from '../../../logger'

type MentionHocProps = {
  channelMentionFilter: string,
  channelMentionPopupOpen: boolean,
  setChannelMentionFilter: (filter: string) => void,
  setChannelMentionPopupOpen: (setOpen: boolean) => void,
  mentionFilter: string,
  mentionPopupOpen: boolean,
  setMentionFilter: (filter: string) => void,
  setMentionPopupOpen: (setOpen: boolean) => void,
  _inputSetRef: any => void,
} & Props

type MentionHocState = {
  upArrowCounter: number,
  downArrowCounter: number,
  pickSelectedCounter: number,
}

const mentionHoc = (InputComponent: React.ComponentType<Props>) => {
  class MentionHoc extends React.Component<MentionHocProps, MentionHocState> {
    state: MentionHocState
    _inputRef: ?any

    constructor() {
      super()
      this.state = {
        upArrowCounter: 0,
        downArrowCounter: 0,
        pickSelectedCounter: 0,
      }
    }

    inputSetRef = (input: any) => {
      this.props._inputSetRef(input)
      this._inputRef = input
    }

    insertMention = (u: string, options?: {notUser: boolean}) => {
      this._replaceWordAtCursor(`@${u} `)
      this.props.setMentionPopupOpen(false)

      // This happens if you type @notausername<enter>. We've essentially 'picked' nothing and really want to submit
      // This is a little wonky cause this component doesn't directly know if the list is filtered all the way out
      if (options && options.notUser) {
        if (this.props.text) {
          this.props.onPostMessage(this.props.text)
          this.props.setText('')
        }
      }
    }

    switchMention = (u: string) => {
      this._replaceWordAtCursor(`@${u}`)
    }

    insertChannelMention = (c: string, options?: {notChannel: boolean}) => {
      this._replaceWordAtCursor(`#${c} `)
      this.props.setChannelMentionPopupOpen(false)

      // This happens if you type #notachannel<enter>. We've essentially 'picked' nothing and really want to submit
      // This is a little wonky cause this component doesn't directly know if the list is filtered all the way out
      if (options && options.notChannel) {
        if (this.props.text) {
          this.props.onPostMessage(this.props.text)
          this.props.setText('')
        }
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

    onKeyDown = (e: SyntheticKeyboardEvent<>) => {
      if (e.key === 'ArrowUp' && !this.props.text) {
        this.props.onEditLastMessage()
        return
      }

      if (this.props.mentionPopupOpen || this.props.channelMentionPopupOpen) {
        if (e.key === 'Tab') {
          e.preventDefault()
          // If you tab with a partial name typed, we pick the selected item
          if (this.props.mentionFilter.length > 0 || this.props.channelMentionFilter.length > 0) {
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
          this.props.setMentionPopupOpen(false)
          this.props.setChannelMentionPopupOpen(false)
          return
        }
      }

      if (e.key === '@') {
        this.props.setMentionPopupOpen(true)
      } else if (e.key === '#') {
        this.props.setChannelMentionPopupOpen(true)
      }

      if (this.props.mentionPopupOpen && e.key === 'Backspace') {
        const lastChar = this.props.text[this.props.text.length - 1]
        if (lastChar === '@') {
          this.props.setMentionPopupOpen(false)
        }
      }
      if (this.props.channelMentionPopupOpen && e.key === 'Backspace') {
        const lastChar = this.props.text[this.props.text.length - 1]
        if (lastChar === '#') {
          this.props.setChannelMentionPopupOpen(false)
        }
      }
    }

    onKeyUp = (e: SyntheticKeyboardEvent<*>) => {
      // Ignore moving within the list
      if (this.props.mentionPopupOpen || this.props.channelMentionPopupOpen) {
        if (['ArrowUp', 'ArrowDown', 'Shift', 'Tab'].includes(e.key)) {
          // handled above in _onKeyDown
          return
        }
      }

      // Get the word typed so far
      if (this.props.mentionPopupOpen || this.props.channelMentionPopupOpen || e.key === 'Backspace') {
        const wordSoFar = this._getWordAtCursor(false)
        if (wordSoFar && wordSoFar[0] === '@') {
          !this.props.mentionPopupOpen && this.props.setMentionPopupOpen(true)
          this.props.setMentionFilter(wordSoFar.substring(1))
        } else if (wordSoFar && wordSoFar[0] === '#') {
          !this.props.channelMentionPopupOpen && this.props.setChannelMentionPopupOpen(true)
          this.props.setChannelMentionFilter(wordSoFar.substring(1))
        } else {
          this.props.mentionPopupOpen && this.props.setMentionPopupOpen(false)
          this.props.channelMentionPopupOpen && this.props.setChannelMentionPopupOpen(false)
        }
      }
    }

    _getWordAtCursor(includeWordAfterCursor: boolean): string {
      const text = this._inputRef && this._inputRef.getValue()
      const selections = this._inputRef && this._inputRef.selections()
      if (text && selections && selections.selectionStart === selections.selectionEnd) {
        const upToCursor = text.substring(0, selections.selectionStart)
        const words = upToCursor.split(' ')
        const lastWord = words[words.length - 1]
        if (includeWordAfterCursor) {
          const afterCursor = text.substring(selections.selectionStart)
          const endOfWordMatchIdx = afterCursor.search(/\s/)
          return (
            lastWord + (endOfWordMatchIdx !== -1 ? afterCursor.substring(0, endOfWordMatchIdx) : afterCursor)
          )
        } else {
          return lastWord
        }
      }

      return ''
    }

    _replaceWordAtCursor(newWord: string): void {
      const selections = this._inputRef && this._inputRef.selections()
      const word = this._getWordAtCursor(false)

      if (word && selections && selections.selectionStart === selections.selectionEnd) {
        const startOfWordIdx = selections.selectionStart - word.length
        if (startOfWordIdx >= 0) {
          this._inputRef && this._inputRef.replaceText(newWord, startOfWordIdx, selections.selectionStart)
        }
      }
    }

    onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
      e.preventDefault()

      if (this.props.mentionPopupOpen || this.props.channelMentionPopupOpen) {
        this._triggerPickSelectedCounter()
        return
      }
      if (this.props.isLoading) {
        logger.info('Ignoring chat submit while still loading')
        return
      }
      if (this.props.text) {
        this.props.onPostMessage(this.props.text)
        this.props.setText('')
      }
    }

    render() {
      return (
        <InputComponent
          {...this.props}
          {...this.state}
          inputSetRef={this.inputSetRef}
          insertMention={this.insertMention}
          switchMention={this.switchMention}
          insertChannelMention={this.insertChannelMention}
          switchChannelMention={this.switchChannelMention}
          onKeyDown={this.onKeyDown}
          onKeyUp={this.onKeyUp}
          onEnterKeyDown={this.onEnterKeyDown}
        />
      )
    }
  }

  return MentionHoc
}

export default mentionHoc

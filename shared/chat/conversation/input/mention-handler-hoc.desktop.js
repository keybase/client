// @flow
import * as React from 'react'
import {type Props} from '.'
import {type PropsFromContainer} from './mention-handler-hoc'
import logger from '../../../logger'

type MentionHocState = {
  upArrowCounter: number,
  downArrowCounter: number,
  pickSelectedCounter: number,
  mentionFilter: string,
  channelMentionFilter: string,
  mentionPopupOpen: boolean,
  channelMentionPopupOpen: boolean,
}

const mentionHoc = (InputComponent: React.ComponentType<Props>) => {
  class MentionHoc extends React.Component<PropsFromContainer, MentionHocState> {
    state: MentionHocState
    _inputRef: ?any

    constructor() {
      super()
      this.state = {
        upArrowCounter: 0,
        downArrowCounter: 0,
        pickSelectedCounter: 0,
        mentionFilter: '',
        channelMentionFilter: '',
        mentionPopupOpen: false,
        channelMentionPopupOpen: false,
      }
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

    inputSetRef = (input: any) => {
      this.props._inputSetRef(input)
      this._inputRef = input
    }

    insertMention = (u: string, options?: {notUser: boolean}) => {
      this._replaceWordAtCursor(`@${u} `)
      this._setMentionPopupOpen(false)

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
      this._setChannelMentionPopupOpen(false)

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
      this.props._onKeyDown(e)
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

      if (this.state.mentionPopupOpen && e.key === 'Backspace') {
        const lastChar = this.props.text[this.props.text.length - 1]
        if (lastChar === '@') {
          this._setMentionPopupOpen(false)
        }
      }
      if (this.state.channelMentionPopupOpen && e.key === 'Backspace') {
        const lastChar = this.props.text[this.props.text.length - 1]
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
        const wordSoFar = this._getWordAtCursor(false)
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

      if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
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
          setMentionPopupOpen={this._setMentionPopupOpen}
          setChannelMentionPopupOpen={this._setChannelMentionPopupOpen}
        />
      )
    }
  }

  return MentionHoc
}

export default mentionHoc

// @flow
/* eslint-disable sort-keys */
import * as React from 'react'
import PlatformInput from './platform-input'
import {type MentionInputProps} from './types'
import {Input} from '../../../../common-adapters'
import {isMobile} from '../../../../constants/platform'

type MentionState = {|
  channelMentionFilter: string,
  channelMentionHudIsShowing: boolean,
  channelMentionPopupOpen: boolean,
  mentionFilter: string,
  mentionHudIsShowing: boolean,
  mentionPopupOpen: boolean,
  pickSelectedCounter: number,

  // Desktop only.
  downArrowCounter: number,
  upArrowCounter: number,
|}

type SelectionKey = 'Enter' | 'Tab' | ''

class MentionInput extends React.Component<MentionInputProps, MentionState> {
  state: MentionState = {
    channelMentionFilter: '',
    channelMentionHudIsShowing: false,
    channelMentionPopupOpen: false,
    mentionFilter: '',
    mentionHudIsShowing: false,
    mentionPopupOpen: false,
    pickSelectedCounter: 0,
    downArrowCounter: 0,
    upArrowCounter: 0,
  }

  _lastSelectionKey: SelectionKey = ''

  _inputRef: ?Input

  _inputSetRef = (input: ?Input) => {
    this.props.inputSetRef(input)
    this._inputRef = input
  }

  _setLastSelectionKey = (lastSelectionKey: SelectionKey) => {
    this._lastSelectionKey = lastSelectionKey
  }

  _setMentionHudIsShowing = (mentionHudIsShowing: boolean) => {
    this.setState({mentionHudIsShowing})
  }

  _setMentionPopupOpen = (mentionPopupOpen: boolean) => {
    this.setState({mentionPopupOpen})
  }

  _setChannelMentionHudIsShowing = (channelMentionHudIsShowing: boolean) => {
    this.setState({channelMentionHudIsShowing})
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

  _getWordAtCursor = (text: string, start: number) => {
    const upToCursor = text.substring(0, start)
    const words = upToCursor.split(/ |\n/)
    return words[words.length - 1]
  }

  _replaceWordAtCursor = (newWord: string) => {
    if (this._inputRef) {
      this._inputRef.transformText(textInfo => {
        const {text, selection} = textInfo
        if (selection.start !== selection.end) {
          return textInfo
        }
        const pos = selection.start

        const word = this._getWordAtCursor(text, pos)
        const startOfWordIdx = pos - word.length
        if (startOfWordIdx < 0) {
          return textInfo
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

  _onChangeText = (nextText: string) => {
    this.props.onChangeText(nextText)
    const selection = this._inputRef ? this._inputRef.selection() : {start: 0, end: 0}
    const word = this._getWordAtCursor(nextText, selection.start)
    const isPopupOpen = this.state.mentionPopupOpen || this.state.channelMentionPopupOpen
    if (!isPopupOpen && selection.start === selection.end) {
      if (word[0] === '@') {
        this._setMentionPopupOpen(true)
        this._setMentionFilter(word.substring(1))
      } else if (word[0] === '#') {
        this._setChannelMentionPopupOpen(true)
        this._setChannelMentionFilter(word.substring(1))
      }
    } else if (selection.start !== selection.end) {
      if (this.state.mentionPopupOpen) {
        this._setMentionPopupOpen(false)
        this._setLastSelectionKey('')
        this._setMentionFilter('')
      }

      if (this.state.channelMentionPopupOpen) {
        this._setChannelMentionPopupOpen(false)
        this._setLastSelectionKey('')
        this._setChannelMentionFilter('')
      }
    } else {
      // Close popups if word doesn't begin with marker anymore
      if (this.state.mentionPopupOpen && word[0] !== '@') {
        this._setMentionFilter('')
        this._setLastSelectionKey('')
        this._setMentionPopupOpen(false)
        return
      } else if (this.state.channelMentionPopupOpen && word[0] !== '#') {
        this._setChannelMentionFilter('')
        this._setLastSelectionKey('')
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

  // Start mobile only.

  onBlur = () => {
    if (this.state.channelMentionPopupOpen) {
      this._setChannelMentionPopupOpen(false)
      this._setLastSelectionKey('')
    }

    if (this.state.mentionPopupOpen) {
      this._setMentionPopupOpen(false)
      this._setLastSelectionKey('')
    }
  }

  onFocus = () => {
    this._onChangeText(this._getText())
  }

  insertMentionMarker = () => {
    this._replaceWordAtCursor('@')
    this._inputRef && this._inputRef.focus()
  }

  // End mobile only.

  insertMention = (u: string, options?: {notUser: boolean}) => {
    this._replaceWordAtCursor(`@${u} `)
    this._setMentionPopupOpen(false)

    this._maybeSubmitAfterInsert(options ? options.notUser : false)
  }

  insertChannelMention = (c: string, options?: {notChannel: boolean}) => {
    this._replaceWordAtCursor(`#${c} `)
    this._setChannelMentionPopupOpen(false)

    this._maybeSubmitAfterInsert(options ? options.notChannel : false)
  }

  // Start desktop only.

  switchMention = (u: string) => {
    this._replaceWordAtCursor(`@${u}`)
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

  _triggerPickSelectedCounter = (key: SelectionKey) => {
    this._setLastSelectionKey(key)
    this.setState(({pickSelectedCounter}) => ({pickSelectedCounter: pickSelectedCounter + 1}))
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>) => {
    if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
      if (e.key === 'Tab') {
        e.preventDefault()
        // If you tab with a partial name typed, we pick the selected item
        if (this.state.mentionFilter.length > 0 || this.state.channelMentionFilter.length > 0) {
          this._triggerPickSelectedCounter('Tab')
          return
        }
        // else we move you up/down
        if (e.shiftKey) {
          this._triggerUpArrowCounter()
        } else {
          this._triggerDownArrowCounter()
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        this._triggerUpArrowCounter()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        this._triggerDownArrowCounter()
      } else if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        this._setLastSelectionKey('')
        this._setMentionPopupOpen(false)
        this._setChannelMentionPopupOpen(false)
      }
    }
  }

  // End desktop only.

  // If you type @notausername<enter> or #notachannel<enter>, we've essentially
  // 'picked' nothing and really want to submit. This is a little wonky cause
  // this component doesn't directly know if the list is filtered all the way
  // out. If you type e.g., @notausername<tab> we don't want to do anything.
  _maybeSubmitAfterInsert = (notUserOrChannel: boolean) => {
    const text = this._getText()
    if (text && notUserOrChannel && this._lastSelectionKey === 'Enter') {
      this.props.onSubmit(text)
    }
    this._setLastSelectionKey('')
  }

  _onSubmit = (text: string) => {
    if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
      this._setLastSelectionKey('')
      if (isMobile) {
        this._setMentionPopupOpen(false)
        this._setChannelMentionPopupOpen(false)
      } else {
        // On desktop, this is triggered on Enter, so if a mention
        // popup is open we actually just want to pick whatever's
        // selected.
        this._triggerPickSelectedCounter('Enter')
        if (this.state.mentionHudIsShowing || this.state.channelMentionHudIsShowing) {
          return
        }
      }
    }

    this._setLastSelectionKey('')
    this.props.onSubmit(text)
  }

  componentDidUpdate = (prevProps: MentionInputProps) => {
    if (this.props.conversationIDKey !== prevProps.conversationIDKey) {
      this._setMentionPopupOpen(false)
      this._setChannelMentionPopupOpen(false)
    }
  }

  render = () => (
    <PlatformInput
      {...this.props}
      {...this.state}
      inputSetRef={this._inputSetRef}
      insertMention={this.insertMention}
      insertChannelMention={this.insertChannelMention}
      onChangeText={this._onChangeText}
      onSubmit={this._onSubmit}
      setMentionHudIsShowing={this._setMentionHudIsShowing}
      setMentionPopupOpen={this._setMentionPopupOpen}
      setChannelMentionHudIsShowing={this._setChannelMentionHudIsShowing}
      setChannelMentionPopupOpen={this._setChannelMentionPopupOpen}
      // Desktop only.
      switchMention={this.switchMention}
      switchChannelMention={this.switchChannelMention}
      onKeyDown={this._onKeyDown}
      // Mobile only.
      insertMentionMarker={this.insertMentionMarker}
      onBlur={this.onBlur}
      onFocus={this.onFocus}
    />
  )
}

export default MentionInput

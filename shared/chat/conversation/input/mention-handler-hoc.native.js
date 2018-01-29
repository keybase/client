// @flow
import * as React from 'react'
import {type Props} from '.'
import {type PropsFromContainer} from './mention-handler-hoc'

type MentionHocState = {
  pickSelectedCounter: number,
  mentionFilter: string,
  channelMentionFilter: string,
  mentionPopupOpen: boolean,
  channelMentionPopupOpen: boolean,
  _selection: {selectionStart: number, selectionEnd: number},
}

const mentionHoc = (InputComponent: React.ComponentType<Props>) => {
  class MentionHoc extends React.Component<PropsFromContainer, MentionHocState> {
    state: MentionHocState
    _inputRef: ?any
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

    inputSetRef = (input: any) => {
      this.props._inputSetRef(input)
      this._inputRef = input
    }

    setMentionPopupOpen = (mentionPopupOpen: boolean) => this.setState({mentionPopupOpen})
    setChannelMentionPopupOpen = (channelMentionPopupOpen: boolean) =>
      this.setState({channelMentionPopupOpen})
    _setMentionFilter = (mentionFilter: string) => this.setState({mentionFilter})
    _setChannelMentionFilter = (channelMentionFilter: string) => this.setState({channelMentionFilter})

    _triggerPickSelectedCounter = () =>
      this.setState(({pickSelectedCounter}) => ({pickSelectedCounter: pickSelectedCounter + 1}))

    onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
      e.preventDefault()
      if (this.state.mentionPopupOpen || this.state.channelMentionPopupOpen) {
        this._triggerPickSelectedCounter()
      }
    }

    _isPopupOpen = () => this.state.mentionPopupOpen || this.state.channelMentionPopupOpen

    _getWordAtCursor = (text: string) => {
      const {selectionStart} = this.state._selection
      const upToCursor = text.substring(0, selectionStart)
      const words = upToCursor.split(' ')
      return words[words.length - 1]
    }

    onChangeText = (nextText: string) => {
      this.props.setText(nextText)
      const word = this._getWordAtCursor(nextText)
      const selection = this.state._selection
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

    onBlur = () => {
      this.state.channelMentionPopupOpen && this.setChannelMentionPopupOpen(false)
      this.state.mentionPopupOpen && this.setMentionPopupOpen(false)
    }

    onFocus = () => {
      this.onChangeText(this.props.text)
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

    _replaceWordAtCursor = (w: string) => {
      const word = this._getWordAtCursor(this.props.text)
      const ss = this.state._selection.selectionStart

      // can't use inputRef.replaceText because android custom input
      // doesn't support it ootb
      const existingText = this.props.text
      const nextText = existingText.slice(0, ss - word.length) + w + existingText.slice(ss)
      this.props.setText(nextText)
    }

    onSelectionChange = (event: any) =>
      this.setState(
        {
          _selection: {
            selectionStart: event.nativeEvent.selection.start,
            selectionEnd: event.nativeEvent.selection.end,
          },
        },
        () => this.onChangeText(this.props.text)
      )

    render = () => (
      <InputComponent
        {...this.props}
        {...this.state}
        insertChannelMention={this.insertChannelMention}
        insertMention={this.insertMention}
        setMentionPopupOpen={this.setMentionPopupOpen}
        setChannelMentionPopupOpen={this.setChannelMentionPopupOpen}
        inputSetRef={this.inputSetRef}
        insertMentionMarker={this.insertMentionMarker}
        onBlur={this.onBlur}
        onFocus={this.onFocus}
        onEnterKeyDown={this.onEnterKeyDown}
        onChangeText={this.onChangeText}
        onSelectionChange={this.onSelectionChange}
      />
    )
  }

  return MentionHoc
}

export default mentionHoc

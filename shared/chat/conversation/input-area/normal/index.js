// @flow
import * as React from 'react'
import {Input as TextInput} from '../../../../common-adapters'
import MentionInput from './mention-input'
import {type InputProps} from './types'
import {throttle} from 'lodash-es'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 2000)

class Input extends React.Component<InputProps> {
  _lastQuote: number
  _input: ?TextInput

  constructor(props: InputProps) {
    super(props)
    this._lastQuote = 0
  }

  _inputSetRef = (input: ?TextInput) => {
    this._input = input
  }

  _inputFocus = () => {
    this._input && this._input.focus()
  }

  _onSubmit = (text: string) => {
    this.props.onSubmit(text)
    this._setText('')
  }

  _onChangeText = (text: string) => {
    this.props.setUnsentText(text)
    throttled(this.props.sendTyping, !!text)
  }

  _setText = (text: string, skipUnsentSaving?: boolean) => {
    if (this._input) {
      this._input.transformText(() => ({
        selection: {end: text.length, start: text.length},
        text,
      }))
    }

    if (!skipUnsentSaving) {
      this.props.setUnsentText(text)
    }
    throttled(this.props.sendTyping, !!text)
  }

  componentDidMount = () => {
    // Set lastQuote so we only inject quoted text after we mount.
    this._lastQuote = this.props.quoteCounter

    const text = this.props.getUnsentText()
    this._setText(text, true)
  }

  componentDidUpdate = (prevProps: InputProps) => {
    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this._inputFocus()
    }

    if (this.props.isEditing && this.props.isEditExploded) {
      this.props.onCancelEditing()
    }

    // Inject the appropriate text when entering or existing edit
    // mode, but only when on the same conversation; otherwise we'd
    // incorrectly inject when switching to/from a conversation with
    // an unsent edit.
    if (prevProps.conversationIDKey === this.props.conversationIDKey) {
      if (!prevProps.isEditing && this.props.isEditing) {
        this._setText(this.props.editText)
        this._inputFocus()
        return
      }

      if (prevProps.isEditing && !this.props.isEditing) {
        this._setText('')
        return
      }
    }

    // Inject the appropriate text when quoting. Keep track of the
    // last quote we did so as to inject exactly once.
    if (this.props.quoteCounter > this._lastQuote) {
      this._lastQuote = this.props.quoteCounter
      this._setText(this.props.quoteText)
      this._inputFocus()
      return
    }

    // Otherwise, inject unsent text. This must come after quote
    // handling, so as to handle the 'Reply Privately' case.
    if (prevProps.conversationIDKey !== this.props.conversationIDKey) {
      const text = this.props.getUnsentText()
      this._setText(text, true)
    }
  }

  render = () => {
    return (
      <MentionInput
        {...this.props}
        onSubmit={this._onSubmit}
        inputSetRef={this._inputSetRef}
        onChangeText={this._onChangeText}
      />
    )
  }
}

export type {InputProps as Props}

export default Input

// @flow
import * as React from 'react'
import {Input as TextInput} from '../../../../common-adapters'
import MentionInput from './mention-input'
import {type InputProps} from './types'
import {throttle} from 'lodash-es'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 1000)

class Input extends React.Component<InputProps> {
  _lastQuote: ?number

  _input: ?TextInput

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
        text,
        selection: {start: text.length, end: text.length},
      }))
    }

    if (!skipUnsentSaving) {
      this.props.setUnsentText(text)
    }
    throttled(this.props.sendTyping, !!text)
  }

  componentDidMount = () => {
    const text = this.props.getUnsentText()
    this._setText(text, true)
  }

  componentDidUpdate = (prevProps: InputProps) => {
    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this._inputFocus()
    }

    if (!prevProps.isEditing && this.props.isEditing) {
      this._setText(this.props._editText)
      this._inputFocus()
      return
    }

    if (prevProps.isEditing && !this.props.isEditing) {
      this._setText('')
      return
    }

    if (this.props._quoteCounter && this.props._quoteCounter !== this._lastQuote) {
      this._lastQuote = this.props._quoteCounter
      this._setText(this.props._quoteText)
      this._inputFocus()
      return
    }

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

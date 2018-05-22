// @flow
import * as React from 'react'
import {Input as TextInput} from '../../../../common-adapters'
import MentionInput from './mention-input'
import {type InputProps} from './types'
import {throttle} from 'lodash-es'
import {formatTextForQuoting} from '../../../../util/chat'

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 1000)

class Input extends React.Component<InputProps> {
  _input: ?TextInput

  _inputSetRef = (input: ?TextInput) => {
    this._input = input
  }

  _inputFocus = () => {
    this._input && this._input.focus()
  }

  _inputMoveToEnd = () => {
    if (this._input) {
      this._input.transformText(({text, selection}) => ({
        text,
        selection: {start: text.length, end: text.length},
      }))
    }
  }

  _onCancelQuoting = () => {
    this.props._quotingMessage && this.props.onCancelQuoting()
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

  componentWillReceiveProps = (nextProps: InputProps) => {
    const props: InputProps = this.props

    if (nextProps._editingCounter !== this.props._editingCounter) {
      // blow away any unset stuff if we go into an edit/quote, else you edit / cancel / switch tabs and come back and you see the unsent value
      this._setText('')
      const injectedInput = nextProps.injectedInput
      this._setText(injectedInput, true)
      this._inputFocus()
      return
    }

    if (nextProps._quotingCounter !== this.props._quotingCounter) {
      this._setText('')
      const injectedInput = nextProps.injectedInput
      this._setText(formatTextForQuoting(injectedInput), true)
      this._inputFocus()
      return
    }

    if (props.conversationIDKey !== nextProps.conversationIDKey) {
      const text = nextProps.getUnsentText()
      this._setText(text, true)
    }
  }

  componentDidUpdate = (prevProps: InputProps) => {
    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this._inputFocus()
    }
  }

  render = () => {
    return (
      <MentionInput
        {...this.props}
        onCancelQuoting={this._onCancelQuoting}
        onSubmit={this._onSubmit}
        inputSetRef={this._inputSetRef}
        onChangeText={this._onChangeText}
      />
    )
  }
}

export type {InputProps as Props}

export default Input

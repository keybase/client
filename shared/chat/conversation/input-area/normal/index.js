// @flow
import * as React from 'react'
import {Input as TextInput} from '../../../../common-adapters'
import {isMobile} from '../../../../util/container'
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
    this._input && this._input.moveCursorToEnd()
  }

  _onCancelQuoting = () => {
    this.props._quotingMessage && this.props.onCancelQuoting()
  }

  _onSubmit = (text: string) => {
    this.props.onSubmit(text)
    this._setText('')
  }

  _setText = (text: string, skipUnsentSaving?: boolean) => {
    this._input &&
      this._input.transformText(() => ({
        text,
        selection: {start: text.length, end: text.length},
      }))
    if (!skipUnsentSaving) {
      this.props.setUnsentText(text)
    }

    throttled(this.props.sendTyping, !!text)
  }

  componentWillReceiveProps = (nextProps: InputProps) => {
    const props: InputProps = this.props

    // Fill in the input with an edit, quote, or unsent text
    if (
      (nextProps._quotingMessage && nextProps._quotingMessage !== props._quotingMessage) ||
      nextProps._editingMessage !== props._editingMessage
    ) {
      this._setText('') // blow away any unset stuff if we go into an edit/quote, else you edit / cancel / switch tabs and come back and you see the unsent value
      const injectedInput = nextProps.injectedInput
      this._setText(
        nextProps._quotingMessage && !nextProps._editingMessage
          ? formatTextForQuoting(injectedInput)
          : injectedInput,
        true
      )
      !isMobile && this._inputMoveToEnd()
      this._inputFocus()
    } else if (props.conversationIDKey !== nextProps.conversationIDKey && !nextProps.injectedInput) {
      const text = nextProps.getUnsentText()
      this._setText(text, true)
    }

    if (nextProps.isEditing && !props.isEditing) {
      this._inputFocus()
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
      />
    )
  }
}

export type {InputProps as Props}

export default Input

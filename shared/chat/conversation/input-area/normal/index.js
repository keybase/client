// @flow
import * as React from 'react'
import {Input as TextInput} from '../../../../common-adapters'
import {isMobile} from '../../../../util/container'
import MentionInput from './mention-input'
import {type InputProps} from './types'
import {throttle} from 'lodash-es'
import {formatTextForQuoting} from '../../../../util/chat'

type State = {
  text: string,
}

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 1000)

class Input extends React.Component<InputProps, State> {
  _input: ?TextInput

  constructor(props: InputProps) {
    super(props)
    this.state = {
      text: props.getUnsentText(),
    }
  }

  _setText = (text: string, skipUnsentSaving?: boolean) => {
    this.setState({text})
    if (!skipUnsentSaving) {
      this.props.setUnsentText(text)
    }

    throttled(this.props.sendTyping, !!text)
  }

  _onSubmit = (text: string) => {
    this.props.onSubmit(text)
    this._setText('')
  }

  _inputSetRef = (input: ?TextInput) => {
    this._input = input
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>) => {
    this.props._quotingMessage && this.props.onCancelQuoting()
    if (e.key === 'ArrowUp' && !this.state.text) {
      this.props.onEditLastMessage()
    } else if (e.key === 'Escape') {
      this.props.onCancelEditing()
    }
  }

  _inputBlur = () => {
    this._input && this._input.blur()
  }

  _inputFocus = () => {
    this._input && this._input.focus()
  }

  _inputMoveToEnd = () => this._input && this._input.moveCursorToEnd()

  _inputGetRef = () => this._input

  _inputSelections = () => (this._input ? this._input.selections() : null)

  componentDidUpdate(prevProps: InputProps) {
    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this._inputFocus()
    }
  }

  componentWillReceiveProps(nextProps: InputProps) {
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

  render = () => {
    return (
      <MentionInput
        {...this.props}
        inputBlur={this._inputBlur}
        inputFocus={this._inputFocus}
        inputSetRef={this._inputSetRef}
        inputSelections={this._inputSelections}
        onKeyDown={this._onKeyDown}
        onSubmit={this._onSubmit}
        text={this.state.text}
        setText={this._setText}
      />
    )
  }
}

export type {InputProps as Props}

export default Input

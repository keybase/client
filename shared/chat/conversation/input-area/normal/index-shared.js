// @flow
import * as React from 'react'
import * as I from 'immutable'
import {Input as TextInput} from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import mentionHoc, {type PropsFromContainer} from '../mention-handler-hoc'
import {default as _Input} from '.'
import {throttle} from 'lodash-es'

// For some reason, flow can't infer the type of mentionHoc here.
const MentionHocInput: React.ComponentType<PropsFromContainer> = mentionHoc(_Input)

type Props = {
  // Subset of PreMentionHocProps.
  conversationIDKey: Types.ConversationIDKey,
  channelName: ?string,
  isEditing: boolean,
  focusInputCounter: number,
  clearInboxFilter: () => void,
  inputBlur: () => void,
  inputClear: () => void,
  inputFocus: () => void,
  inputSetRef: (r: ?TextInput) => void,
  inputValue: () => string,
  onAttach: (paths: Array<string>) => void,
  onEditLastMessage: () => void,
  onCancelEditing: () => void,
  onCancelQuoting: () => void,
  onJoinChannel: () => void,
  onLeaveChannel: () => void,
  onSubmit: (text: string) => void,
  pendingWaiting: boolean,
  typing: I.Set<string>,

  // Added.
  sendTyping: (typing: boolean) => void,

  _quotingMessage: ?Types.Message,
  _editingMessage: ?Types.Message,
}

type State = {
  text: string,
}

const unsentText: {[Types.ConversationIDKey]: string} = {}

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 1000)

class Input extends React.Component<Props, State> {
  _input: ?TextInput

  constructor(props: Props) {
    super(props)
    this.state = {
      text: unsentText[props.conversationIDKey] || '',
    }
  }

  _setText = (text: string, skipUnsentSaving?: boolean) => {
    this.setState({text})
    if (!skipUnsentSaving) {
      unsentText[this.props.conversationIDKey] = text
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

  _inputBlur = () => this._input && this._input.blur()

  _inputFocus = () => this._input && this._input.focus()

  _inputMoveToEnd = () => this._input && this._input.moveCursorToEnd()

  _inputGetRef = () => this._input

  _inputSelections = () => (this._input && this._input.selections()) || {}

  render = () => {
    return (
      <MentionHocInput
        {...this.props}
        _inputSetRef={this._inputSetRef}
        _onKeyDown={this._onKeyDown}
        onSubmit={this._onSubmit}
        text={this.state.text}
        setText={this._setText}
      />
    )
  }
}

export type {Props}

export default Input

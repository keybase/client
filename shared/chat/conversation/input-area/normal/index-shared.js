// @flow
import * as React from 'react'
import * as I from 'immutable'
import {Input as TextInput} from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import {isMobile} from '../../../../util/container'
import mentionHoc, {type PropsFromContainer} from '../mention-handler-hoc'
import {default as _Input} from '.'
import {throttle} from 'lodash-es'
import {formatTextForQuoting} from '../../../../util/chat'

// For some reason, flow can't infer the type of mentionHoc here.
const MentionHocInput: React.ComponentType<PropsFromContainer> = mentionHoc(_Input)

type Props = {
  // Subset of PreMentionHocProps.
  conversationIDKey: Types.ConversationIDKey,
  channelName: string,
  isEditing: boolean,
  focusInputCounter: number,
  clearInboxFilter: () => void,
  onAttach: (paths: Array<string>) => void,
  onEditLastMessage: () => void,
  onCancelEditing: () => void,
  onCancelQuoting: () => void,
  onSubmit: (text: string) => void,
  pendingWaiting: boolean,
  typing: I.Set<string>,

  // Added.
  sendTyping: (typing: boolean) => void,

  _quotingMessage: ?Types.Message,
  _editingMessage: ?Types.Message,
  injectedInput: string,
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

  _inputBlur = () => {
    this._input && this._input.blur()
  }

  _inputFocus = () => {
    this._input && this._input.focus()
  }

  _inputMoveToEnd = () => this._input && this._input.moveCursorToEnd()

  _inputGetRef = () => this._input

  _inputSelections = () => (this._input ? this._input.selections() : null)

  // The types for prevProps and nextProps aren't exact, but they're
  // good enough.
  componentDidUpdate(prevProps: Props) {
    if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
      this._inputFocus()
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    const props: Props = this.props

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
      const text = unsentText[nextProps.conversationIDKey] || ''
      this._setText(text, true)
    }

    if (nextProps.isEditing && !props.isEditing) {
      this._inputFocus()
    }
  }

  render = () => {
    return (
      <MentionHocInput
        {...this.props}
        _onKeyDown={this._onKeyDown}
        inputBlur={this._inputBlur}
        inputFocus={this._inputFocus}
        inputSetRef={this._inputSetRef}
        inputSelections={this._inputSelections}
        onSubmit={this._onSubmit}
        text={this.state.text}
        setText={this._setText}
      />
    )
  }
}

export type {Props}

export default Input

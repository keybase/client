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
  onJoinChannel: () => void,
  onLeaveChannel: () => void,
  onSubmit: (text: string) => void,
  pendingWaiting: boolean,
  typing: I.Set<string>,

  // From PropsFromContainer.
  _inputSetRef: (?TextInput) => void,
  _onKeyDown: (e: SyntheticKeyboardEvent<>) => void,

  // Added.
  sendTyping: (typing: boolean) => void,
}

type State = {
  text: string,
}

const unsentText: {[Types.ConversationIDKey]: string} = {}

// Standalone throttled function to ensure we never accidentally recreate it and break the throttling
const throttled = throttle((f, param) => f(param), 1000)

class Input extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      text: unsentText[props.conversationIDKey] || '',
    }
  }

  setText = (text: string, skipUnsentSaving?: boolean) => {
    this.setState({text})
    if (!skipUnsentSaving) {
      unsentText[this.props.conversationIDKey] = text
    }

    throttled(this.props.sendTyping, !!text)
  }

  _onSubmit = (text: string) => {
    this.props.onSubmit(text)
    this.setText('')
  }

  render = () => {
    return (
      <MentionHocInput
        {...this.props}
        onSubmit={this._onSubmit}
        text={this.state.text}
        setText={this.setText}
      />
    )
  }
}

export type {Props}

export default Input

// @flow
import React from 'react'
import {Set} from 'immutable'
import {storiesOf, action} from '../../../stories/storybook'
import mentionHoc from './mention-handler-hoc'
import {type PreMentionHocProps, default as _Input} from './normal'
import {stringToConversationIDKey} from '../../../constants/types/chat2'

const Input = mentionHoc(_Input)

const defaultProps: PreMentionHocProps = {
  conversationIDKey: stringToConversationIDKey('fake conversation id key'),
  channelName: 'somechannel',
  isEditing: false,
  focusInputCounter: 0,
  clearInboxFilter: action('clearInboxFilter'),
  inputBlur: action('inputBlur'),
  inputClear: action('inputClear'),
  inputFocus: action('inputFocus'),
  inputSetRef: action('inputSetRef'),
  inputValue: action('inputValue'),
  isLoading: false,
  isPreview: false,
  onAttach: action('onAttach'),
  onEditLastMessage: action('onEditLastMessage'),
  onCancelEditing: action('onCancelEditing'),
  onJoinChannel: action('onJoinChannel'),
  onLeaveChannel: action('onLeaveChannel'),
  onSubmit: action('onSubmit'),
  onStoreInputText: action('onStoreInputText'),
  onUpdateTyping: action('onUpdateTyping'),
  pendingWaiting: false,
  setText: action('setText'),
  text: '',
  typing: Set(),
}

const load = () => {
  storiesOf('Chat/Conversation/Input', module).add('Basic', () => <Input {...defaultProps} />)
}

export default load

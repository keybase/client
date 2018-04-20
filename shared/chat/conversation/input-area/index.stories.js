// @flow
import React from 'react'
import {Set} from 'immutable'
import {Box2} from '../../../common-adapters/box'
import {storiesOf, action} from '../../../stories/storybook'
import mentionHoc, {type PropsFromContainer} from './mention-handler-hoc'
import {default as _Input} from './normal'
import {stringToConversationIDKey} from '../../../constants/types/chat2'

const Input = mentionHoc(_Input)

const defaultProps: PropsFromContainer = {
  _inputSetRef: action('inputSetRef'),
  _onKeyDown: action('_onKeyDown'),

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
  storiesOf('Chat/Conversation/Input', module).add('Basic', () => (
    <Box2 direction="horizontal" style={{width: 500}}>
      <Input {...defaultProps} />
    </Box2>
  ))
}

export default load

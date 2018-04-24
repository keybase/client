// @flow
import * as React from 'react'
import {Set} from 'immutable'
import {Box2} from '../../../common-adapters/box'
import * as PropProviders from '../../../stories/prop-providers'
import {action, storiesOf} from '../../../stories/storybook'
import mentionHoc, {type PropsFromContainer} from './mention-handler-hoc'
import {default as _Input} from './normal'
import {stringToConversationIDKey} from '../../../constants/types/chat2'

// For some reason, flow can't infer the type of mentionHoc here.
const Input: React.ComponentType<PropsFromContainer> = mentionHoc(_Input)

const provider = PropProviders.compose(PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'), {
  ChannelMentionHud: props => {
    const channels = ['foo', 'bar']
    return {
      ...props,
      channels,
      following: Set(),
      you: 'chris',
      data: channels
        .filter(c => c.toLowerCase().indexOf(props.filter) >= 0)
        .sort()
        .map((c, i) => ({channelName: c, selected: i === props.selectedIndex})),
    }
  },
  UserMentionHud: props => ({
    ...props,
    following: Set(),
    you: 'chris',
    data: [{username: 'marcopolo', fullName: 'Marco Munizaga'}, {username: 'trex', fullName: ''}]
      .map((u, i) => ({
        username: u.username,
        fullName: u.fullName,
        key: u.username,
      }))
      .filter(u => {
        return (
          u.username.toLowerCase().indexOf(props.filter) >= 0 ||
          u.fullName.toLowerCase().indexOf(props.filter) >= 0
        )
      })
      .map((u, i) => ({...u, selected: i === props.selectedIndex})),
    users: [{username: 'marcopolo', fullName: 'Marco Munizaga'}, {username: 'trex', fullName: ''}],
  }),
})

type State = {
  text: string,
}

class InputContainer extends React.Component<{}, State> {
  constructor(props) {
    super(props)
    this.state = {text: ''}
  }

  _setText = (text: string) => {
    this.setState({text})
  }

  render = () => {
    const props: PropsFromContainer = {
      _inputSetRef: action('inputSetRef'),
      _onKeyDown: (e: SyntheticKeyboardEvent<>) => {
        action('_onKeyDown')(e.key)
      },

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
      setText: this._setText,
      text: this.state.text,
      typing: Set(),
    }

    return (
      <Box2 direction="horizontal" style={{width: 500}}>
        <Input {...props} />
      </Box2>
    )
  }
}

const load = () => {
  storiesOf('Chat/Conversation/Input', module)
    .addDecorator(provider)
    .add('Basic', () => (
      <Box2 direction="horizontal" style={{height: 750, width: 500}}>
        <InputContainer />
      </Box2>
    ))
}

export default load

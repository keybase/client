// @flow
import * as React from 'react'
import {Set} from 'immutable'
import {Box2} from '../../../../common-adapters/box'
import {platformStyles} from '../../../../styles'
import * as PropProviders from '../../../../stories/prop-providers'
import {action, storiesOf} from '../../../../stories/storybook'
import Input, {type Props as InputProps} from '.'
import {isMobile} from '../../../../constants/platform'
import {stringToConversationIDKey} from '../../../../constants/types/chat2'

const provider = PropProviders.compose(PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'), {
  ChannelMentionHud: ownProps => {
    const channels = ['foo', 'bar']
    return {
      ...ownProps,
      channels,
    }
  },
  UserMentionHud: ownProps => {
    const users = [
      {username: 'marcopolo', fullName: 'Marco Munizaga'},
      {username: 'trex', fullName: 'Thomas Rex'},
      {username: 'chris', fullName: 'Chris Coyne'},
    ]
    return {
      ...ownProps,
      users,
    }
  },
})

type Props = {
  isEditing: boolean,
  pendingWaiting: boolean,
  typing: Set<string>,
}

// On mobile, we want full width and height. On desktop, we we want to
// manually set dimensions. Not sure why fullHeight doesn't work on
// mobile, though.
const boxProps = {
  direction: 'vertical',
  fullWidth: isMobile,
  style: platformStyles({
    common: {height: 300, justifyContent: 'flex-end'},
    isElectron: {width: 500},
    isMobile: {},
  }),
}

class InputContainer extends React.Component<Props> {
  render = () => {
    const props: InputProps = {
      conversationIDKey: stringToConversationIDKey('fake conversation id key'),
      channelName: 'somechannel',
      isEditing: this.props.isEditing,
      focusInputCounter: 0,
      clearInboxFilter: action('clearInboxFilter'),
      onAttach: (paths: Array<string>) => {
        // This will always be called with an empty array, since some
        // browsers don't have the path property set on File.
        action('onAttach').apply(null, paths)
      },
      onEditLastMessage: action('onEditLastMessage'),
      onCancelEditing: action('onCancelEditing'),
      onCancelQuoting: action('onCancelQuoting'),
      onSubmit: (text: string) => {
        action('onSubmit')(text)
      },
      pendingWaiting: this.props.pendingWaiting,
      typing: this.props.typing,

      _quotingMessage: null,
      _editingMessage: null,

      injectedInput: '',

      getUnsentText: () => {
        action('getUnsentText')()
        return this.props.isEditing ? 'some text' : ''
      },

      setUnsentText: action('setUnsentText'),

      sendTyping: action('sendTyping'),
    }

    return (
      <Box2 {...boxProps}>
        <Input {...props} />
      </Box2>
    )
  }
}

const load = () => {
  storiesOf('Chat/Conversation/Input', module)
    .addDecorator(provider)
    .add('Normal', () => <InputContainer isEditing={false} pendingWaiting={false} typing={Set()} />)
    .add('Typing 1', () => (
      <InputContainer isEditing={false} pendingWaiting={false} typing={Set(['chris'])} />
    ))
    .add('Typing 2', () => (
      <InputContainer isEditing={false} pendingWaiting={false} typing={Set(['chris', 'strib'])} />
    ))
    .add('Typing 3', () => (
      <InputContainer isEditing={false} pendingWaiting={false} typing={Set(['chris', 'strib', 'fred'])} />
    ))
    .add('Editing', () => <InputContainer isEditing={true} pendingWaiting={false} typing={Set()} />)
    .add('Pending waiting', () => <InputContainer isEditing={false} pendingWaiting={true} typing={Set()} />)
}

export default load

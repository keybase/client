// @flow
import * as React from 'react'
import {Set} from 'immutable'
import {Input as TextInput} from '../../../common-adapters'
import {Box2} from '../../../common-adapters/box'
import {platformStyles} from '../../../styles'
import * as PropProviders from '../../../stories/prop-providers'
import {action, storiesOf} from '../../../stories/storybook'
import mentionHoc, {type PropsFromContainer} from './mention-handler-hoc'
import {default as _Input} from './normal'
import {isMobile} from '../../../constants/platform'
import {stringToConversationIDKey} from '../../../constants/types/chat2'

// For some reason, flow can't infer the type of mentionHoc here.
const Input: React.ComponentType<PropsFromContainer> = mentionHoc(_Input)

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
  text: string,
  typing: Set<string>,
}

type State = {
  text: string,
}

const boxProps = {
  direction: 'vertical',
  fullWidth: isMobile,
  style: platformStyles({
    isElectron: {height: 750, width: 500},
    isMobile: {justifyContent: 'flex-end', height: 300},
  }),
}

class InputContainer extends React.Component<Props, State> {
  _input: ?TextInput

  constructor(props) {
    super(props)
    this.state = {text: ''}
    this._input = null
  }

  static getDerivedStateFromProps = (nextProps: Props, prevState: State) => {
    return {text: nextProps.text}
  }

  _inputSetRef = (ref: ?TextInput) => {
    this._input = ref
  }

  _setText = (text: string) => {
    this.setState({text})
  }

  render = () => {
    const props: PropsFromContainer = {
      _inputSetRef: this._inputSetRef,
      _onKeyDown: (e: SyntheticKeyboardEvent<>) => {
        action('_onKeyDown')(e.key)
      },

      // Need to inject this manually since we're not loading from
      // container/normal.js.
      inputSelections: () => (this._input ? this._input.selections() : {}),

      conversationIDKey: stringToConversationIDKey('fake conversation id key'),
      channelName: 'somechannel',
      isEditing: this.props.isEditing,
      focusInputCounter: 0,
      clearInboxFilter: action('clearInboxFilter'),
      inputBlur: action('inputBlur'),
      inputClear: action('inputClear'),
      inputFocus: action('inputFocus'),
      inputSetRef: action('inputSetRef'),
      inputValue: action('inputValue'),
      onAttach: (paths: Array<string>) => {
        // This will always be called with an empty array, since some
        // browsers don't have the path property set on File.
        action('onAttach').apply(null, paths)
      },
      onEditLastMessage: action('onEditLastMessage'),
      onCancelEditing: action('onCancelEditing'),
      onJoinChannel: action('onJoinChannel'),
      onLeaveChannel: action('onLeaveChannel'),
      onSubmit: action('onSubmit'),
      pendingWaiting: this.props.pendingWaiting,
      setText: this._setText,
      text: this.state.text,
      typing: this.props.typing,
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
    .add('Normal', () => <InputContainer isEditing={false} pendingWaiting={false} text="" typing={Set()} />)
    .add('Typing 1', () => (
      <InputContainer isEditing={false} pendingWaiting={false} text="" typing={Set(['chris'])} />
    ))
    .add('Typing 2', () => (
      <InputContainer isEditing={false} pendingWaiting={false} text="" typing={Set(['chris', 'strib'])} />
    ))
    .add('Typing 3', () => (
      <InputContainer
        isEditing={false}
        pendingWaiting={false}
        text=""
        typing={Set(['chris', 'strib', 'fred'])}
      />
    ))
    .add('Editing', () => (
      <InputContainer isEditing={true} pendingWaiting={false} text="some text" typing={Set()} />
    ))
    .add('Pending waiting', () => (
      <InputContainer isEditing={false} pendingWaiting={true} text="" typing={Set()} />
    ))
}

export default load

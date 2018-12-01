// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import {Set} from 'immutable'
import {Box2} from '../../../../common-adapters/box'
import {platformStyles} from '../../../../styles'
import Input, {type Props as InputProps} from '.'
import {isMobile} from '../../../../constants/platform'
import {stringToConversationIDKey} from '../../../../constants/types/chat2'

const provider = Sb.createPropProviderWithCommon({
  ChannelMentionHud: ownProps => {
    const channels = ['foo', 'bar']
    return {
      ...ownProps,
      channels,
    }
  },
  SetExplodePopup: ownProps => ({
    attachTo: ownProps.attachTo,
    isNew: ownProps.isNew,
    items: [
      {seconds: 0, text: '7 days'},
      {seconds: 0, text: '3 days'},
      {seconds: 0, text: '24 hours'},
      {seconds: 0, text: '6 hours'},
      {seconds: 0, text: '60 minutes'},
      {seconds: 0, text: '5 minutes'},
      {seconds: 0, text: '30 seconds days'},
      {seconds: 0, text: 'Never (turn off)'},
    ],
    onAfterSelect: Sb.action('onAfterSelect'),
    onHidden: ownProps.onHidden,
    onSelect: Sb.action('onSelect'),
    selected: 0,
    visible: ownProps.visible,
  }),
  UserMentionHud: ownProps => {
    const users = [
      {fullName: 'Marco Munizaga', username: 'marcopolo'},
      {fullName: 'Thomas Rex', username: 'trex'},
      {fullName: 'Chris Coyne', username: 'chris'},
    ]
    return {
      ...ownProps,
      users,
    }
  },
  WalletsIcon: ownProps => ({
    isNew: true,
    onClick: Sb.action('onOpenWalletsForm'),
    shouldRender: true,
    size: ownProps.size,
    style: ownProps.style,
  }),
})

type Props = {
  isEditExploded: boolean,
  isEditing: boolean,
  isExploding: boolean,
  isExplodingNew: boolean,
  explodingModeSeconds: number,
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

const InputContainer = (props: Props) => {
  const inputProps: InputProps = {
    clearInboxFilter: Sb.action('clearInboxFilter'),
    conversationIDKey: stringToConversationIDKey('fake conversation id key'),
    editText: '',
    explodingModeSeconds: props.explodingModeSeconds,
    focusInputCounter: 0,
    getUnsentText: () => {
      Sb.action('getUnsentText')()
      return props.isEditing ? 'some text' : ''
    },
    isEditExploded: props.isEditExploded,
    isEditing: props.isEditing,
    isExploding: props.isExploding,
    isExplodingNew: props.isExplodingNew,
    onAttach: (paths: Array<string>) => {
      // This will always be called with an empty array, since some
      // browsers don't have the path property set on File.
      Sb.action('onAttach').apply(null, paths)
    },
    onCancelEditing: Sb.action('onCancelEditing'),
    onEditLastMessage: Sb.action('onEditLastMessage'),
    onFilePickerError: Sb.action('onFilePickerError'),
    onSeenExplodingMessages: Sb.action('onSeenExplodingMessages'),

    onSubmit: (text: string) => {
      Sb.action('onSubmit')(text)
    },
    quoteCounter: 0,
    quoteText: '',

    sendTyping: Sb.action('sendTyping'),

    setUnsentText: Sb.action('setUnsentText'),
    typing: props.typing,
  }

  return (
    <Box2 {...boxProps}>
      <Input {...inputProps} />
    </Box2>
  )
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Input', module)
    .addDecorator(provider)
    .add('Normal', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={false}
        typing={Set()}
        isExploding={false}
        isExplodingNew={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Typing 1', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={false}
        typing={Set(['chris'])}
        isExploding={false}
        isExplodingNew={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Typing 2', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={false}
        typing={Set(['chris', 'strib'])}
        isExploding={false}
        isExplodingNew={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Typing 3', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={false}
        typing={Set(['chris', 'strib', 'fred'])}
        isExploding={false}
        isExplodingNew={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Editing', () => (
      <InputContainer
        isEditing={true}
        isEditExploded={false}
        pendingWaiting={false}
        typing={Set()}
        isExploding={false}
        isExplodingNew={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Pending waiting', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={true}
        typing={Set()}
        isExploding={false}
        isExplodingNew={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Exploding', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={false}
        typing={Set()}
        isExploding={true}
        isExplodingNew={true}
        explodingModeSeconds={0}
      />
    ))
}

export default load

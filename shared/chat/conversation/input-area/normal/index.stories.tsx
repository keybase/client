import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {List, Set} from 'immutable'
import {Box2} from '../../../../common-adapters/box'
import {platformStyles} from '../../../../styles'
import Input, {Props as InputProps} from '.'
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
  Typing: ownProps => ({
    conversationIDKey: ownProps.conversationIDKey,
    names: Set(),
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
    onRequest: Sb.action('onRequestLumens'),
    onSend: Sb.action('onSendLumens'),
    size: ownProps.size,
    style: ownProps.style,
  }),
})

type Props = {
  cannotWrite?: boolean
  isEditExploded: boolean
  isEditing: boolean
  isExploding: boolean
  explodingModeSeconds: number
  minWriterRole?: string
  pendingWaiting: boolean
}

// On mobile, we want full width and height. On desktop, we we want to
// manually set dimensions. Not sure why fullHeight doesn't work on
// mobile, though.
const boxProps = {
  direction: 'vertical' as 'vertical',
  fullWidth: isMobile,
  style: platformStyles({
    common: {height: 300, justifyContent: 'flex-end'},
    isElectron: {width: 500},
    isMobile: {},
  }),
}

const InputContainer = (props: Props) => {
  const inputProps: InputProps = {
    cannotWrite: props.cannotWrite || false,
    clearInboxFilter: Sb.action('clearInboxFilter'),
    conversationIDKey: stringToConversationIDKey('fake conversation id key'),
    editText: '',
    explodingModeSeconds: props.explodingModeSeconds,
    focusInputCounter: 0,
    getUnsentText: () => {
      Sb.action('getUnsentText')()
      return props.isEditing ? 'some text' : ''
    },
    isActiveForFocus: true,
    isEditExploded: props.isEditExploded,
    isEditing: props.isEditing,
    isExploding: props.isExploding,
    isSearching: false,
    minWriterRole: props.minWriterRole || 'writer',
    onAttach: (paths: Array<string>) => {
      // This will always be called with an empty array, since some
      // browsers don't have the path property set on File.
      Sb.action('onAttach').apply(null, paths)
    },
    onCancelEditing: Sb.action('onCancelEditing'),
    onCancelReply: Sb.action('onCancelReply'),
    onEditLastMessage: Sb.action('onEditLastMessage'),
    onFilePickerError: Sb.action('onFilePickerError'),
    onRequestScrollDown: Sb.action('onRequestScrollDown'),
    onRequestScrollUp: Sb.action('onRequestScrollUp'),
    onSubmit: (text: string) => {
      Sb.action('onSubmit')(text)
    },
    prependText: null,
    quoteCounter: 0,
    quoteText: '',
    sendTyping: Sb.action('sendTyping'),
    setUnsentText: Sb.action('setUnsentText'),
    showCommandMarkdown: false,
    showCommandStatus: false,
    showGiphySearch: false,
    showReplyPreview: false,
    showTypingStatus: false,
    showWalletsIcon: !props.isEditing,
    suggestAllChannels: List([
      {channelname: 'general', teamname: 'keybase'},
      {channelname: 'spooner', teamname: 'keybase'},
      {channelname: 'general', teamname: 'got'},
      {channelname: 'live', teamname: 'got'},
    ]),
    suggestBotCommands: [
      {
        description: 'Build the app',
        hasHelpText: true,
        name: 'build',
        usage: '[platform]',
        username: 'mikem',
      },
      {description: '', hasHelpText: true, name: 'help', usage: '', username: 'mikem'},
      {
        description: 'What is this bot doing',
        hasHelpText: false,
        name: 'status',
        usage: '[--extended]',
        username: 'mikem',
      },
    ],
    suggestBotCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatus.updating,
    suggestChannels: List(['general', 'random', 'spelunky', 'music', 'vidya-games']),
    suggestCommands: [
      {description: 'Hide current or given conv', hasHelpText: false, name: 'hide', usage: '[conversation]'},
      {description: 'Message a user', hasHelpText: false, name: 'msg', usage: '<conversation> <msg>'},
      {description: 'Send a shrug', hasHelpText: false, name: 'shrug', usage: ''},
    ],
    suggestTeams: [
      {fullName: '', teamname: 'keybase', username: ''},
      {fullName: '', teamname: 'got', username: ''},
    ],
    suggestUsers: List([
      {fullName: 'Danny Ayoub', username: 'ayoubd'},
      {fullName: 'Chris Nojima', username: 'chrisnojima'},
      {fullName: 'Mike Maxim', username: 'mikem'},
      {fullName: 'Alex Gessner', username: 'xgess'},
    ]),
    unsentText: null,
    unsentTextChanged: Sb.action('unsentTextChanged'),
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
        isExploding={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Editing', () => (
      <InputContainer
        isEditing={true}
        isEditExploded={false}
        pendingWaiting={false}
        isExploding={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Pending waiting', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={true}
        isExploding={false}
        explodingModeSeconds={0}
      />
    ))
    .add('Exploding', () => (
      <InputContainer
        isEditing={false}
        isEditExploded={false}
        pendingWaiting={false}
        isExploding={true}
        explodingModeSeconds={0}
      />
    ))
    .add('Can’t write', () => (
      <InputContainer
        cannotWrite={true}
        isEditing={false}
        isEditExploded={false}
        minWriterRole="admin"
        pendingWaiting={false}
        isExploding={false}
        explodingModeSeconds={0}
      />
    ))
}

export default load

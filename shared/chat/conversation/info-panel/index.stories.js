// @flow
import React from 'react'
import {storiesOf, action} from '../../../stories/storybook'
import * as Types from '../../../constants/types/chat2'
import * as PropProviders from '../../../stories/prop-providers'
import {Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {InfoPanel, type InfoPanelProps} from '.'

const unexpected = (name: string) => () => {
  throw new Error(`unexpected ${name}`)
}

const onlyValidConversationsProps = {
  conversationIDKey: 'fake key',
}

const notificationProps = {
  _muteConversation: action('_muteConversation'),
  _storeChannelWide: false,
  _storeDesktop: 'onWhenAtMentioned',
  _storeMobile: 'never',
  _storeMuted: false,
  _updateNotifications: action('_updateNotifications'),
}

const provider = PropProviders.compose(PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'), {
  InfoPanel: (props: InfoPanelProps) => props,
  OnlyValidConversations: () => onlyValidConversationsProps,
  LifecycleNotifications: () => notificationProps,
})

const commonProps = {
  selectedConversationIDKey: Types.stringToConversationIDKey(''),
  participants: [
    {
      fullname: 'Fred Akalin',
      username: 'akalin',
    },
    {
      fullname: 'Jeremy Stribling',
      username: 'strib',
    },
    {
      fullname: 'Max Krohn',
      username: 'max',
    },
  ],
  onBack: unexpected('onBack'),
  onShowProfile: (username: string) => action(`onShowProfile(${username})`),
}

const conversationProps = {
  ...commonProps,
  isPreview: false,
  teamname: null,
  channelname: null,
  smallTeam: false,
  admin: false,

  onShowBlockConversationDialog: action('onShowBlockConversationDialog'),
  onShowNewTeamDialog: action('onShowNewTeamDialog'),

  onViewTeam: unexpected('onViewTeam'),

  onLeaveConversation: unexpected('onLeaveConversation'),
  onJoinChannel: unexpected('onJoinChannel'),
}

const teamCommonProps = {
  ...commonProps,
  teamname: 'someteam',
  channelname: 'somechannel',

  onShowBlockConversationDialog: unexpected('onShowBlockConversationDialog'),
  onShowNewTeamDialog: unexpected('onShowNewTeamDialog'),

  onViewTeam: action('onViewTeam'),
}

const smallTeamProps = {
  ...teamCommonProps,
  isPreview: false,
  smallTeam: true,
  admin: false,

  onLeaveConversation: unexpected('onLeaveConversation'),
  onJoinChannel: unexpected('onJoinChannel'),
}

const bigTeamCommonProps = {
  ...teamCommonProps,
  smallTeam: false,
  admin: false,
}

const bigTeamPreviewProps = {
  ...bigTeamCommonProps,
  isPreview: true,
  channelname: 'somechannel',
  smallTeam: false,
  admin: false,

  onLeaveConversation: unexpected('onLeaveConversation'),
  onJoinChannel: action('onJoinChannel'),
}

const bigTeamNoPreviewProps = {
  ...bigTeamCommonProps,
  isPreview: false,
  channelname: 'somechannel',
  smallTeam: false,
  admin: false,

  onLeaveConversation: action('onLeaveConversation'),
  onJoinChannel: unexpected('onJoinChannel'),
}

const load = () => {
  storiesOf('Chat/Conversation/InfoPanel', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxColumn, height: 500, width: 320}}>{story()}</Box>
    ))
    .add('Conversation', () => <InfoPanel {...conversationProps} />)
    .add('Small team', () => <InfoPanel {...smallTeamProps} />)
    .add('Big team preview', () => <InfoPanel {...bigTeamPreviewProps} />)
    .add('Big team no preview', () => <InfoPanel {...bigTeamNoPreviewProps} />)
}

export default load

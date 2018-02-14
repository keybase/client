// @flow
import React from 'react'
import {storiesOf, action, createPropProvider} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {InfoPanel, type InfoPanelProps} from '.'
import {type Props as NotificationProps} from './notifications'

const unexpected = (name: string) => () => {
  throw new Error(`unexpected ${name}`)
}

const onlyValidConversationsProps = {
  conversationIDKey: 'fake key',
}

const notificationProps: NotificationProps = {
  _resetSaveState: () => ({}),
  channelWide: false,
  desktop: 'atmention',
  mobile: 'never',
  muted: false,
  saveState: 'unsaved',
  onMuteConversation: action('onMuteConversation'),
  onSetDesktop: action('onSetDesktop'),
  onSetMobile: action('onSetMobile'),
  onToggleChannelWide: action('onToggleChannelwide'),
}

const provider = createPropProvider({
  InfoPanel: (props: InfoPanelProps) => props,
  OnlyValidConversations: () => onlyValidConversationsProps,
  // This is what ends up as the display name for Notifications.
  'lifecycle(Component)': () => notificationProps,
})

const commonProps = {
  participants: [
    {
      broken: false,
      following: false,
      fullname: 'Fred Akalin',
      isYou: true,
      username: 'akalin',
    },
    {
      broken: false,
      following: true,
      fullname: 'Jeremy Stribling',
      isYou: false,
      username: 'strib',
    },
    {
      broken: true,
      following: true,
      fullname: 'Max Krohn',
      isYou: false,
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

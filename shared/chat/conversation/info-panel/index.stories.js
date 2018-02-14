// @flow
import React from 'react'
import {storiesOf, action, createPropProvider} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {InfoPanel, type InfoPanelProps} from '.'
import {type ParticipantInfo} from './participant'
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

const participants: Array<ParticipantInfo> = [
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
]

const commonProps = {
  participants,
  onBack: unexpected('onBack'),
}

const conversationProps = {
  isPreview: false,
  teamname: null,
  channelname: null,
  smallTeam: false,
  admin: false,

  onShowProfile: (username: string) => action(`onShowProfile(${username})`),

  onShowBlockConversationDialog: action('onShowBlockConversationDialog'),
  onShowNewTeamDialog: action('onShowNewTeamDialog'),

  onViewTeam: unexpected('onViewTeam'),

  onLeaveConversation: unexpected('onLeaveConversation'),
  onJoinChannel: unexpected('onJoinChannel'),
}

const provider = createPropProvider({
  InfoPanel: (props: InfoPanelProps) => props,
  OnlyValidConversations: () => onlyValidConversationsProps,
  // This is what ends up as the display name for Notifications.
  'lifecycle(Component)': () => notificationProps,
})

const load = () => {
  storiesOf('Chat/Conversation/InfoPanel', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxColumn, height: 400, width: 320}}>{story()}</Box>
    ))
    .add('Conversation', () => <InfoPanel {...commonProps} {...conversationProps} />)
}

export default load

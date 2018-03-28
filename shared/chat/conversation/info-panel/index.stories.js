// @flow
import React from 'react'
import {storiesOf, action} from '../../../stories/storybook'
import * as Types from '../../../constants/types/chat2'
import * as PropProviders from '../../../stories/prop-providers'
import {retentionPolicies} from '../../../constants/teams'
import {Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {InfoPanel, type InfoPanelProps} from '.'

const navigateAppend = action('navigateAppend')
const navigateUp = action('navigateUp')

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

const retentionPickerPropSelector = props => ({
  _loadTeamPolicy: action('_loadTeamPolicy'),
  containerStyle: props.containerStyle,
  dropdownStyle: props.dropdownStyle,
  navigateAppend,
  navigateUp,
  policy: retentionPolicies.policyThreeMonths,
  teamPolicy: retentionPolicies.policyMonth,
  loading: false,
  isTeamWide: props.isTeamWide,
  type: props.type,
  isSmallTeam: props.isSmallTeam,
  setRetentinPolicy: action('setRetentionPolicy'),
  onSelect: action('onSelectRetentionPolicy'),
  onShowDropdown: action('onShowDropdownRetentionPicker'),
  onShowWarning: action('onShowWarningRetentionPicker'),
})

const provider = PropProviders.compose(PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'), {
  InfoPanel: (props: InfoPanelProps) => props,
  OnlyValidConversations: () => onlyValidConversationsProps,
  LifecycleNotifications: () => notificationProps,
  RetentionPicker: retentionPickerPropSelector,
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
  navigateAppend,
  navigateUp,
}

const conversationProps = {
  ...commonProps,
  isPreview: false,
  teamname: null,
  channelname: null,
  smallTeam: false,
  admin: false,
  canEditChannel: true,
  canSetRetention: false,
  description: "You shouldn't be seeing this",

  onShowBlockConversationDialog: action('onShowBlockConversationDialog'),
  onShowNewTeamDialog: action('onShowNewTeamDialog'),

  onAddPeople: unexpected('onAddPeople'),
  onViewTeam: unexpected('onViewTeam'),
  onClickGear: unexpected('onClickGear'),

  onLeaveConversation: unexpected('onLeaveConversation'),
  onJoinChannel: unexpected('onJoinChannel'),
  onEditChannel: unexpected('onEditChannel'),
}

const teamCommonProps = {
  ...commonProps,
  teamname: 'someteam',
  channelname: 'somechannel',
  canEditChannel: true,
  canSetRetention: true,

  onShowBlockConversationDialog: unexpected('onShowBlockConversationDialog'),
  onShowNewTeamDialog: unexpected('onShowNewTeamDialog'),

  onAddPeople: action('onAddPeople'),
  onViewTeam: action('onViewTeam'),
  onClickGear: action('onClickGear'),
}

const smallTeamProps = {
  ...teamCommonProps,
  isPreview: false,
  smallTeam: true,
  admin: false,
  description: "You shouldn't be seeing this",

  onLeaveConversation: unexpected('onLeaveConversation'),
  onJoinChannel: unexpected('onJoinChannel'),
  onEditChannel: unexpected('onEditChannel'),
}

const bigTeamCommonProps = {
  ...teamCommonProps,
  smallTeam: false,
  admin: false,
  description: 'The best channel',
  onEditChannel: action('onEditChannel'),
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

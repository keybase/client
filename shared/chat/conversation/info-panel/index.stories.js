// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Constants from '../../../constants/chat2'
import {retentionPolicies} from '../../../constants/teams'
import {Box} from '../../../common-adapters'
import {globalStyles} from '../../../styles'
import {InfoPanel, type InfoPanelProps} from '.'

const onlyValidConversationsProps = {
  conversationIDKey: 'fake key',
}

const notificationProps = {
  _muteConversation: Sb.action('_muteConversation'),
  _storeChannelWide: false,
  _storeDesktop: 'onWhenAtMentioned',
  _storeMobile: 'never',
  _storeMuted: false,
  _updateNotifications: Sb.action('_updateNotifications'),
}

const minWriterRoleProps = {
  canSetMinWriterRole: false,
  minWriterRole: 'reader',
}

const retentionPickerPropSelector = props => ({
  _loadTeamPolicy: Sb.action('_loadTeamPolicy'),
  _loadTeamOperations: Sb.unexpected('_loadTeamOperations'),
  _onShowDropdown: Sb.action('onShowDropdownRetentionPicker'),
  _onShowWarning: Sb.action('onShowWarningRetentionPicker'),
  _parentPath: 'mockedParentPath',
  _permissionsLoaded: true,
  canSetPolicy: true,
  containerStyle: props.containerStyle,
  dropdownStyle: props.dropdownStyle,
  entityType: props.entityType,
  policy: retentionPolicies.policyThreeMonths,
  teamPolicy: retentionPolicies.policyMonth,
  loading: false,
  isTeamWide: props.isTeamWide,
  type: props.type,
  isSmallTeam: props.isSmallTeam,
  setRetentinPolicy: Sb.action('setRetentionPolicy'),
  onSelect: Sb.action('onSelectRetentionPolicy'),
})

const provider = Sb.createPropProviderWithCommon({
  ...Sb.PropProviders.TeamDropdownMenu(),
  InfoPanel: (props: InfoPanelProps) => props,
  MinWriterRole: () => minWriterRoleProps,
  OnlyValidConversations: () => onlyValidConversationsProps,
  LifecycleNotifications: () => notificationProps,
  RetentionPicker: retentionPickerPropSelector,
})

const commonProps = {
  selectedConversationIDKey: Constants.noConversationIDKey,
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
  onBack: Sb.unexpected('onBack'),
  onShowProfile: (username: string) => Sb.action(`onShowProfile(${username})`),
  canDeleteHistory: true,
  canSetMinWriterRole: false,
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

  onShowClearConversationDialog: Sb.action('onShowClearConversationDialog'),
  onShowBlockConversationDialog: Sb.action('onShowBlockConversationDialog'),
  onShowNewTeamDialog: Sb.action('onShowNewTeamDialog'),

  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  onJoinChannel: Sb.unexpected('onJoinChannel'),
  onEditChannel: Sb.unexpected('onEditChannel'),
}

const teamCommonProps = {
  ...commonProps,
  teamname: 'someteam',
  channelname: 'somechannel',
  canEditChannel: true,
  canSetRetention: true,

  onShowClearConversationDialog: Sb.unexpected('onShowClearConversationDialog'),
  onShowBlockConversationDialog: Sb.unexpected('onShowBlockConversationDialog'),
  onShowNewTeamDialog: Sb.unexpected('onShowNewTeamDialog'),
}

const smallTeamProps = {
  ...teamCommonProps,
  isPreview: false,
  smallTeam: true,
  admin: false,
  description: "You shouldn't be seeing this",

  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  onJoinChannel: Sb.unexpected('onJoinChannel'),
  onEditChannel: Sb.unexpected('onEditChannel'),
}

const bigTeamCommonProps = {
  ...teamCommonProps,
  smallTeam: false,
  admin: false,
  description: 'The best channel',
  onEditChannel: Sb.action('onEditChannel'),
}

const bigTeamPreviewProps = {
  ...bigTeamCommonProps,
  isPreview: true,
  channelname: 'somechannel',
  smallTeam: false,
  admin: false,

  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  onJoinChannel: Sb.action('onJoinChannel'),
}

const bigTeamNoPreviewProps = {
  ...bigTeamCommonProps,
  isPreview: false,
  channelname: 'somechannel',
  smallTeam: false,
  admin: false,

  onLeaveConversation: Sb.action('onLeaveConversation'),
  onJoinChannel: Sb.unexpected('onJoinChannel'),
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/InfoPanel', module)
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

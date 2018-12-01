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
  _loadTeamOperations: Sb.unexpected('_loadTeamOperations'),
  _loadTeamPolicy: Sb.action('_loadTeamPolicy'),
  _onShowDropdown: Sb.action('onShowDropdownRetentionPicker'),
  _onShowWarning: Sb.action('onShowWarningRetentionPicker'),
  _parentPath: 'mockedParentPath',
  _permissionsLoaded: true,
  canSetPolicy: true,
  containerStyle: props.containerStyle,
  dropdownStyle: props.dropdownStyle,
  entityType: props.entityType,
  isSmallTeam: props.isSmallTeam,
  isTeamWide: props.isTeamWide,
  loading: false,
  onSelect: Sb.action('onSelectRetentionPolicy'),
  policy: retentionPolicies.policyThreeMonths,
  setRetentinPolicy: Sb.action('setRetentionPolicy'),
  teamPolicy: retentionPolicies.policyMonth,
  type: props.type,
})

const provider = Sb.createPropProviderWithCommon({
  ...Sb.PropProviders.TeamDropdownMenu(),
  InfoPanel: (props: InfoPanelProps) => props,
  LifecycleNotifications: () => notificationProps,
  MinWriterRole: () => minWriterRoleProps,
  OnlyValidConversations: () => onlyValidConversationsProps,
  RetentionPicker: retentionPickerPropSelector,
})

const commonProps = {
  canDeleteHistory: true,
  canSetMinWriterRole: false,
  onBack: Sb.unexpected('onBack'),
  onShowProfile: (username: string) => Sb.action(`onShowProfile(${username})`),
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
  selectedConversationIDKey: Constants.noConversationIDKey,
}

const conversationProps = {
  ...commonProps,
  admin: false,
  canEditChannel: true,
  canSetRetention: false,
  channelname: null,
  description: "You shouldn't be seeing this",
  isPreview: false,
  onEditChannel: Sb.unexpected('onEditChannel'),
  onJoinChannel: Sb.unexpected('onJoinChannel'),

  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  onShowBlockConversationDialog: Sb.action('onShowBlockConversationDialog'),
  onShowClearConversationDialog: Sb.action('onShowClearConversationDialog'),

  onShowNewTeamDialog: Sb.action('onShowNewTeamDialog'),
  smallTeam: false,
  teamname: null,
}

const teamCommonProps = {
  ...commonProps,
  canEditChannel: true,
  canSetRetention: true,
  channelname: 'somechannel',
  onShowBlockConversationDialog: Sb.unexpected('onShowBlockConversationDialog'),

  onShowClearConversationDialog: Sb.unexpected('onShowClearConversationDialog'),
  onShowNewTeamDialog: Sb.unexpected('onShowNewTeamDialog'),
  teamname: 'someteam',
}

const smallTeamProps = {
  ...teamCommonProps,
  admin: false,
  description: "You shouldn't be seeing this",
  isPreview: false,
  onEditChannel: Sb.unexpected('onEditChannel'),

  onJoinChannel: Sb.unexpected('onJoinChannel'),
  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  smallTeam: true,
}

const bigTeamCommonProps = {
  ...teamCommonProps,
  admin: false,
  description: 'The best channel',
  onEditChannel: Sb.action('onEditChannel'),
  smallTeam: false,
}

const bigTeamPreviewProps = {
  ...bigTeamCommonProps,
  admin: false,
  channelname: 'somechannel',
  isPreview: true,
  onJoinChannel: Sb.action('onJoinChannel'),

  onLeaveConversation: Sb.unexpected('onLeaveConversation'),
  smallTeam: false,
}

const bigTeamNoPreviewProps = {
  ...bigTeamCommonProps,
  admin: false,
  channelname: 'somechannel',
  isPreview: false,
  onJoinChannel: Sb.unexpected('onJoinChannel'),

  onLeaveConversation: Sb.action('onLeaveConversation'),
  smallTeam: false,
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

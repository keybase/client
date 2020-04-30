import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Sb from '../../stories/storybook'
import Chat from '.'
import {Box} from '../../common-adapters/index'

const actions = {
  onContactSettingsSave: () => Sb.action('onContactSettingsSave'),
  onRefresh: Sb.action('onRefresh'),
  onToggle: Sb.action('onToggle'),
  onToggleSound: Sb.action('onToggleSound'),
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => {
    Sb.action('onUnfurlSave')(mode, whitelist)
  },
}

const teamMeta = [
  Constants.makeTeamMeta({
    id: 'openteam1',
    isMember: true,
    isOpen: true,
    teamname: 'openteam1',
  }),
  Constants.makeTeamMeta({
    id: 'closedteam1',
    teamname: 'closedteam1',
  }),
  Constants.makeTeamMeta({
    id: 'closedteam2',
    teamname: 'closedteam2',
  }),
  Constants.makeTeamMeta({
    id: 'closedteam3',
    teamname: 'closedteam3',
  }),
]

const props = {
  allowEdit: true,
  contactSettingsEnabled: false,
  contactSettingsError: '',
  contactSettingsIndirectFollowees: false,
  contactSettingsSelectedTeams: {
    closedteam1: true,
    closedteam2: true,
    closedteam3: true,
    openteam1: false,
  },
  contactSettingsTeamsEnabled: false,
  groups: new Map([
    [
      'security',
      {
        settings: [
          {
            description: 'Show message content in phone chat notifications',
            name: 'plaintextmobile',
            subscribed: true,
          },
          {
            description: 'Show message content in computer chat notifications',
            name: 'plaintextdesktop',
            subscribed: true,
          },
          {
            description: "Show others when you're typing",
            name: 'disabletyping',
            subscribed: true,
          },
        ],
        unsub: false,
      },
    ],
  ]),
  sound: false,
  teamMeta,
  unfurlMode: RPCChatTypes.UnfurlMode.whitelisted,
  unfurlWhitelist: [
    'amazon.com',
    'wsj.com',
    'nytimes.com',
    'keybase.io',
    'google.com',
    'twitter.com',
    'keyba.se',
    'microsoft.com',
  ],
  ...actions,
}

const errorProps = {
  ...props,
  contactSettingsError: 'Unable to save contact settings, please try again.',
  unfurlError: 'Unable to save link preview settings, please try again.',
}

const loadErrorProps = {
  allowEdit: false,
  contactSettingsEnabled: false,
  contactSettingsError: 'Unable to load contact settings, please try again.',
  contactSettingsIndirectFollowees: false,
  contactSettingsSelectedTeams: {},
  contactSettingsTeamsEnabled: false,
  groups: new Map(),
  sound: false,
  teamMeta: [],
  unfurlError: 'Unable to load link preview settings, please try again.',
  ...actions,
}

const load = () => {
  Sb.storiesOf('Settings/Chat', module)
    .addDecorator(story => <Box style={{padding: 5}}>{story()}</Box>)
    .add('Default', () => <Chat {...props} />)
    .add('Contact restrictions: Enabled', () => <Chat {...props} contactSettingsEnabled={true} />)
    .add('Contact restrictions: Followees', () => (
      <Chat {...props} contactSettingsEnabled={true} contactSettingsIndirectFollowees={true} />
    ))
    .add('Contact restrictions: Teams', () => (
      <Chat {...props} contactSettingsEnabled={true} contactSettingsTeamsEnabled={true} />
    ))
    .add('Contact restrictions: Followees and Teams', () => (
      <Chat
        {...props}
        contactSettingsEnabled={true}
        contactSettingsIndirectFollowees={true}
        contactSettingsTeamsEnabled={true}
      />
    ))
    .add('Default', () => <Chat {...props} />)
    .add('Error', () => <Chat {...errorProps} />)
    .add('Load Error', () => <Chat {...loadErrorProps} />)
}

export default load

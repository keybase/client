import * as React from 'react'
import {Box} from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import * as Constants from '../../../constants/teams'
import {globalStyles} from '../../../styles'
import {Settings} from '.'
import ChannelPopup from './channel-popup'
import {fakeTeamID, store} from '../../stories'

const commonProps = {
  canShowcase: true,
  ignoreAccessRequests: true,
  isBigTeam: true,
  loadWelcomeMessage: Sb.action('loadWelcomeMessage'),
  onEditWelcomeMessage: Sb.action('onEditWelcomeMessage'),
  openTeam: true,
  openTeamRole: 'admin' as 'admin',
  publicityAnyMember: true,
  publicityMember: true,
  publicityTeam: true,
  savePublicity: Sb.action('savePublicity'),
  showOpenTeamWarning: Sb.action('showOpenTeamWarning'),
  teamID: '1234',
  teamname: 'myteam',
  waitingForWelcomeMessage: false,
  welcomeMessage: {display: '', raw: '', set: false},
  yourOperations: {
    changeOpenTeam: true,
    changeTarsDisabled: true,
    chat: true,
    createChannel: true,
    deleteChannel: true,
    deleteChatHistory: true,
    deleteOtherEmojis: true,
    deleteOtherMessages: true,
    deleteTeam: true,
    editChannelDescription: true,
    editTeamDescription: true,
    joinTeam: true,
    leaveTeam: true,
    listFirst: true,
    manageBots: true,
    manageEmojis: true,
    manageMembers: true,
    manageSubteams: true,
    pinMessage: true,
    renameChannel: true,
    renameTeam: true,
    setMemberShowcase: true,
    setMinWriterRole: true,
    setPublicityAny: true,
    setRetentionPolicy: true,
    setTeamShowcase: true,
  },
}

const provider = Sb.createPropProviderWithCommon({
  RetentionPicker: () => ({
    // TODO: Add this to RetentionPicker's props, or remove the need
    // for these.
    _loadTeamOperations: Sb.action('_loadTeamOperations'),
    _loadTeamPolicy: Sb.action('_loadTeamPolicy'),
    _onShowWarning: Sb.action('_onShowWarning'),

    canSetPolicy: true,
    loading: false,
    onSelect: Sb.action('onSelect'),
    onShowWarning: Sb.action('onShowWarning'),
    policy: Constants.makeRetentionPolicy({type: 'retain'}),
    saveRetentionPolicy: Sb.action('saveRetentionPolicy'),
    showInheritOption: false,
    showOverrideNotice: true,
    showSaveIndicator: true,
    type: 'auto',
  }),
})

const channelPopupProps = {
  onCancel: Sb.action('onCancel'),
  onComplete: Sb.action('onComplete'),
  teamID: fakeTeamID,
}

const load = () => {
  Sb.storiesOf('Teams/Settings', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Everything', () => <Settings {...commonProps} />)

  Sb.storiesOf('Teams/Settings', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Channel popup', () => <ChannelPopup {...channelPopupProps} />)
    .add('Channel popup w/disabled', () => (
      <ChannelPopup
        {...channelPopupProps}
        disabledChannels={[
          {channelname: 'hellos', conversationIDKey: '2'},
          {channelname: 'soups', conversationIDKey: '5'},
          {channelname: 'team-sqawk', conversationIDKey: '11'},
        ]}
      />
    ))
}

export default load

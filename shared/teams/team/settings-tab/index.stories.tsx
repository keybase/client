import * as React from 'react'
import {Box} from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import {globalStyles} from '../../../styles'
import {Settings} from '.'
import ChannelPopup from './channel-popup'

const commonProps = {
  canShowcase: true,
  ignoreAccessRequests: true,
  isBigTeam: true,
  loadWelcomeMessage: Sb.action('loadWelcomeMessage'),
  openTeam: true,
  openTeamRole: 'admin' as 'admin',
  publicityAnyMember: true,
  publicityMember: true,
  publicityTeam: true,
  savePublicity: Sb.action('savePublicity'),
  teamID: '1234',
  teamname: 'myteam',
  waitingForSavePublicity: false,
  waitingForWelcomeMessage: false,
  welcomeMessage: {set: false, text: ''},
  yourOperations: {
    changeOpenTeam: true,
    changeTarsDisabled: true,
    chat: true,
    createChannel: true,
    deleteChannel: true,
    deleteChatHistory: true,
    deleteOtherMessages: true,
    deleteTeam: true,
    editChannelDescription: true,
    editTeamDescription: true,
    joinTeam: true,
    leaveTeam: true,
    listFirst: true,
    manageBots: true,
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

const fakeTeamID = 'fakeTeamID'
const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...draftState.teams,
    teamIDToChannelInfos: new Map([
      [
        fakeTeamID,
        new Map([
          ['1', {...Constants.initialChannelInfo, channelname: 'random'}],
          ['2', {...Constants.initialChannelInfo, channelname: 'hellos'}],
          ['3', {...Constants.initialChannelInfo, channelname: 'NY_MemorialDay'}],
          ['4', {...Constants.initialChannelInfo, channelname: 'sandwiches'}],
          ['5', {...Constants.initialChannelInfo, channelname: 'soups'}],
          ['6', {...Constants.initialChannelInfo, channelname: 'stir-fry'}],
          ['7', {...Constants.initialChannelInfo, channelname: 'ice-cream'}],
          ['8', {...Constants.initialChannelInfo, channelname: 'salad'}],
          ['9', {...Constants.initialChannelInfo, channelname: 'veg'}],
          ['10', {...Constants.initialChannelInfo, channelname: 'plate-presentation'}],
          ['11', {...Constants.initialChannelInfo, channelname: 'team-sqawk'}],
          ['12', {...Constants.initialChannelInfo, channelname: 'team-birbs'}],
          ['13', {...Constants.initialChannelInfo, channelname: 'team-beasts'}],
          ['14', {...Constants.initialChannelInfo, channelname: 'team-dogs-of-the-sea-and-other-creatures'}],
        ]),
      ],
    ]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
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
      <ChannelPopup {...channelPopupProps} disabledChannels={['hellos', 'soups', 'team-sqawk']} />
    ))
}

export default load

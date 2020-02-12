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
  openTeam: true,
  openTeamRole: 'admin' as 'admin',
  publicityAnyMember: true,
  publicityMember: true,
  publicityTeam: true,
  savePublicity: Sb.action('savePublicity'),
  teamID: '1234',
  teamname: 'myteam',
  waitingForSavePublicity: false,
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
          ['1', {...Constants.initialChannelInfo, channelname: 'Aab'}],
          ['2', {...Constants.initialChannelInfo, channelname: 'NSFW'}],
          ['3', {...Constants.initialChannelInfo, channelname: 'NY_MemorialDay'}],
          ['4', {...Constants.initialChannelInfo, channelname: 'airdrop'}],
          ['5', {...Constants.initialChannelInfo, channelname: 'android'}],
          ['6', {...Constants.initialChannelInfo, channelname: 'android-notifications'}],
          ['7', {...Constants.initialChannelInfo, channelname: 'autoresets'}],
          ['8', {...Constants.initialChannelInfo, channelname: 'frontend'}],
          ['9', {...Constants.initialChannelInfo, channelname: 'core'}],
          ['10', {...Constants.initialChannelInfo, channelname: 'design'}],
          ['11', {...Constants.initialChannelInfo, channelname: 'squad-sqawk'}],
          ['12', {...Constants.initialChannelInfo, channelname: 'squad-birbs'}],
          ['13', {...Constants.initialChannelInfo, channelname: 'squad-beasts'}],
          ['14', {...Constants.initialChannelInfo, channelname: 'squad-dogs-of-the-sea-and-other-creatures'}],
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
}

export default load

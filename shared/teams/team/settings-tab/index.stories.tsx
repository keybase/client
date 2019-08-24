import * as React from 'react'
import {Box} from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import {makeRetentionPolicy} from '../../../constants/teams'
import {globalStyles} from '../../../styles'
import {Settings} from './'

const commonProps = {
  ignoreAccessRequests: true,
  isBigTeam: true,
  openTeam: true,
  openTeamRole: 'admin' as 'admin',
  publicityAnyMember: true,
  publicityMember: true,
  publicityTeam: true,
  savePublicity: Sb.action('savePublicity'),
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
    manageMembers: true,
    manageSubteams: true,
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
    policy: makeRetentionPolicy({type: 'retain'}),
    saveRetentionPolicy: Sb.action('saveRetentionPolicy'),
    showInheritOption: false,
    showOverrideNotice: true,
    showSaveIndicator: true,
    type: 'auto',
  }),
})

const load = () => {
  Sb.storiesOf('Teams/Settings', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Everything', () => <Settings {...commonProps} />)
}

export default load

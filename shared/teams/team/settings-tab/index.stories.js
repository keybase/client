// @flow
import * as React from 'react'
import {Box} from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import {makeRetentionPolicy} from '../../../constants/teams'
import {globalStyles} from '../../../styles'
import {Settings} from './'

const commonProps = {
  isBigTeam: true,
  ignoreAccessRequests: true,
  publicityAnyMember: true,
  publicityMember: true,
  publicityTeam: true,
  openTeam: true,
  openTeamRole: 'admin',
  savePublicity: Sb.action('savePublicity'),
  setOpenTeamRole: Sb.action('setOpenTeamRole'),
  teamname: 'myteam',
  yourOperations: {
    manageMembers: true,
    manageSubteams: true,
    createChannel: true,
    chat: true,
    deleteChannel: true,
    renameChannel: true,
    editChannelDescription: true,
    setTeamShowcase: true,
    setMemberShowcase: true,
    setRetentionPolicy: true,
    setMinWriterRole: true,
    changeOpenTeam: true,
    leaveTeam: true,
    joinTeam: true,
    setPublicityAny: true,
    listFirst: true,
    changeTarsDisabled: true,
    deleteChatHistory: true,
  },
  waitingForSavePublicity: false,
}

const provider = Sb.createPropProviderWithCommon({
  RetentionPicker: () => ({
    // TODO: Add this to RetentionPicker's props, or remove the need
    // for these.
    _loadTeamPolicy: Sb.action('_loadTeamPolicy'),
    _loadTeamOperations: Sb.action('_loadTeamOperations'),
    _onShowWarning: Sb.action('_onShowWarning'),

    canSetPolicy: true,
    policy: makeRetentionPolicy({type: 'retain'}),
    loading: false,
    showInheritOption: false,
    showOverrideNotice: true,
    showSaveIndicator: true,
    type: 'auto',
    saveRetentionPolicy: Sb.action('saveRetentionPolicy'),
    onSelect: Sb.action('onSelect'),
    onShowWarning: Sb.action('onShowWarning'),
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

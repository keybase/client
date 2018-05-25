// @flow
import * as React from 'react'
import {Box} from '../../../common-adapters'
import {action, storiesOf, createPropProvider} from '../../../stories/storybook'
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
  savePublicity: action('savePublicity'),
  setOpenTeamRole: action('setOpenTeamRole'),
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

const provider = createPropProvider({
  RetentionPicker: () => ({
    _loadTeamPolicy: action('_loadTeamPolicy'),
    _loadTeamOperations: action('_loadTeamOperations'),
    _onShowWarning: action('_onShowWarning'),

    canSetPolicy: true,
    policy: makeRetentionPolicy({type: 'retain'}),
    loading: false,
    showInheritOption: false,
    showOverrideNotice: true,
    showSaveIndicator: true,
    type: 'auto',
    saveRetentionPolicy: action('saveRetentionPolicy'),
    onSelect: action('onSelect'),
    onShowWarning: action('onShowWarning'),
  }),
})

const load = () => {
  storiesOf('Teams/Settings', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Everything', () => <Settings {...commonProps} />)
}

export default load

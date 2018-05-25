// @flow
import * as React from 'react'
import {Box} from '../../../common-adapters'
import {action, storiesOf} from '../../../stories/storybook'
import {globalStyles} from '../../../styles'
import {Settings} from './'

const commonProps = {
  isBigTeam: false,
  ignoreAccessRequests: false,
  publicityAnyMember: false,
  publicityMember: false,
  publicityTeam: false,
  openTeam: false,
  openTeamRole: 'admin',
  savePublicity: action('savePublicity'),
  setOpenTeamRole: action('setOpenTeamRole'),
  teamname: 'myteam',
  yourOperations: {
    manageMembers: false,
    manageSubteams: false,
    createChannel: false,
    chat: false,
    deleteChannel: false,
    renameChannel: false,
    editChannelDescription: false,
    setTeamShowcase: false,
    setMemberShowcase: false,
    setRetentionPolicy: false,
    changeOpenTeam: false,
    leaveTeam: false,
    joinTeam: false,
    setPublicityAny: false,
    listFirst: false,
    changeTarsDisabled: false,
    deleteChatHistory: false,
  },
  waitingForSavePublicity: false,
}

const load = () => {
  storiesOf('Teams/Settings', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Settings', () => <Settings {...commonProps} />)
}

export default load

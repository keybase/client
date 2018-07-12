// @flow
import * as React from 'react'
import {action, storiesOf} from '../../../stories/storybook'
import TeamTabs from '.'

const yourOperations = {
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
}

const commonProps = {
  admin: false,
  loading: false,
  memberCount: 12,
  newTeamRequests: ['Cool Team 😎'],
  numInvites: 5,
  numRequests: 0,
  numSubteams: 0,
  resetUserCount: 0,
  selectedTab: 'members',
  setSelectedTab: action('setSelectedTab'),
  teamname: 'Cool Team 😎',
  yourOperations,
}

const load = () => {
  storiesOf('Teams/Tabs', module)
    .add('Standard', () => <TeamTabs {...commonProps} />)
    .add('Loading', () => <TeamTabs {...commonProps} loading={true} />)
    .add('Admin', () => <TeamTabs {...commonProps} admin={true} />)
    .add('User can Manage Subteams', () => (
      <TeamTabs {...commonProps} yourOperations={{...yourOperations, manageSubteams: true}} />
    ))
    .add('Has Subteams', () => <TeamTabs {...commonProps} numSubteams={3} />)
    .add('Has reset users', () => <TeamTabs {...commonProps} resetUserCount={7} />)
    .add('Has team requests', () => <TeamTabs {...commonProps} admin={true} numRequests={4} />)
}

export default load

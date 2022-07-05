import * as React from 'react'
import {action, storiesOf} from '../../../stories/storybook'
import TeamTabs from '.'

const commonProps = {
  admin: false,
  isBig: true,
  loadBots: action('loadBots'),
  loading: false,
  memberCount: 12,
  newRequests: 1,
  numInvites: 5,
  numRequests: 0,
  numSubteams: 0,
  resetUserCount: 0,
  selectedTab: 'members' as const,
  setSelectedTab: action('setSelectedTab'),
  showSubteams: false,
  teamID: 'Cool Team 😎 ID',
}

const load = () => {
  storiesOf('Teams/Tabs', module)
    .add('Standard', () => <TeamTabs {...commonProps} />)
    .add('Loading', () => <TeamTabs {...commonProps} loading={true} />)
    .add('Admin', () => <TeamTabs {...commonProps} admin={true} />)
    .add('User can Manage Subteams', () => <TeamTabs {...commonProps} showSubteams={true} />)
    .add('Has Subteams, no channels', () => <TeamTabs {...commonProps} numSubteams={3} isBig={false} />)
    .add('Has reset users', () => <TeamTabs {...commonProps} resetUserCount={7} />)
    .add('Has team requests', () => <TeamTabs {...commonProps} admin={true} numRequests={4} />)
}

export default load

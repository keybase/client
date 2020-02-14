import * as React from 'react'
import {action, storiesOf} from '../../../stories/storybook'
import ChannelTabs from '.'

const commonProps = {
  admin: false,
  loadBots: action('loadBots'),
  loading: false,
  memberCount: 12,
  selectedTab: 'members',
  setSelectedTab: action('setSelectedTab'),
  teamID: 'Cool Team 😎 ID',
}

const load = () => {
  storiesOf('Channels/Tabs', module)
    .add('Standard', () => <ChannelTabs {...commonProps} />)
    .add('Loading', () => <ChannelTabs {...commonProps} loading={true} />)
    .add('Admin', () => <ChannelTabs {...commonProps} admin={true} />)
}

export default load

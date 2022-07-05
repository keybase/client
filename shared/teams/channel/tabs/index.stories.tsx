import * as React from 'react'
import {action, storiesOf, updateStoreDecorator} from '../../../stories/storybook'
import ChannelTabs from '.'
import {store, fakeTeamIDs} from '../../stories'

const commonProps = {
  admin: false,
  conversationIDKey: '5',
  selectedTab: 'members' as const,
  setSelectedTab: action('setSelectedTab'),
}

const load = () => {
  storiesOf('Channels/Tabs', module)
    .addDecorator(updateStoreDecorator(store, () => {}))
    .add('Standard', () => <ChannelTabs {...commonProps} teamID={fakeTeamIDs[0]} />)
    .add('Loading', () => <ChannelTabs {...commonProps} teamID={fakeTeamIDs[1]} />)
    .add('Admin', () => <ChannelTabs {...commonProps} teamID={fakeTeamIDs[2]} admin={true} />)
}

export default load

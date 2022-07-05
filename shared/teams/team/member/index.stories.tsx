import React from 'react'
import * as Sb from '../../../stories/storybook'
import {default as TeamMember, TeamMemberHeader} from './index.new'
import AddToChannels from './add-to-channels'
import {fakeTeamID, store} from '../../stories'

const addToChannelsProps = Sb.createNavigator({teamID: fakeTeamID, usernames: ['andonuts']})
const addToChannelsSelfProps = Sb.createNavigator({teamID: fakeTeamID})

const load = () =>
  Sb.storiesOf('Teams/Member', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Header normal', () => <TeamMemberHeader teamID={fakeTeamID} username="jeff" />)
    .add('Header long name', () => <TeamMemberHeader teamID={fakeTeamID} username="paula" />)
    .add('Header self + no name', () => <TeamMemberHeader teamID={fakeTeamID} username="andonuts" />)
    .add('Rows', () => <TeamMember {...Sb.createNavigator({teamID: fakeTeamID, username: 'alice'})} />)
    .add('Add to channels', () => <AddToChannels {...addToChannelsProps} />)
    .add('Add self to channels', () => <AddToChannels {...addToChannelsSelfProps} />)

export default load

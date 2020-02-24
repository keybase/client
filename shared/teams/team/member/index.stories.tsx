import React from 'react'
import * as Sb from '../../../stories/storybook'
import {TeamMemberHeader} from './index.new'
import {fakeTeamID, store} from '../../stories'

const load = () =>
  Sb.storiesOf('Teams/Member', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Header normal', () => <TeamMemberHeader teamID={fakeTeamID} username="jeff" />)
    .add('Header long name', () => <TeamMemberHeader teamID={fakeTeamID} username="paula" />)
    .add('Header self + no name', () => <TeamMemberHeader teamID={fakeTeamID} username="andonuts" />)

export default load

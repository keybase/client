import React from 'react'
import * as Sb from '../../stories/storybook'
import JoinTeamFromInvite from './join-from-invite'
import {fakeTeamID, store} from '../stories'

const props = {link: ['invite', 'secrettoken']}

const load = () =>
  Sb.storiesOf('Teams/Invite Links', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Join team from invite', () => <JoinTeamFromInvite {...Sb.createNavigator(props)} />)

export default load

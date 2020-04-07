import React from 'react'
import * as Sb from '../../stories/storybook'
import JoinTeamFromInvite from './join-from-invite'
import {store} from '../stories'

const props = Sb.createNavigator({
  details: {
    inviterUsername: 'adamjspooner',
    teamDesc:
      'A team for fans of Game of Thrones. This is to show the max-width on the team description (460px). Ellipsis after three lines of description. This is a third line blah blah blah blah blah blah blah blah blah blah. This is a third line blah blah blah blah blah blah blah blah blah blah. This is a third line blah blah blah blah blah blah blah blah blah blah.',
    teamIsOpen: true,
    teamName: 'gameofthrones',
    teamNumMembers: 1023,
  },
})

const load = () =>
  Sb.storiesOf('Teams/Invite Links', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Join team from invite', () => <JoinTeamFromInvite {...props} />)

export default load

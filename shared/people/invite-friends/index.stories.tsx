import * as React from 'react'
import * as Sb from '../../stories/storybook'
import InviteFriends from '.'

const load = () => {
  Sb.storiesOf('Invite friends', module).add('Modal', () => <InviteFriends />)
}

export default load

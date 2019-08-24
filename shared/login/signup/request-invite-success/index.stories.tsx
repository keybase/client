import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import RequestInviteSuccess from '.'

const load = () => {
  Sb.storiesOf('Signup', module).add('Request Invite Success', () => (
    <RequestInviteSuccess onBack={Sb.action('onBack')} />
  ))
}

export default load

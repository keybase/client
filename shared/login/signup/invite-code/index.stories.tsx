import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import InviteCode from '.'

const props = {
  error: '',
  onBack: Sb.action('onBack'),
  onRequestInvite: Sb.action('onRequestInvite'),
  onSubmit: Sb.action('onInviteCodeSubmit'),
}

const load = () => {
  Sb.storiesOf('Signup/Invite Code', module)
    .add('Start', () => <InviteCode {...props} />)
    .add('Code', () => <InviteCode {...props} />)
    .add('Error', () => <InviteCode {...props} error="This is an error" />)
}

export default load

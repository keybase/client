// @flow
import * as React from 'react'
import InviteCode from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  inviteCodeErrorText: undefined,
  onBack: action('onBack'),
  onRequestInvite: action('onRequestInvite'),
  onSubmit: action('onInviteCodeSubmit'),
}

const load = () => {
  storiesOf('Signup/Invite Code', module)
    .add('Start', () => <InviteCode {...props} />)
    .add('Code', () => <InviteCode {...props} />)
    .add('Error', () => <InviteCode {...props} inviteCodeErrorText={'This is an error'} />)
}

export default load

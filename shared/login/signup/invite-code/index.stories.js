// @flow
import * as React from 'react'
import InviteCode from '.'
import {action, storiesOf} from '../../../stories/storybook'

const props = {
  inviteCode: undefined,
  inviteCodeErrorText: undefined,
  onBack: action('onBack'),
  onInviteCodeSubmit: action('onInviteCodeSubmit'),
  onRequestInvite: action('onRequestInvite'),
  waiting: false,
}

const load = () => {
  storiesOf('Signup/Invite Code', module)
    .add('Start', () => <InviteCode {...props} />)
    .add('Code', () => <InviteCode {...props} inviteCode={'Code Entered'} />)
    .add('Waiting', () => <InviteCode {...props} inviteCode={'Code Entered'} waiting={true} />)
    .add('Error', () => (
      <InviteCode {...props} inviteCode={'Code Entered'} inviteCodeErrorText={'This is an error'} />
    ))
}

export default load

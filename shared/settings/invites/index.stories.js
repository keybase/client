// @flow
import * as React from 'react'
import Invites from '.'
import {action, storiesOf} from '../../stories/storybook'

const props = {
  acceptedInvites: [
    {
      created: 1469565223,
      currentlyFollowing: false,
      fullname: 'Chris Coyne',
      id: '223456',
      trackerState: 'normal',
      uid: 1,
      username: 'chris',
    },
    {
      created: 1469566223,
      currentlyFollowing: true,
      fullname: 'Cécile Boucheron',
      id: '223457',
      trackerState: 'normal',
      uid: 2,
      username: 'cecileb',
    },
    {
      created: 1469567223,
      currentlyFollowing: false,
      fullname: 'Max Goodman',
      id: '223458',
      trackerState: 'error',
      uid: 3,
      username: 'chromakode',
    },
  ],
  error: null,
  inviteEmail: 'tcook@apple.com',
  inviteMessage: 'Hey Tim! I heard you like end-to-end encryption...',
  onClearError: action('onClearError'),
  onGenerateInvitation: action('onGenerateInvitation'),
  onReclaimInvitation: action('onReclaimInvitation'),
  onRefresh: action('onRefresh'),
  onSelectPendingInvite: action('onSelectPendingInvite'),
  onSelectUser: action('onSelectUser'),
  pendingInvites: [
    {created: 1469565223, email: 'tcook@apple.com', id: '123456', url: 'keybase.io/inv/9999999999'},
    {created: 1469566223, email: '', id: '123457', url: 'keybase.io/inv/9999999999'},
  ],
  showMessageField: true,
  waitingForResponse: false,
}

const load = () => {
  storiesOf('Settings/Invites', module)
    .add('Empty', () => (
      <Invites
        {...props}
        inviteEmail={''}
        inviteMessage={''}
        showMessageField={false}
        pendingInvites={[]}
        acceptedInvites={[]}
      />
    ))
    .add('Empty message', () => <Invites {...props} inviteMessage={''} />)
    .add('Normal', () => <Invites {...props} />)
    .add('Error', () => (
      <Invites {...props} error={new Error('Oops, you entered an invalid email address')} />
    ))
}

export default load

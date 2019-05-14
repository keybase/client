// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import type {Props as ContactRowProps, OwnProps as ContactRowOwnProps} from './email-phone-row'
import AccountSettings from '.'

const props = {
  contactKeys: [],
  hasPassword: false,
  onAddEmail: Sb.action('onAddEmail'),
  onAddPhone: Sb.action('onAddPhone'),
  onDeleteAccount: Sb.action('onDeleteAccount'),
  onSetPassword: Sb.action('onSetPassword'),
}

const contacts = {
  a: {address: 'cecile@keyba.se', subtitle: '', unverified: false},
  b: {address: 'cecile@keyba.se', subtitle: 'Not searchable', unverified: false},
  c: {address: 'cecile@keyba.se', subtitle: 'Primary email • Not searchable', unverified: false},
  d: {address: 'cecile@keyba.se', subtitle: 'Primary email', unverified: true},
  e: {address: 'cecile@keyba.se', subtitle: 'Check your inbox', unverified: true},
  f: {address: '+33 6 76 38 86 97', subtitle: '', unverified: false},
  g: {address: '+33 6 76 38 86 97', subtitle: 'Not searchable', unverified: false},
  h: {address: '+33 6 76 38 86 97', subtitle: '', unverified: true},
}

const provider = Sb.createPropProvider({
  ConnectedEmailPhoneRow: ({contactKey}: ContactRowOwnProps): ContactRowProps => contacts[contactKey],
})

const load = () => {
  Sb.storiesOf('Settings/Account', module)
    .addDecorator(provider)
    .add('Empty', () => <AccountSettings {...props} />)
    .add('With password', () => <AccountSettings {...props} hasPassword={true} />)
    .add('With email/phone', () => <AccountSettings {...props} contactKeys={Object.keys(contacts)} />)
}

export default load

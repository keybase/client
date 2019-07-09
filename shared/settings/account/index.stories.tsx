import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Props as ContactRowProps, OwnProps as ContactRowOwnProps} from './email-phone-row'
import AccountSettings from '.'
import {ConfirmDeleteAddress} from './confirm-delete'
import * as I from 'immutable'

const props = {
  addedEmail: null,
  contactKeys: I.List(),
  hasPassword: false,
  onAddEmail: Sb.action('onAddEmail'),
  onAddPhone: Sb.action('onAddPhone'),
  onClearAddedEmail: Sb.action('onClearAddedEmail'),
  onDeleteAccount: Sb.action('onDeleteAccount'),
  onManageContacts: Sb.action('onManageContacts'),
  onReload: Sb.action('onReload'),
  onSetPassword: Sb.action('onSetPassword'),
  waiting: false,
}

const cc = {
  onDelete: Sb.action('onDelete'),
  onMakePrimary: Sb.action('onMakePrimary'),
  onToggleSearchable: Sb.action('onToggleSearchable'),
  onVerify: Sb.action('onVerify'),
}
// prettier-ignore
const contacts: {
  [K in string]: ContactRowProps;
} = {
  a: {...cc, address: 'cecile@keyba.se', primary: false, searchable: true, type: 'email', verified: true},
  b: {...cc, address: 'cecile@keyba.se', primary: false, searchable: false, type: 'email', verified: true},
  c: {...cc, address: 'cecile@keyba.se', primary: true, searchable: false, type: 'email', verified: true},
  d: {...cc, address: 'cecile@keyba.se', primary: true, searchable: true, type: 'email', verified: false},
  e: {...cc, address: 'cecile@keyba.se', primary: false, searchable: true, type: 'email', verified: false},
  f: {...cc, address: '+33 6 76 38 86 97', primary: false, searchable: true, type: 'phone', verified: true},
  g: {...cc, address: '+33 6 76 38 86 97', primary: false, searchable: false, type: 'phone', verified: true},
  h: {...cc, address: '+33 6 76 38 86 97', primary: false, searchable: true, type: 'phone', verified: false},
}

const confirmDeleteProps = {
  onCancel: Sb.action('onCancel'),
  onConfirm: Sb.action('onConfirm'),
}

const provider = Sb.createPropProviderWithCommon({
  ConnectedEmailPhoneRow: ({contactKey}: ContactRowOwnProps) => contacts[contactKey],
})

const load = () => {
  Sb.storiesOf('Settings/Account', module)
    .addDecorator(provider)
    .add('Empty', () => <AccountSettings {...props} />)
    .add('With password', () => <AccountSettings {...props} hasPassword={true} />)
    .add('With email/phone', () => <AccountSettings {...props} contactKeys={I.List(Object.keys(contacts))} />)
    .add('Confirm delete email', () => (
      <ConfirmDeleteAddress {...confirmDeleteProps} address="cecile@keyba.se" type="email" />
    ))
    .add('Confirm delete phone', () => (
      <ConfirmDeleteAddress {...confirmDeleteProps} address="+33 6 76 38 86 97" type="phone" />
    ))
}

export default load

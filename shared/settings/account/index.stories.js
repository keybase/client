// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import AccountSettings from '.'

const props = {
  hasPassword: false,
  onAddEmail: Sb.action('onAddEmail'),
  onAddPhone: Sb.action('onAddPhone'),
  onDeleteAccount: Sb.action('onDeleteAccount'),
  onSetPassword: Sb.action('onSetPassword'),
}

const load = () => {
  Sb.storiesOf('Settings/Account', module)
    .add('Empty', () => <AccountSettings {...props} />)
    .add('With password', () => <AccountSettings {...props} hasPassword={true} />)
}

export default load

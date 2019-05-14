// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import AccountSettings from '.'

const props = {
  onAddEmail: Sb.action('onAddEmail'),
  onAddPhone: Sb.action('onAddPhone'),
  onDeleteAccount: Sb.action('onDeleteAccount'),
  onSetPassword: Sb.action('onSetPassword'),
}

const load = () => {
  Sb.storiesOf('Settings/Account', module).add('Empty', () => <AccountSettings {...props} />)
}

export default load

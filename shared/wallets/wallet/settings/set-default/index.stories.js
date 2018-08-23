// @flow
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import SetDefaultAccount from '.'

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings/Popups', module).add('Confirm set as default', () => (
    <SetDefaultAccount
      accountName="Second account"
      onAccept={Sb.action('onAccept')}
      onClose={Sb.action('onClose')}
      username="cecileb"
    />
  ))
}

export default load

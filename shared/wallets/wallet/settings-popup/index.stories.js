// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import SettingsPopup from '.'
import confirmDefaultAccount from './set-default/index.stories'
import RemoveAccountDialog from './remove-account'
import ReallyRemoveDialog from './remove-account-really'

const defaultSettingsProps = {
  name: 'awesome account',
  user: 'testuser',
  isDefault: true,
  currency: 'USD ($)',
  currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
}

const secondarySettingsProps = {
  name: 'some other account',
  user: 'testuser',
  isDefault: false,
  currency: 'XLM',
  currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
}

const warningProps = {
  name: 'awesome account',
  currency: '0.00 XLM',
  keys: '2 keys',
  onDelete: Sb.action('onDelete'),
  onClose: Sb.action('onClose'),
}

const reallyProps = {
  name: 'awesome account',
  onCopyKey: Sb.action('onCopyKey'),
  onClose: Sb.action('onClose'),
}

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings', module)
    .add('Default', () => <SettingsPopup {...defaultSettingsProps} />)
    .add('Secondary', () => <SettingsPopup {...secondarySettingsProps} />)
    .add('Settings, default', () => <SettingsPopup {...defaultSettingsProps} />)
    .add('Settings, secondary', () => <SettingsPopup {...secondarySettingsProps} />)
    .add('Remove warning', () => <RemoveAccountDialog {...warningProps} />)
    .add('Really remove', () => <ReallyRemoveDialog {...reallyProps} />)
  confirmDefaultAccount()
}

export default load

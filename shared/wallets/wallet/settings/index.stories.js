// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import SettingsPopup from '.'
import confirmDefaultAccount from './set-default/index.stories'
import RemoveAccountPopup from './remove-account-popup'
import RemoveAccountAccountPopup from './really-remove-account-popup'
import * as Types from '../../../constants/types/wallets'
import * as Constants from '../../../constants/wallets'
import * as I from 'immutable'

const testCurrencies = I.List([
  {
    description: 'USD ($)',
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
  },
  {
    description: 'XLM',
    code: 'XLLM',
    symbol: 'XLM',
    name: 'Lumens',
  },
  {
    description: 'CAD ($)',
    code: 'CAD',
    symbol: '$',
    name: 'Canadian Dollar',
  },
  {
    description: 'EUR (€)',
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
  },
  {
    description: 'GBP (£)',
    code: 'GPB',
    symbol: '£',
    name: 'British Pount',
  },
]).map(c => Constants.currenciesResultToCurrencies(c))

const defaultSettingsProps = {
  accountID: Types.noAccountID,
  name: 'awesome account',
  user: 'testuser',
  isDefault: true,
  currency: testCurrencies.get(1),
  currencies: testCurrencies,
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
  refresh: () => {},
}

const secondarySettingsProps = {
  accountID: Types.noAccountID,
  name: 'some other account',
  user: 'testuser',
  isDefault: false,
  currency: testCurrencies.get(0),
  currencies: testCurrencies,
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
  refresh: () => {},
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
    .add('Remove warning', () => <RemoveAccountPopup {...warningProps} />)
    .add('Really remove', () => <RemoveAccountAccountPopup {...reallyProps} />)
  confirmDefaultAccount()
}

export default load

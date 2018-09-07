// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Settings from '.'
import popups from './popups/index.stories'
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
  onBack: Sb.action('onBack'),
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
  onBack: Sb.action('onBack'),
  refresh: () => {},
}

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings', module)
    .add('Default', () => <Settings {...defaultSettingsProps} />)
    .add('Secondary', () => <Settings {...secondarySettingsProps} />)
  popups()
}

export default load

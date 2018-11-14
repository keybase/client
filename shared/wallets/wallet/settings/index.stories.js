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

const sharedSettingsProps = {
  accountID: Types.noAccountID,
  user: 'testuser',
  currencyWaiting: false,
  currencies: testCurrencies,
  onDelete: Sb.action('onDelete'),
  onSetDefault: Sb.action('setDefault'),
  onEditName: Sb.action('onEditName'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
  onBack: Sb.action('onBack'),
  refresh: () => {},
  saveCurrencyWaiting: false,
}

const defaultSettingsProps = {
  ...sharedSettingsProps,
  name: 'awesome account',
  isDefault: true,
  currency: testCurrencies.get(1),
}

const secondarySettingsProps = {
  ...sharedSettingsProps,
  name: 'some other account',
  isDefault: false,
  currency: testCurrencies.get(0),
}

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings', module)
    .add('Default', () => <Settings {...defaultSettingsProps} />)
    .add('Secondary', () => <Settings {...secondarySettingsProps} />)
  popups()
}

export default load

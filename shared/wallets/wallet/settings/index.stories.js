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
    code: 'USD',
    description: 'USD ($)',
    name: 'US Dollar',
    symbol: '$',
  },
  {
    code: 'XLLM',
    description: 'XLM',
    name: 'Lumens',
    symbol: 'XLM',
  },
  {
    code: 'CAD',
    description: 'CAD ($)',
    name: 'Canadian Dollar',
    symbol: '$',
  },
  {
    code: 'EUR',
    description: 'EUR (€)',
    name: 'Euro',
    symbol: '€',
  },
  {
    code: 'GPB',
    description: 'GBP (£)',
    name: 'British Pount',
    symbol: '£',
  },
]).map(c => Constants.currenciesResultToCurrencies(c))

const sharedSettingsProps = {
  accountID: Types.noAccountID,
  currencies: testCurrencies,
  currencyWaiting: false,
  onBack: Sb.action('onBack'),
  onCurrencyChange: Sb.action('onCurrencyChange'),
  onDelete: Sb.action('onDelete'),
  onEditName: Sb.action('onEditName'),
  onSetDefault: Sb.action('setDefault'),
  refresh: () => {},
  saveCurrencyWaiting: false,
  user: 'testuser',
}

const defaultSettingsProps = {
  ...sharedSettingsProps,
  currency: testCurrencies.get(1),
  isDefault: true,
  name: 'awesome account',
}

const secondarySettingsProps = {
  ...sharedSettingsProps,
  currency: testCurrencies.get(0),
  isDefault: false,
  name: 'some other account',
}

const load = () => {
  Sb.storiesOf('Wallets/Wallet/Settings', module)
    .add('Default', () => <Settings {...defaultSettingsProps} />)
    .add('Secondary', () => <Settings {...secondarySettingsProps} />)
  popups()
}

export default load

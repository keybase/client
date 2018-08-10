// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box2} from '../../common-adapters'
import Header from './header'
import {SettingsPopup} from './settings-popup'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import * as I from 'immutable'

const defaultWalletMock = {
  isDefaultWallet: true,
  keybaseUser: 'cecileb',
  walletName: "cecileb's account",
}

const secondWalletMock = {
  isDefaultWallet: false,
  walletName: 'Second account',
}

const commonActions = {
  navigateAppend: Sb.action('navigateAppend'),
  onDeposit: Sb.action('onDeposit'),
  onReceive: Sb.action('onReceive'),
  onSendToAnotherWallet: Sb.action('onSendToAnotherWallet'),
  onSendToKeybaseUser: Sb.action('onSendToKeybaseUser'),
  onSendToStellarAddress: Sb.action('onSendToStellarAddress'),
  onSettings: Sb.action('onSettings'),
  onShowSecretKey: Sb.action('onShowSecretKey'),
}

const testCurrencies =I.List([
  {
    description: 'USD ($)',
    code: 'USD',
    symbol: '$' ,
    name: 'US Dollar',
  },
  {
    description: 'XLM',
    code: 'XLLM',
    symbol: 'XLM' ,
    name: 'Lumens',
  },
  {
    description: 'CAD ($)',
    code: 'CAD',
    symbol: '$' ,
    name: 'Canadian Dollar',
  },
  {
    description: 'EUR (€)',
    code: 'EUR',
    symbol: '€' ,
    name: 'Euro',
  },
  {
    description: 'GBP (£)',
    code: 'GPB',
    symbol: '£' ,
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
  refresh: () => {}
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
  refresh: () => {}
}

const load = () => {
  Sb.storiesOf('Wallets/Wallet', module)
    .add('Default wallet', () => (
      <Box2 direction="horizontal" style={styleWidth}>
        <Header {...commonActions} {...defaultWalletMock} />
      </Box2>
    ))
    .add('Second wallet', () => (
      <Box2 direction="horizontal" style={styleWidth}>
        <Header {...commonActions} {...secondWalletMock} />
      </Box2>
    ))
    .add('Settings, default', () => <SettingsPopup {...defaultSettingsProps} />)
    .add('Settings, secondary', () => <SettingsPopup {...secondarySettingsProps} />)
}

const styleWidth = {width: 520}

export default load

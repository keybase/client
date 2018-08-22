// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
// import {Box2} from '../../common-adapters'
// import Header from './header'
// import {SettingsPopup} from './settings-popup'
// import * as Types from '../../constants/types/wallets'
// import * as Constants from '../../constants/wallets'
// import * as I from 'immutable'
// import confirmDefaultAccount from './settings-popup/set-default/index.stories'

// const defaultWalletMock = {
//   isDefaultWallet: true,
//   keybaseUser: 'cecileb',
//   walletName: "cecileb's account",
// }

// const secondWalletMock = {
//   isDefaultWallet: false,
//   walletName: 'Second account',
// }

// const commonActions = {
//   navigateAppend: Sb.action('navigateAppend'),
//   onDeposit: Sb.action('onDeposit'),
//   onReceive: Sb.action('onReceive'),
//   onSendToAnotherWallet: Sb.action('onSendToAnotherWallet'),
//   onSendToKeybaseUser: Sb.action('onSendToKeybaseUser'),
//   onSendToStellarAddress: Sb.action('onSendToStellarAddress'),
//   onSettings: Sb.action('onSettings'),
//   onShowSecretKey: Sb.action('onShowSecretKey'),
// }

// const testCurrencies = I.List([
//   {
//     description: 'USD ($)',
//     code: 'USD',
//     symbol: '$',
//     name: 'US Dollar',
//   },
//   {
//     description: 'XLM',
//     code: 'XLLM',
//     symbol: 'XLM',
//     name: 'Lumens',
//   },
//   {
//     description: 'CAD ($)',
//     code: 'CAD',
//     symbol: '$',
//     name: 'Canadian Dollar',
//   },
//   {
//     description: 'EUR (€)',
//     code: 'EUR',
//     symbol: '€',
//     name: 'Euro',
//   },
//   {
//     description: 'GBP (£)',
//     code: 'GPB',
//     symbol: '£',
//     name: 'British Pount',
//   },
// ]).map(c => Constants.currenciesResultToCurrencies(c))

// const defaultSettingsProps = {
//   accountID: Types.noAccountID,
//   name: 'awesome account',
//   user: 'testuser',
//   isDefault: true,
//   currency: testCurrencies.get(1),
//   currencies: testCurrencies,
//   onDelete: Sb.action('onDelete'),
//   onSetDefault: Sb.action('setDefault'),
//   onEditName: Sb.action('onEditName'),
//   onCurrencyChange: Sb.action('onCurrencyChange'),
//   refresh: () => {},
// }

// const secondarySettingsProps = {
//   accountID: Types.noAccountID,
//   name: 'some other account',
//   user: 'testuser',
//   isDefault: false,
//   currency: testCurrencies.get(0),
//   currencies: testCurrencies,
//   onDelete: Sb.action('onDelete'),
//   onSetDefault: Sb.action('setDefault'),
//   onEditName: Sb.action('onEditName'),
//   onCurrencyChange: Sb.action('onCurrencyChange'),
//   refresh: () => {},
// }
import {stringToAccountID} from '../../constants/types/wallets'
import Wallet from '.'
import header, {Container} from './header/index.stories'
// import settingsPopup from './settings-popup/index.stories'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Header: props => ({
    onDeposit: Sb.action('onDeposit'),
    onReceive: Sb.action('onReceive'),
    onSendToAnotherAccount: Sb.action('onSendToAnotherAccount'),
    onSendToKeybaseUser: Sb.action('onSendToKeybaseUser'),
    onSendToStellarAddress: Sb.action('onSendToStellarAddress'),
    onSettings: Sb.action('onSettings'),
    onShowSecretKey: Sb.action('onShowSecretKey'),
    isDefaultWallet: true,
    keybaseUser: 'cecileb',
    walletName: "cecileb's account",
  }),
})

const props = {
  accountID: stringToAccountID('fakeAccountID'),
  navigateAppend: Sb.action('navigateAppend'),
  sections: [{title: 'Your Assets', data: []}, {title: 'History', data: ['historyPlaceholder']}],
}

const load = () => {
  header()
  // settingsPopup()
  Sb.storiesOf('Wallets/Wallet', module)
    .addDecorator(provider)
    .addDecorator(Container)
    .add('Default', () => <Wallet {...props} />)
}

export default load

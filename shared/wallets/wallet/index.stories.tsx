import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {stringToAccountID} from '../../constants/types/wallets'
import Wallet from '.'
import header, {Container} from './header/index.stories'
import settings from './settings/index.stories'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Header: () => ({
    accountID: stringToAccountID('fakeAccountID'),
    isDefaultWallet: true,
    keybaseUser: 'cecileb',
    onReceive: Sb.action('onReceive'),
    walletName: "cecileb's account",
  }),
  WalletDropdownButton: props => ({
    disabled: false,
    onSettings: Sb.action('onSettings'),
    onShowSecretKey: Sb.action('onShowSecretKey'),
    small: props.small,
  }),
  WalletSendButton: props => ({
    disabled: false,
    onSendToAnotherAccount: Sb.action('onSendToAnotherAccount'),
    onSendToKeybaseUser: Sb.action('onSendToKeybaseUser'),
    onSendToStellarAddress: Sb.action('onSendToStellarAddress'),
    small: props.small,
    thisDeviceIsLockedOut: false,
  }),
})

const props = {
  acceptedDisclaimer: true,
  accountID: stringToAccountID('fakeAccountID'),
  loadingMore: false,
  navigateAppend: Sb.action('navigateAppend'),
  onBack: Sb.action('onBack'),
  onLoadMore: Sb.action('onLoadMore'),
  onMarkAsRead: Sb.action('onMarkRead'),
  refresh: Sb.action('refresh'),
  sections: [
    {data: [], kind: 'assets', title: 'Your assets'},
    {data: ['noPayments'], kind: 'payments', title: 'History'},
  ],
}

const load = () => {
  header()
  settings()
  Sb.storiesOf('Wallets/Wallet', module)
    .addDecorator(provider)
    .addDecorator(Container)
    .add('Default', () => <Wallet {...props} />)
}

export default load

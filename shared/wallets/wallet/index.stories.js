// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {stringToAccountID} from '../../constants/types/wallets'
import Wallet from '.'
import header, {Container} from './header/index.stories'
import settingsPopup from './settings-popup/index.stories'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Header: props => ({
    onDeposit: Sb.action('onDeposit'),
    onReceive: Sb.action('onReceive'),
    onSendToAnotherWallet: Sb.action('onSendToAnotherWallet'),
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
  settingsPopup()
  Sb.storiesOf('Wallets/Wallet', module)
    .addDecorator(provider)
    .addDecorator(Container)
    .add('Default', () => <Wallet {...props} />)
}

export default load

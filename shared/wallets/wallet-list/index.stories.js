// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action} from '../../stories/storybook'
import {WalletList} from '.'
import walletRow from './wallet-row/index.stories'

const onSelect = action('onSelect')

const mockWallets = {
  account1: {
    isSelected: true,
    name: "cecileb's wallet",
    keybaseUser: 'cecileb',
    contents: '280.0871234 XLM + more',
    onSelect,
  },
  account2: {
    isSelected: false,
    name: 'Second wallet',
    keybaseUser: '',
    contents: '56.9618203 XLM',
    onSelect,
  },
  G43289XXXXX34OPMG43289XXXXX34OPM: {
    isSelected: false,
    name: 'G43289XXXXX34OPMG43289XXXXX34OPM',
    keybaseUser: '',
    contents: '56.9618203 XLM',
    onSelect,
  },
}

const accountIDs = Object.keys(mockWallets)

const WalletRowProvider = () => ({
  WalletRow: ({accountID}) => {
    const mockWallet = mockWallets[accountID]
    if (mockWallet) {
      return mockWallet
    }
    return {
      isSelected: false,
      name: '',
      keybaseUser: '',
      contents: '',
      onSelect,
    }
  },
})

// TODO: Make the result of compose be itself composable.
const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
  PropProviders.WaitingButton(),
  WalletRowProvider()
)

const load = () => {
  walletRow()

  storiesOf('Wallets', module)
    .addDecorator(provider)
    .add('Wallet List', () => (
      <WalletList
        accountIDs={accountIDs}
        selectedAccount="account1"
        onSelectAccount={action('onSelectAccount')}
        onAddNew={action('onAddNew')}
        onLinkExisting={action('onLinkExisting')}
      />
    ))
}

export default load

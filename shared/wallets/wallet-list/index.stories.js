// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action} from '../../stories/storybook'
import {WalletList} from '.'

const mockWallets = [
  {
    accountID: 'account1',
    keybaseUser: 'cecileb',
    name: "cecileb's wallet",
    contents: '280.0871234 XLM + more',
    onSelect: action('onSelect1'),
  },
  {
    accountID: 'account2',
    name: 'Second wallet',
    keybaseUser: '',
    contents: '56.9618203 XLM',
    onSelect: action('onSelect2'),
  },
]

const provider = PropProviders.Common()

const load = () => {
  storiesOf('Wallets', module)
    .addDecorator(provider)
    .add('Wallet List', () => (
      <WalletList
        wallets={mockWallets}
        selectedAccount="account1"
        onSelectAccount={action('onSelectAccount')}
        onAddNew={action('onAddNew')}
        onLinkExisting={action('onLinkExisting')}
      />
    ))
}

export default load

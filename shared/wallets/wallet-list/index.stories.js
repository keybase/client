// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action} from '../../stories/storybook'
import {WalletList} from '.'
import walletRow from './wallet-row/index.stories'

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
  {
    accountID: 'G43289XXXXX34OPMG43289XXXXX34OPM',
    keybaseUser: '',
    name: 'G43289XXXXX34OPMG43289XXXXX34OPM',
    contents: '56.9618203 XLM',
    isSelected: false,
    onSelect: action('onSelect3'),
  },
]

const provider = PropProviders.Common()

const load = () => {
  walletRow()

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

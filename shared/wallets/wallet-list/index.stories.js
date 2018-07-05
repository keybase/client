// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'
import {WalletList} from '.'
import walletRow from './wallet-row/index.stories'
import {stringToAccountID} from '../../constants/types/wallets'

const onSelect = action('onSelect')

const mockWallets = {
  G43289XXXXX34OPL: {
    keybaseUser: 'cecileb',
    name: "cecileb's wallet",
    contents: '280.0871234 XLM + more',
    isSelected: true,
    onSelect,
  },
  G43289XXXXX34OPM: {
    keybaseUser: '',
    name: 'Second wallet',
    contents: '56.9618203 XLM',
    isSelected: false,
    onSelect,
  },
  G43289XXXXX34OPMG43289XXXXX34OPM: {
    keybaseUser: '',
    name: 'G43289XXXXX34OPMG43289XXXXX34OPM',
    contents: '56.9618203 XLM',
    isSelected: false,
    onSelect,
  },
}

const WalletRowProvider = mockWallets => ({
  WalletRow: ({accountID}) => {
    const mockWallet = mockWallets[accountID]
    return (
      mockWallet || {
        keybaseUser: '',
        name: '',
        contents: '',
        isSelected: false,
        onSelect,
      }
    )
  },
})

const provider = createPropProvider(PropProviders.Common(), WalletRowProvider(mockWallets))

const accountIDs = Object.keys(mockWallets).map(s => stringToAccountID(s))

const load = () => {
  walletRow()

  storiesOf('Wallets', module)
    .addDecorator(provider)
    .add('Wallet List', () => (
      <WalletList
        accountIDs={accountIDs}
        onAddNew={action('onAddNew')}
        onLinkExisting={action('onLinkExisting')}
        style={{height: '100%', width: 240}}
      />
    ))
}

export default load

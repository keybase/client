// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action} from '../../stories/storybook'
import {WalletList} from '.'

const common = {
  isSelected: false,
  name: '',
  keybaseUser: '',
  contents: '',
  onSelect: action('onSelect'),
}

const mockWallets = [
  {
    ...common,
    keybaseUser: 'cecileb',
    isSelected: true,
    name: "cecileb's wallet",
    contents: '280.0871234 XLM + more',
  },
  {
    ...common,
    name: 'Second wallet',
    contents: '56.9618203 XLM',
  },
]

const provider = PropProviders.Common()

const load = () => {
  storiesOf('Wallets', module)
    .addDecorator(provider)
    .add('Wallet List', () => (
      <WalletList
        wallets={mockWallets}
        onAddNew={action('onAddNew')}
        onLinkExisting={action('onLinkExisting')}
        onSelect={action('onSelect')}
      />
    ))
}

export default load

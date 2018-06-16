// @flow
import React from 'react'
import * as PropProviders from '../../../stories/prop-providers'
import {Box2} from '../../../common-adapters'
import {storiesOf, action} from '../../../stories/storybook'
import {WalletRow} from '.'

const provider = PropProviders.Common()

const load = () => {
  storiesOf('Wallets/Wallet List', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{width: 240}}>
        {story()}
      </Box2>
    ))
    .add('Wallet', () => (
      <WalletRow
        accountID="account1"
        keybaseUser="cecileb"
        name="cecileb's wallet"
        contents="280.0871234 XLM + more"
        isSelected={true}
        onSelect={action('onSelect')}
      />
    ))
    .add('Wallet', () => (
      <WalletRow
        accountID="account2"
        keybaseUser=""
        name="Second wallet"
        contents="56.9618203 XLM"
        isSelected={false}
        onSelect={action('onSelect')}
      />
    ))
}

export default load

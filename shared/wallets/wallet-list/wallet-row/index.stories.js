// @flow
import React from 'react'
import * as PropProviders from '../../../stories/prop-providers'
import {Box2} from '../../../common-adapters'
import {storiesOf, action} from '../../../stories/storybook'
import {WalletRow} from '.'

const provider = PropProviders.Common()

const onSelect = action('onSelect')

const load = () => {
  storiesOf('Wallets/Wallet Row', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{width: 240}}>
        {story()}
      </Box2>
    ))
    .add('Default', () => (
      <WalletRow
        accountID="G43289XXXXX34OPL"
        keybaseUser="cecileb"
        name="cecileb's wallet"
        contents="280.0871234 XLM + more"
        isSelected={true}
        onSelect={onSelect}
      />
    ))
    .add('Secondary', () => (
      <WalletRow
        accountID="G43289XXXXX34OPM"
        keybaseUser=""
        name="Second wallet"
        contents="56.9618203 XLM"
        isSelected={false}
        onSelect={onSelect}
      />
    ))
    .add('Long', () => (
      <WalletRow
        accountID="G43289XXXXX34OPMG43289XXXXX34OPM"
        keybaseUser=""
        name="G43289XXXXX34OPMG43289XXXXX34OPM"
        contents="56.9618203 XLM"
        isSelected={false}
        onSelect={onSelect}
      />
    ))
}

export default load

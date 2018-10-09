// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box2} from '../../../common-adapters'
import {WalletRow} from '.'

const onSelect = Sb.action('onSelect')

const load = () => {
  Sb.storiesOf('Wallets/Wallet Row', module)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{width: 240}}>
        {story()}
      </Box2>
    ))
    .add('Default', () => (
      <WalletRow
        hasBadge={false}
        keybaseUser="cecileb"
        name="cecileb's account"
        contents="280.0871234 XLM + more"
        isSelected={true}
        onSelect={onSelect}
      />
    ))
    .add('Secondary', () => (
      <WalletRow
        hasBadge={false}
        keybaseUser=""
        name="Second account"
        contents="56.9618203 XLM"
        isSelected={false}
        onSelect={onSelect}
      />
    ))
    .add('Badged', () => (
      <WalletRow
        hasBadge={true}
        keybaseUser=""
        name="Second account"
        contents="56.9618203 XLM"
        isSelected={false}
        onSelect={onSelect}
      />
    ))
    .add('Long', () => (
      <WalletRow
        hasBadge={false}
        keybaseUser=""
        name="G43289XXXXX34OPMG43289XXXXX34OPM"
        contents="56.9618203 XLM"
        isSelected={false}
        onSelect={onSelect}
      />
    ))
}

export default load

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
        airdropSelected={false}
        contents="280.0871234 XLM + more"
        isSelected={true}
        keybaseUser="cecileb"
        name="cecileb's account"
        onSelect={onSelect}
        unreadPayments={0}
      />
    ))
    .add('Secondary', () => (
      <WalletRow
        airdropSelected={false}
        contents="56.9618203 XLM"
        isSelected={false}
        keybaseUser=""
        name="Second account"
        onSelect={onSelect}
        unreadPayments={0}
      />
    ))
    .add('Badged', () => (
      <WalletRow
        airdropSelected={false}
        contents="56.9618203 XLM"
        isSelected={false}
        keybaseUser=""
        name="Second account"
        onSelect={onSelect}
        unreadPayments={2}
      />
    ))
    .add('Long', () => (
      <WalletRow
        airdropSelected={false}
        contents="56.9618203 XLM"
        isSelected={false}
        keybaseUser=""
        name="G43289XXXXX34OPMG43289XXXXX34OPM"
        onSelect={onSelect}
        unreadPayments={0}
      />
    ))
}

export default load

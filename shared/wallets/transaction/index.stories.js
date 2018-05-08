// @flow
import * as React from 'react'
import {Box, Text} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'
import Transaction from '.'

const load = () => {
  storiesOf('Wallets/Assets', module)
    .addDecorator(story => <Box style={{maxWidth: 520}}>{story()}</Box>)
    .add('Default wallet to Keybase User', () => (
      <Transaction
        sender="me"
        receiver="chris"
        sourceValue="100 HUGZ"
        targetValue="50 Lumens"
        note="some note"
        timestamp={new Date()}
      />
    ))
    .add('Default wallet to Stellar Public Key', () => <Text type="BodyBig">TBD</Text>)
    .add('Anonymous wallet to Keybase User', () => <Text type="BodyBig">TBD</Text>)
    .add('Anonymous wallet to Stellar public key', () => <Text type="BodyBig">TBD</Text>)
    .add('Pending', () => <Text type="BodyBig">TBD</Text>)
    .add('Wallet to Wallet', () => <Text type="BodyBig">TBD</Text>)
}

export default load

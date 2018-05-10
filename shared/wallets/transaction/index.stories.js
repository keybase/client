// @flow
import * as React from 'react'
import {Box, Text} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'
import Transaction from '.'

const load = () => {
  storiesOf('Wallets/Transaction', module)
    .addDecorator(story => <Box style={{maxWidth: 520}}>{story()}</Box>)
    .add('Default wallet to Keybase User', () => (
      <Transaction
        timestamp={new Date()}
        yourRole="sender"
        counterparty="paul"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        note="Short note."
      />
    ))
    .add('Keybase User to Default wallet', () => (
      <Transaction
        timestamp={new Date()}
        yourRole="receiver"
        counterparty="paul"
        counterpartyType="keybaseUser"
        amountUser="$100"
        amountXLM="42.535091 XLM"
        note="Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah."
      />
    ))
    .add('Default wallet to Stellar Public Key', () => (
      <Transaction
        timestamp={new Date()}
        yourRole="sender"
        counterparty="G43289XXXXX34OPL"
        counterpartyType="stellarPublicKey"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        note="Short note."
      />
    ))
    .add('Anonymous wallet to Keybase User', () => <Text type="BodyBig">TBD</Text>)
    .add('Anonymous wallet to Stellar public key', () => <Text type="BodyBig">TBD</Text>)
    .add('Pending', () => (
      <Transaction
        timestamp={null}
        yourRole="receiver"
        counterparty="paul"
        counterpartyType="keybaseUser"
        amountUser="$100"
        amountXLM="42.535091 XLM"
        note="Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah."
      />
    ))
    .add('Wallet to Wallet', () => (
      <Transaction
        timestamp={new Date()}
        yourRole="sender"
        counterparty="Second wallet"
        counterpartyType="wallet"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        note="Short note."
      />
    ))
}

export default load

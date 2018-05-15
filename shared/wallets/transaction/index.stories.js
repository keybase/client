// @flow
import * as React from 'react'
import moment from 'moment'
import * as PropProviders from '../../stories/prop-providers'
import {Box2} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'
import Transaction from '.'

const provider = PropProviders.compose(PropProviders.Usernames(['paul'], 'john'))

const now = new Date()
const yesterday = moment(now)
  .subtract(1, 'days')
  .toDate()
const lastWeek = moment(now)
  .subtract(6, 'days')
  .toDate()
const beforeLastWeek = moment(now)
  .subtract(8, 'days')
  .toDate()

const load = () => {
  storiesOf('Wallets/Transaction', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="horizontal" style={{maxWidth: 520}}>
        {story()}
      </Box2>
    ))
    .add('Default wallet to Keybase User', () => (
      <Transaction
        large={true}
        timestamp={yesterday}
        yourRole="sender"
        counterparty="paul"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        note="Short note."
      />
    ))
    .add('Keybase User to Default wallet (small)', () => (
      <Transaction
        large={false}
        timestamp={lastWeek}
        yourRole="receiver"
        counterparty="james"
        counterpartyType="keybaseUser"
        amountUser="$100"
        amountXLM="42.535091 XLM"
        note="Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah."
      />
    ))
    .add('Default wallet to Stellar Public Key', () => (
      <Transaction
        large={true}
        timestamp={beforeLastWeek}
        yourRole="sender"
        counterparty="G43289XXXXX34OPL"
        counterpartyType="stellarPublicKey"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        note="Short note."
      />
    ))
    .add('Stellar Public Key to Default wallet (small)', () => (
      <Transaction
        large={false}
        timestamp={lastWeek}
        yourRole="receiver"
        counterparty="G43289XXXXX34OPL"
        counterpartyType="stellarPublicKey"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        note="Short note."
      />
    ))
    .add('Pending', () => (
      <Transaction
        large={true}
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
        large={true}
        timestamp={yesterday}
        yourRole="sender"
        counterparty="Second wallet"
        counterpartyType="wallet"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        note="Short note."
      />
    ))
    .add('Wallet to Wallet (small)', () => (
      <Transaction
        large={false}
        timestamp={lastWeek}
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

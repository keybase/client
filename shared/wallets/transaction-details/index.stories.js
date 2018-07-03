// @flow
import * as React from 'react'
import moment from 'moment'
import * as PropProviders from '../../stories/prop-providers'
import {Box2} from '../../common-adapters'
import {action, storiesOf} from '../../stories/storybook'
import TransactionDetails from '.'

const provider = PropProviders.compose(
  PropProviders.Usernames(['paul'], 'john'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const now = new Date()
const yesterday = moment(now)
  .subtract(1, 'days')
  .toDate()

const memo =
  'Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah. Plus, emojis. 🍺'

const load = () => {
  storiesOf('Wallets/Transaction Details', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{maxWidth: 520}}>
        {story()}
      </Box2>
    ))
    .add('Sending to Keybase user', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        delta="decrease"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="sender"
        memo={memo}
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onViewTransaction={action('onViewTransaction')}
        you="cjb"
      />
    ))
    .add('Sending to Stellar public key', () => (
      <TransactionDetails
        counterparty="G43289XXXXX34OPL"
        counterpartyType="stellarPublicKey"
        delta="decrease"
        amountUser="$15.65"
        amountXLM="42.535091 XLM"
        yourRole="sender"
        memo={memo}
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onViewTransaction={action('onViewTransaction')}
        you="cjb"
      />
    ))
    .add('Sending to Keybase user (pending)', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        delta="decrease"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="sender"
        memo={memo}
        timestamp={null}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onViewTransaction={action('onViewTransaction')}
        you="cjb"
      />
    ))
    .add('Received from Keybase user', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        delta="increase"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="receiver"
        memo={memo}
        publicMemo="Foo bar"
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onViewTransaction={action('onViewTransaction')}
        you="cjb"
      />
    ))
    .add('Received from Keybase user (pending)', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        delta="increase"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="receiver"
        memo={memo}
        timestamp={null}
        you="cjb"
      />
    ))
    .add('Received from another account', () => (
      <TransactionDetails
        counterparty="Second account"
        counterpartyType="account"
        delta="increase"
        amountUser="$100"
        amountXLM="545.2562704 XLM"
        yourRole="receiver"
        memo={memo}
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onViewTransaction={action('onViewTransaction')}
        you="cjb"
      />
    ))
}

export default load

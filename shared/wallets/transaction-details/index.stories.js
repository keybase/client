// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import moment from 'moment'
import {Box2} from '../../common-adapters'
import TransactionDetails from '.'

const now = new Date()
const yesterday = moment(now)
  .subtract(1, 'days')
  .toDate()

const memo =
  'Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah. Plus, emojis. 🍺'

const load = () => {
  Sb.storiesOf('Wallets/Transaction Details', module)
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
        amountUser="$12.50"
        onBack={Sb.action('onBack')}
        title="Details"
        amountXLM="53.1688643 XLM"
        yourRole="senderOnly"
        memo={memo}
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
      />
    ))
    .add('Sending to Stellar public key', () => (
      <TransactionDetails
        counterparty="G43289XXXXX34OPL"
        onBack={Sb.action('onBack')}
        title="Details"
        counterpartyType="stellarPublicKey"
        amountUser="$15.65"
        amountXLM="42.535091 XLM"
        yourRole="senderOnly"
        memo={memo}
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
      />
    ))
    .add('Sending to Keybase user (pending)', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        onBack={Sb.action('onBack')}
        title="Details"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="senderOnly"
        memo={memo}
        timestamp={null}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
      />
    ))
    .add('Received from Keybase user', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        onBack={Sb.action('onBack')}
        title="Details"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="receiverOnly"
        memo={memo}
        publicMemo="Foo bar"
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
      />
    ))
    .add('Received from Keybase user (pending)', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        onBack={Sb.action('onBack')}
        title="Details"
        amountXLM="53.1688643 XLM"
        yourRole="receiverOnly"
        memo={memo}
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        timestamp={null}
        you="cjb"
        status="pending"
        statusDetail=""
      />
    ))
    .add('Received from another account', () => (
      <TransactionDetails
        counterparty="Second account"
        counterpartyType="otherAccount"
        amountUser="$100"
        amountXLM="545.2562704 XLM"
        yourRole="receiverOnly"
        memo={memo}
        onBack={Sb.action('onBack')}
        title="Details"
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
      />
    ))
}

export default load

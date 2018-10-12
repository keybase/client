// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {stringToAccountID} from '../../constants/types/wallets'
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
        loading={false}
        onBack={Sb.action('onBack')}
        title="Details"
        amountXLM="53.1688643 XLM"
        yourRole="senderOnly"
        memo={memo}
        recipientAccountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
        senderAccountID={stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F')}
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onShowProfile={Sb.action('onShowProfile')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
        selectableText={false}
      />
    ))
    .add('Sending to Stellar public key', () => (
      <TransactionDetails
        counterparty="G43289XXXXX34OPL"
        onBack={Sb.action('onBack')}
        title="Details"
        counterpartyMeta={null}
        counterpartyType="stellarPublicKey"
        amountUser="$15.65"
        loading={false}
        amountXLM="42.535091 XLM"
        yourRole="senderOnly"
        memo={memo}
        recipientAccountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
        senderAccountID={stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F')}
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onShowProfile={Sb.action('onShowProfile')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
        selectableText={false}
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
        loading={false}
        amountXLM="53.1688643 XLM"
        yourRole="senderOnly"
        memo={memo}
        recipientAccountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
        senderAccountID={stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F')}
        timestamp={null}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onShowProfile={Sb.action('onShowProfile')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
        selectableText={false}
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
        loading={false}
        amountXLM="53.1688643 XLM"
        yourRole="receiverOnly"
        memo={memo}
        recipientAccountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
        senderAccountID={stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F')}
        publicMemo="Foo bar"
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onShowProfile={Sb.action('onShowProfile')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
        selectableText={false}
      />
    ))
    .add('Received from Keybase user (pending)', () => (
      <TransactionDetails
        counterparty="yen"
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        loading={false}
        onBack={Sb.action('onBack')}
        title="Details"
        amountXLM="53.1688643 XLM"
        yourRole="receiverOnly"
        memo={memo}
        recipientAccountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
        senderAccountID={stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F')}
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onShowProfile={Sb.action('onShowProfile')}
        timestamp={null}
        you="cjb"
        status="pending"
        statusDetail=""
        selectableText={false}
      />
    ))
    .add('Received from another account', () => (
      <TransactionDetails
        counterparty="Second account"
        counterpartyType="otherAccount"
        counterpartyMeta={null}
        amountUser="$100"
        loading={false}
        amountXLM="545.2562704 XLM"
        yourRole="receiverOnly"
        memo=""
        recipientAccountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
        senderAccountID={stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F')}
        onBack={Sb.action('onBack')}
        title="Details"
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onShowProfile={Sb.action('onShowProfile')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
        selectableText={false}
      />
    ))
    .add('Received from another account with note', () => (
      <TransactionDetails
        counterparty="Second account"
        counterpartyType="otherAccount"
        counterpartyMeta={null}
        amountUser="$100"
        loading={false}
        amountXLM="545.2562704 XLM"
        yourRole="receiverOnly"
        memo={memo}
        recipientAccountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
        senderAccountID={stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F')}
        onBack={Sb.action('onBack')}
        title="Details"
        timestamp={yesterday}
        transactionID="998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591"
        onCancelPayment={null}
        onCancelPaymentWaitingKey=""
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        onShowProfile={Sb.action('onShowProfile')}
        onViewTransaction={Sb.action('onViewTransaction')}
        you="cjb"
        status="completed"
        statusDetail=""
        selectableText={false}
      />
    ))
    .add('Loading', () => (
      <TransactionDetails
        loading={true}
        onBack={Sb.action('onBack')}
        onLoadPaymentDetail={Sb.action('onLoadPaymentDetail')}
        title="Transaction Details"
      />
    ))
}

export default load

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

const props = {
  amountUser: '',
  amountXLM: '',
  counterparty: 'yen',
  counterpartyMeta: null,
  counterpartyType: 'keybaseUser',
  loading: false,
  memo,
  onBack: Sb.action('onBack'),
  onCancelPayment: null,
  onCancelPaymentWaitingKey: '',
  onChat: Sb.action('onChat'),
  onLoadPaymentDetail: Sb.action('onLoadPaymentDetail'),
  onShowProfile: Sb.action('onShowProfile'),
  onViewTransaction: Sb.action('onViewTransaction'),
  recipientAccountID: stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF'),
  selectableText: false,
  senderAccountID: stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F'),
  status: 'completed',
  statusDetail: '',
  timestamp: yesterday,
  title: 'Details',
  transactionID: '998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591',
  you: 'cjb',
  yourAccountName: '',
  yourRole: 'senderOnly',
}

const load = () => {
  Sb.storiesOf('Wallets/Transaction Details', module)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{maxWidth: 520}}>
        {story()}
      </Box2>
    ))
    .addDecorator(Sb.scrollViewDecorator)
    .add('Sending to Keybase user', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
      />
    ))
    .add('Sending to Stellar public key', () => (
      <TransactionDetails
        {...props}
        counterparty="G43289KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R2340PL"
        counterpartyMeta={null}
        counterpartyType="stellarPublicKey"
        amountUser="$15.65"
        amountXLM="42.535091 XLM"
      />
    ))
    .add('Sending to Keybase user (pending)', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        timestamp={null}
        onCancelPayment={Sb.action('onCancelPayment')}
      />
    ))
    .add('Received from Keybase user', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="receiverOnly"
        publicMemo="Foo bar"
      />
    ))
    .add('Received from Keybase user (pending)', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        yourRole="receiverOnly"
        timestamp={null}
        status="pending"
      />
    ))
    .add('Received from another account', () => (
      <TransactionDetails
        {...props}
        counterparty="Second account"
        counterpartyType="otherAccount"
        counterpartyMeta={null}
        amountUser="$100"
        amountXLM="545.2562704 XLM"
        yourAccountName="First account"
        yourRole="receiverOnly"
        memo=""
      />
    ))
    .add('Received from another account with note', () => (
      <TransactionDetails
        {...props}
        counterparty="Second account"
        counterpartyType="otherAccount"
        counterpartyMeta={null}
        amountUser="$100"
        amountXLM="545.2562704 XLM"
        yourAccountName="First account"
        yourRole="receiverOnly"
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

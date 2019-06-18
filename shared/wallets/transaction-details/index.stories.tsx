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

const tallMemo = 'x\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\nx\n'

const props = {
  amountUser: '',
  amountXLM: '',
  approxWorth: '',
  counterparty: 'yen',
  counterpartyMeta: null,
  counterpartyType: 'keybaseUser',
  feeChargedDescription: '',
  isAdvanced: false,
  issuerAccountID: null,
  issuerDescription: '',
  loading: false as false,
  memo,
  onBack: Sb.action('onBack'),
  onCancelPayment: null,
  onCancelPaymentWaitingKey: '',
  onChat: Sb.action('onChat'),
  onLoadPaymentDetail: Sb.action('onLoadPaymentDetail'),
  onShowProfile: Sb.action('onShowProfile'),
  onViewTransaction: Sb.action('onViewTransaction'),
  recipientAccountID: stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF'),
  selectableText: true,
  senderAccountID: stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F'),
  sourceAmount: '',
  sourceAsset: '',
  status: 'completed' as 'completed',
  statusDetail: '',
  timestamp: yesterday,
  title: 'Transaction details',
  transactionID: '998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591',
  you: 'cjb',
  yourAccountName: '',
  yourRole: 'senderOnly' as 'senderOnly',
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
    .add('Sending to Keybase user (tall)', () => (
      <TransactionDetails
        {...props}
        memo={tallMemo}
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
    .add('Sending to Stellar public key (non-native asset)', () => (
      <TransactionDetails
        {...props}
        counterparty="G43289KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R2340PL"
        counterpartyMeta={null}
        counterpartyType="stellarPublicKey"
        amountXLM="53.1688643 HUGS"
        amountUser=""
        memo="Make sure to redeem that hug! 🤗"
        issuerDescription="example.com"
        issuerAccountID={stringToAccountID('GD6TAJEGIL7PZFBPSZLCBTQCW45YT6UZJ6YS274OAFVBLQSMJTETVCNU')}
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
        feeChargedDescription="0.0000100 XLM"
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
    .add('Received from Stellar account with warning', () => (
      <TransactionDetails
        {...props}
        counterparty="G43289KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R2340PL"
        counterpartyType="stellarPublicKey"
        counterpartyMeta={null}
        amountUser="$100"
        amountXLM="545.2562704 XLM"
        publicMemo="compliance trigger warning"
        feeChargedDescription="0.0000100 XLM"
        yourAccountName="First account"
        yourRole="receiverOnly"
      />
    ))
    .add('Sent path payment', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        sourceAmount="1.0000000"
        sourceAsset="TOAD"
      />
    ))
    .add('Advanced tx', () => (
      <TransactionDetails
        {...props}
        counterparty=""
        counterpartyType="stellarPublicKey"
        feeChargedDescription="0.0000100 XLM"
        issuerDescription="Unknown issuer"
        memo=""
        recipientAccountID={null}
        isAdvanced={true}
        summaryAdvanced="Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C"
        operations={[
          'Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
        ]}
      />
    ))
    .add('Advanced tx multi', () => (
      <TransactionDetails
        {...props}
        counterparty=""
        counterpartyType="stellarPublicKey"
        feeChargedDescription="0.0000100 XLM"
        issuerDescription="Unknown issuer"
        memo=""
        recipientAccountID={null}
        isAdvanced={true}
        summaryAdvanced="Multi-operation transaction with 3 operations"
        operations={[
          'Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
          'Paid 1.0000000 XLM to account GA5MKLM3B2L4SXXXXFZAIX54KVUTEKIXRB2XOKAGYVTQMWD77AMKUD2G',
          'Set master key weight to 100',
        ]}
      />
    ))
}

export default load

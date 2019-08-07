import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/wallets'
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
  assetCode: '',
  counterparty: 'yen',
  counterpartyMeta: null,
  counterpartyType: 'keybaseUser',
  feeChargedDescription: '',
  fromAirdrop: false,
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
  pathIntermediate: [],
  recipientAccountID: Types.stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF'),
  selectableText: true,
  senderAccountID: Types.stringToAccountID('GCHRPJ4AI54NMJSJWTCA5ZMTKVSDWGDY6KNJOXLYGRHA4FU5OJVRJR3F'),
  sourceAmount: '',
  sourceAsset: '',
  sourceConvRate: '',
  sourceIssuer: '',
  sourceIssuerAccountID: Types.noAccountID,
  status: 'completed' as 'completed',
  statusDetail: '',
  timestamp: yesterday,
  title: 'Transaction details',
  transactionID: '998e29a665642a8b7289312469664b73b38c1fe9e61d4012d8114a8dae5d7591',
  you: 'cjb',
  yourAccountName: '',
  yourRole: 'senderOnly' as 'senderOnly',
}

const partialAsset = {
  authEndpoint: '',
  code: '',
  depositButtonText: '',
  desc: '',
  infoUrl: '',
  infoUrlText: '',
  issuerName: '',
  showDepositButton: false,
  showWithdrawButton: false,
  transferServer: '',
  type: '',
  withdrawButtonText: '',
  withdrawType: '',
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
        issuerAccountID={Types.stringToAccountID('GD6TAJEGIL7PZFBPSZLCBTQCW45YT6UZJ6YS274OAFVBLQSMJTETVCNU')}
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
    .add('Sent path payment (XLM -> Asset)', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountXLM="53.1688643 TOAD"
        assetCode="TOAD"
        sourceAmount="0.0222742"
        issuerDescription="anchortoad.com"
        sourceConvRate="22.4474953"
      />
    ))
    .add('Sent path payment (Asset -> Same Asset)', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountXLM="1 FROG"
        assetCode="FROG"
        sourceAmount="1"
        sourceAsset="FROG"
        sourceIssuer="froggycoin.io"
        issuerDescription="froggycoin.io"
        sourceConvRate="1.000000"
        pathIntermediate={[]}
      />
    ))
    .add('Sent path payment (Asset -> Different Asset)', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountXLM="2.5 FROG"
        assetCode="FROG"
        sourceAmount="1.02"
        sourceAsset="TOAD"
        sourceIssuer="anchortoad.com"
        issuerDescription="froggycoin.io"
        sourceConvRate="2.450000"
        pathIntermediate={[
          {
            code: 'WHAT',
            issuerAccountID: 'fakeaccountid',
            issuerName: 'whatcoin',
            issuerVerifiedDomain: '',
          },
          {
            code: 'NATE',
            issuerAccountID: 'fakeaccountid',
            issuerName: 'natecoin',
            issuerVerifiedDomain: 'nathansmith.io',
          },
          {
            code: '',
            issuerAccountID: '',
            issuerName: '',
            issuerVerifiedDomain: '',
          },
          {
            code: 'BLAH',
            issuerAccountID: 'fakeaccountid',
            issuerName: 'Blahhold.co',
            issuerVerifiedDomain: 'blahhold.co',
          },
        ]}
      />
    ))
    .add('Sent path payment (Asset -> XLM)', () => (
      <TransactionDetails
        {...props}
        counterpartyMeta="Addie Stokes"
        counterpartyType="keybaseUser"
        amountUser="$12.50"
        amountXLM="53.1688643 XLM"
        sourceAmount="1.0000000"
        sourceAsset="TOAD"
        sourceIssuer="anchortoad.com"
        sourceConvRate="53.168864"
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
    .add('Trustline add', () => (
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
        trustline={{
          asset: {
            ...partialAsset,
            ...{
              code: 'WBEZ',
              issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
              verifiedDomain: 'strongmold.co',
            },
          },
          remove: true,
        }}
      />
    ))
    .add('Trustline add (no issuer domain)', () => (
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
        trustline={{
          asset: {
            ...partialAsset,
            ...{
              code: 'WBEZ',
              issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
              verifiedDomain: '',
            },
          },
          remove: true,
        }}
      />
    ))
    .add('Trustline remove', () => (
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
        trustline={{
          asset: {
            ...partialAsset,
            ...{
              code: 'WBEZ',
              issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
              verifiedDomain: 'strongmold.co',
            },
          },
          remove: true,
        }}
      />
    ))
    .add('Trustline remove (no issuer domain)', () => (
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
        trustline={{
          asset: {
            ...partialAsset,
            ...{
              code: 'WBEZ',
              issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
              verifiedDomain: '',
            },
          },
          remove: true,
        }}
      />
    ))
}

export default load

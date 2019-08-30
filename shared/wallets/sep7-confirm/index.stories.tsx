import * as React from 'react'
import {Box} from '../../common-adapters/index'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/wallets'
import SEP7Confirm from '.'
import {KeybaseLinkErrorBody} from '../../deeplinks/error'

const commonPath = {
  amountError: '',
  destinationAccount: 'NOACCOUNTID',
  destinationDisplay: '',
  exchangeRate: '',
  findPathError: '',
  fullPath: Constants.makePaymentPath(),
  noPathFoundError: false,
  readyToSend: false,
  sourceDisplay: '',
  sourceMaxDisplay: '',
}

const commonProps = {
  assetCode: '',
  availableToSendFiat: '$12.34 USD',
  availableToSendNative: '20 XLM',
  callbackURL: null,
  displayAmountFiat: '$23.45 USD',
  displayAmountNative: '40 XLM',
  error: '',
  loading: false,
  memo: '',
  memoType: 'MEMO_NONE',
  onAcceptPath: Sb.action('onAcceptPath'),
  onAcceptPay: Sb.action('onAcceptPay'),
  onAcceptTx: Sb.action('onAcceptTx'),
  onBack: Sb.action('onBack'),
  onChangeAmount: Sb.action('onChangeAmount'),
  onLookupPath: Sb.action('onLookupPath'),
  path: commonPath,
  readyToSend: true,
  userAmount: '',
  waiting: false,
  waitingKey: 'false',
}

const payProps = {
  amount: '10',
  message: 'test message',
  operation: 'pay' as const,
  originDomain: 'blog.stathat.com',
  recipient: 'GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB',
  signed: true,
  summary: {
    fee: '',
    memo: '',
    memoType: 'MEMO_NONE',
    operations: [],
    source: '',
  },
}

const payUnsignedProps = {
  amount: '10',
  message: 'test message',
  operation: 'pay' as const,
  originDomain: '',
  recipient: 'GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB',
  signed: false,
  summary: {
    fee: '',
    memo: '',
    memoType: 'MEMO_NONE',
    operations: [],
    source: '',
  },
}

const txProps = {
  amount: '',
  message: '',
  operation: 'tx' as const,
  originDomain: 'stathat.com',
  recipient: '',
  signed: true,
  summary: {
    fee: '100',
    memo: 'test memo',
    memoType: 'MEMO_TEXT',
    operations: ['Establish trust line to WHAT/GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB'],
    source: 'GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB',
  },
}

const unsignedTxProps = {
  amount: '',
  message: '',
  operation: 'tx' as const,
  originDomain: '',
  recipient: '',
  signed: false,
  summary: {
    fee: '100',
    memo: 'test memo',
    memoType: 'MEMO_TEXT',
    operations: ['Establish trust line to WHAT/GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB'],
    source: 'GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB',
  },
}

const load = () => {
  Sb.storiesOf('Wallets/SEP7ConfirmForm', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Signed Pay', () => <SEP7Confirm {...commonProps} {...payProps} />)
    .add('Unsigned Pay', () => <SEP7Confirm {...commonProps} {...payUnsignedProps} />)
    .add('Signed Tx', () => <SEP7Confirm {...commonProps} {...txProps} />)
    .add('Unsigned Tx', () => <SEP7Confirm {...commonProps} {...unsignedTxProps} />)
  Sb.storiesOf('Wallets/SEP7Error', module).add('Error', () => (
    <KeybaseLinkErrorBody
      isError={true}
      message="This Stellar link claims to be signed by keybaze.io, but the Keybase app cannot currently verify the signature came from keybaze.io. Sorry, there's nothing you can do with this Stellar link."
    />
  ))
}

export default load

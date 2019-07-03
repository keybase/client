import * as React from 'react'
import {Box} from '../../common-adapters/index'
import * as Sb from '../../stories/storybook'

import SEP7Confirm from '.'
import SEP7Error from './error'

const commonProps = {
  availableToSendFiat: '$12.34 USD',
  availableToSendNative: '20 XLM',
  callbackURL: null,
  displayAmountFiat: '$23.45 USD',
  displayAmountNative: '40 XLM',
  error: '',
  loading: false,
  memo: '',
  memoType: 'MEMO_NONE',
  onAcceptPay: Sb.action('onAcceptPay'),
  onAcceptTx: Sb.action('onAcceptTx'),
  onBack: Sb.action('onBack'),
  onChangeAmount: Sb.action('onChangeAmount'),
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
  summary: {
    fee: '100',
    memo: 'test memo',
    memoType: 'MEMO_TEXT',
    operations: ['Establish trust line to WHAT/GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB'],
    source: 'GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB',
  },
}

const common = Sb.createStoreWithCommon()

const store = {
  ...common,
  wallets: {
    sep7ConfirmError:
      "This Stellar link claims to be signed by keybaze.io, but the Keybase app cannot currently verify the signature came from keybaze.io, there's nothing you can do with this Stellar link.",
  },
}

const load = () => {
  Sb.storiesOf('Wallets/SEP7ConfirmForm', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Pay', () => <SEP7Confirm {...commonProps} {...payProps} />)
    .add('Tx', () => <SEP7Confirm {...commonProps} {...txProps} />)
  Sb.storiesOf('Wallets/SEP7Error', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Error', () => <SEP7Error />)
}

export default load

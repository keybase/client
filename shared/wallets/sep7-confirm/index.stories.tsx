import * as React from 'react'
import {Box} from '../../common-adapters/index'
import * as Sb from '../../stories/storybook'

import SEP7Confirm from '.'

const commonProps = {
  callbackURL: null,
  loading: false,
  memo: '',
  memoType: 'MEMO_NONE',
  onAcceptPay: Sb.action('onAcceptPay'),
  onAcceptTx: Sb.action('onAcceptTx'),
  onBack: Sb.action('onBack'),
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

const load = () => {
  Sb.storiesOf('Wallets/SEP7ConfirmForm', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Pay', () => <SEP7Confirm {...commonProps} {...payProps} />)
    .add('Tx', () => <SEP7Confirm {...commonProps} {...txProps} />)
}

export default load

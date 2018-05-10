// @flow
import * as React from 'react'
import {action, storiesOf, unexpected} from '../../../../stories/storybook'
import {Box} from '../../../../common-adapters'
import {globalColors} from '../../../../styles'
import Payment from '.'

// TODO replace placeholders with real icons
// 'iconfont-arrow-up' = 'sent'
// 'iconfont-arrow-down' = 'request'

const sentProps = {
  action: 'sent lumens worth',
  amount: '$35',
  balanceChange: '-90.5700999 XLM',
  balanceChangeColor: globalColors.red,
  icon: 'iconfont-arrow-up',
  memo: ':beer:',
  pending: false,
}

const sendingProps = {
  action: 'sending lumens worth',
  amount: '$35',
  balanceChange: '-90.5700999 XLM',
  balanceChangeColor: globalColors.grey,
  icon: 'iconfont-time',
  memo: ':beer:',
  pending: true,
}

const requestCommon = {
  action: 'requested lumens worth',
  balanceChange: '',
  balanceChangeColor: '',
  icon: 'iconfont-arrow-down',
  pending: false,
}

const youRequestProps = {
  ...requestCommon,
  amount: '$34',
  memo: 'for beers',
  onSend: unexpected('onSend'),
}

const theyRequestProps = {
  ...requestCommon,
  amount: '$107',
  memo: 'things',
  sendButtonLabel: 'Send Lumens worth $107',
  onSend: action('onSend'),
}

const sentAssetProps = {
  action: 'sent',
  amount: '1 BTC/Abc.def',
  balanceChange: '-1 BTC',
  balanceChangeColor: globalColors.red,
  icon: 'iconfont-arrow-up',
  memo: '₿',
  pending: false,
}

const load = () => {
  storiesOf('Chat/Conversation/Wallet payments', module)
    .addDecorator(story => <Box style={{maxWidth: 420}}>{story()}</Box>)
    .add('Sent', () => <Payment {...sentProps} />)
    .add('Sending', () => <Payment {...sendingProps} />)
    .add('You request', () => <Payment {...youRequestProps} />)
    .add('They request', () => <Payment {...theyRequestProps} />)
    .add('Sent non-native', () => <Payment {...sentAssetProps} />)
}

export default load

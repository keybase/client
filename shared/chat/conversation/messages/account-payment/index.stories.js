// @flow
import * as React from 'react'
import {action, storiesOf, unexpected} from '../../../../stories/storybook'
import {Box} from '../../../../common-adapters'
import {globalColors} from '../../../../styles'
import Payment from '.'

const sendCommon = {
  canceled: false,
  onSend: action('onSend'),
  sendButtonLabel: '',
}

const sentProps = {
  ...sendCommon,
  action: 'sent Lumens worth',
  amount: '$35',
  balanceChange: '-90.5700999 XLM',
  balanceChangeColor: globalColors.red,
  icon: 'iconfont-stellar-send',
  loading: false,
  memo: ':beer:',
  pending: false,
}

const sendingProps = {
  ...sendCommon,
  action: 'sending Lumens worth',
  amount: '$35',
  balanceChange: '-90.5700999 XLM',
  balanceChangeColor: globalColors.grey,
  icon: 'iconfont-time',
  loading: false,
  memo: ':beer:',
  pending: true,
}

const requestCommon = {
  ...sendCommon,
  action: 'requested Lumens worth',
  balanceChange: '',
  balanceChangeColor: '',
  icon: 'iconfont-stellar-request',
  loading: false,
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
  onSend: action('onSend'),
  sendButtonLabel: 'Send Lumens worth $107',
}

const sentAssetProps = {
  ...sendCommon,
  action: 'sent',
  amount: '1 BTC/Abc.def',
  balanceChange: '-1 BTC',
  balanceChangeColor: globalColors.red,
  icon: 'iconfont-stellar-send',
  loading: false,
  memo: '₿',
  pending: false,
}

const loadingProps = {
  ...sendCommon,
  action: '',
  amount: '',
  balanceChange: '',
  balanceChangeColor: '',
  icon: 'iconfont-stellar-send',
  loading: true,
  memo: '',
  pending: false,
}

const load = () => {
  storiesOf('Chat/Conversation/Account payments', module)
    .addDecorator(story => <Box style={{maxWidth: 420}}>{story()}</Box>)
    .add('Sent', () => <Payment {...sentProps} />)
    .add('Sending', () => <Payment {...sendingProps} />)
    .add('You request', () => <Payment {...youRequestProps} />)
    .add('They request', () => <Payment {...theyRequestProps} />)
    .add('Sent non-native', () => <Payment {...sentAssetProps} />)
    .add('Loading', () => <Payment {...loadingProps} />)
}

export default load

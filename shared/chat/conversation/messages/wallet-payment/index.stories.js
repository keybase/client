// @flow
import * as React from 'react'
import {storiesOf} from '../../../../stories/storybook'
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
  pending: 'true',
}

const load = () => {
  storiesOf('Chat/Conversation/Wallet payments', module)
    .addDecorator(story => <Box style={{width: 420}}>{story()}</Box>)
    .add('Sent', () => <Payment {...sentProps} />)
    .add('Sending', () => <Payment {...sendingProps} />)
}

export default load

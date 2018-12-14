// @flow
import * as React from 'react'
import {Box, Text} from '../../../common-adapters/index'
import * as Sb from '../../../stories/storybook'

import PaymentStatus from '.'
import PaymentDetails from './details'

const successProps = {
  status: 'completed',
  text: '+1XLM@patrick',
}

const pendingProps = {
  status: 'pending',
  text: '+10XLM@chris',
}

const errorProps = {
  status: 'error',
  text: '+5USD@mikem',
}

const detailsProps = {
  attachTo: Sb.action('attachTo'),
  onHidden: Sb.action('onHidden'),
  sender: 'mikem',
  worthDescription: '$1 USD',
  amountDescription: '-4.4811371 XLM',
  isYou: true,
  visible: true,
  delta: 'decrease',
  sendTime: 1544818272347,
}

const load = () => {
  Sb.storiesOf('Chat/Wallet/Status', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Message', () => {
      return (
        <Text type="Body">
          My life to yours <PaymentStatus {...successProps} />, my breath becomes yours{' '}
          <PaymentStatus {...pendingProps} />, but not you <PaymentStatus {...errorProps} />{' '}
        </Text>
      )
    })
    .add('Details', () => {
      return <PaymentDetails {...detailsProps} />
    })
}

export default load

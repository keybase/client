// @flow
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as WalletTypes from '../../../constants/types/wallets'
import {Box, Text} from '../../../common-adapters/index'
import * as Sb from '../../../stories/storybook'

import PaymentStatus from '.'
import PaymentStatusError from './error'

const common = {
  allowPopup: true,
  isSendError: false,
  message: Constants.makeMessageText(),
  paymentID: WalletTypes.noPaymentID,
}

const successProps = {
  ...common,
  status: 'completed',
  text: '+1XLM@patrick',
}

const pendingProps = {
  ...common,
  status: 'pending',
  text: '+10XLM@chris',
}

const errorProps = {
  ...common,
  status: 'error',
  text: '+5USD@mikem',
}

const sendErrorProps = {
  attachTo: Sb.action('mocked'),
  error: 'must send at least 1 XLM since it is recipients first transaction',
  visible: true,
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
    .add('Error', () => {
      return <PaymentStatusError {...sendErrorProps} />
    })
}

export default load

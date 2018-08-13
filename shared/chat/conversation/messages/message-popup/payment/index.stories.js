// @flow
import * as React from 'react'
import * as Sb from '../../../../../stories/storybook'
import PaymentPopup from '.'

const commonProps = {
  attachTo: null,
  device: 'iPhone 6',
  onCancel: null,
  onHidden: Sb.action('onHidden'),
  position: 'top right',
  timestamp: 'Yesterday 8:11 PM',
  visible: true,
}

const theyRequestProps = {
  ...commonProps,
  amountNominal: '$34',
  balanceChange: '',
  balanceChangeColor: '',
  bottomLine: '',
  icon: '',
  topLine: 'requested lumens worth',
  txVerb: 'requested',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Message popup', module).add('They request lumens', () => (
    <PaymentPopup {...theyRequestProps} />
  ))
}

export default load

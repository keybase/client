// @flow
import * as React from 'react'
import * as Sb from '../../../../../stories/storybook'
import {isMobile} from '../../../../../constants/platform'
import PaymentPopup from '.'

const sendIcon = isMobile ? 'icon-fancy-stellar-sending-mobile' : 'icon-fancy-stellar-sending-desktop'
const receiveIcon = isMobile ? 'icon-fancy-stellar-receiving-mobile' : 'icon-fancy-stellar-receiving-desktop'

const commonProps = {
  attachTo: null,
  onCancel: null,
  onHidden: Sb.action('onHidden'),
  position: 'top right',
  senderDeviceName: 'iPhone 6',
  timestamp: 'Yesterday 8:11 PM',
  visible: true,
}

const theyRequestProps = {
  ...commonProps,
  amountNominal: '$34',
  balanceChange: '',
  balanceChangeColor: '',
  bottomLine: '',
  icon: receiveIcon,
  sender: 'kamel',
  topLine: 'requested lumens worth',
  txVerb: 'requested',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Message popup', module).add('They request lumens', () => (
    <PaymentPopup {...theyRequestProps} />
  ))
}

export default load

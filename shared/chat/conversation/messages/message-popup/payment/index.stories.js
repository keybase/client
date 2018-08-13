// @flow
import * as React from 'react'
import * as Sb from '../../../../../stories/storybook'
import * as S from '../../../../../styles'
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

const youReceiveProps = {
  ...commonProps,
  amountNominal: '$1',
  balanceChange: '+5.0200803 XLM',
  balanceChangeColor: S.globalColors.green2,
  bottomLine: '',
  icon: receiveIcon,
  sender: 'kamel',
  topLine: 'you received lumens worth',
  txVerb: 'sent',
}

const youRequestProps = {
  ...commonProps,
  amountNominal: '$34',
  balanceChange: '',
  balanceChangeColor: '',
  bottomLine: '',
  icon: receiveIcon,
  onCancel: Sb.action('onCancel'),
  sender: 'cecileb',
  topLine: 'you requested lumens worth',
  txVerb: 'requested',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Message popup/Payments', module)
    .add('They request lumens', () => <PaymentPopup {...theyRequestProps} />)
    .add('You receive lumens', () => <PaymentPopup {...youReceiveProps} />)
    .add('You request lumens', () => <PaymentPopup {...youRequestProps} />)
}

export default load

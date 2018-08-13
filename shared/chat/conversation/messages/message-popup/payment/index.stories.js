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

const onCancel = Sb.action('onCancel')

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
  onCancel,
  sender: 'cecileb',
  topLine: 'you requested lumens worth',
  txVerb: 'requested',
}

const youSendProps = {
  ...commonProps,
  amountNominal: '$1',
  balanceChange: '-170.6827309 XLM',
  balanceChangeColor: S.globalColors.red,
  bottomLine: '',
  icon: sendIcon,
  sender: 'cecileb',
  topLine: 'you sent lumens worth',
  txVerb: 'sent',
}

const youRequestBTCProps = {
  ...commonProps,
  amountNominal: '3 BTC',
  balanceChange: '',
  balanceChangeColor: '',
  bottomLine: 'stronghold.com',
  icon: receiveIcon,
  onCancel,
  sender: 'cecileb',
  topLine: 'you requested',
  txVerb: 'requested',
}

const youReceiveBTCProps = {
  ...commonProps,
  amountNominal: '1 BTC',
  balanceChange: '+1 BTC',
  balanceChangeColor: S.globalColors.green2,
  bottomLine: 'stronghold.com',
  icon: receiveIcon,
  sender: 'kamel',
  topLine: 'you received',
  txVerb: 'sent',
}

const youSendBTCProps = {
  ...commonProps,
  amountNominal: '1 BTC',
  balanceChange: '-1 BTC',
  balanceChangeColor: S.globalColors.red,
  bottomLine: 'stronghold.com',
  icon: sendIcon,
  sender: 'cecileb',
  topLine: 'you sent',
  txVerb: 'sent',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Message popup/Payments', module)
    .add('They request lumens', () => <PaymentPopup {...theyRequestProps} />)
    .add('You receive lumens', () => <PaymentPopup {...youReceiveProps} />)
    .add('You request lumens', () => <PaymentPopup {...youRequestProps} />)
    .add('You send lumens', () => <PaymentPopup {...youSendProps} />)
    .add('You request BTC', () => <PaymentPopup {...youRequestBTCProps} />)
    .add('You receive BTC', () => <PaymentPopup {...youReceiveBTCProps} />)
    .add('You send BTC', () => <PaymentPopup {...youSendBTCProps} />)
}

export default load

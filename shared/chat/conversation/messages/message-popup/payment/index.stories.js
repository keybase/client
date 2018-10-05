// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as S from '../../../../../styles'
import PaymentPopup from '.'

const receiveIcon = 'receiving'
const sendIcon = 'sending'

const commonProps = {
  loading: false,
  onCancel: null,
  onHidden: Sb.action('onHidden'),
  onSeeDetails: null,
  position: 'bottom left',
  senderDeviceName: 'iPhone 6',
  timestamp: 'Yesterday 8:11 PM',
  visible: true,
}

const onCancel = Sb.action('onCancel')
const onSeeDetails = Sb.action('onSeeDetails')

const theyRequestProps = {
  ...commonProps,
  amountNominal: '$34',
  balanceChange: '',
  balanceChangeColor: '',
  bottomLine: '',
  icon: receiveIcon,
  sender: 'kamel',
  topLine: 'requested Lumens worth',
  txVerb: 'requested',
}

const youReceiveProps = {
  ...commonProps,
  amountNominal: '$1',
  balanceChange: '+5.0200803 XLM',
  balanceChangeColor: S.globalColors.green,
  bottomLine: '',
  icon: receiveIcon,
  onSeeDetails,
  sender: 'kamel',
  topLine: 'you received Lumens worth',
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
  topLine: 'you requested Lumens worth',
  txVerb: 'requested',
}

const youSendProps = {
  ...commonProps,
  amountNominal: '$1',
  balanceChange: '-170.6827309 XLM',
  balanceChangeColor: S.globalColors.red,
  bottomLine: '',
  icon: sendIcon,
  onSeeDetails,
  sender: 'cecileb',
  topLine: 'you sent Lumens worth',
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
  balanceChangeColor: S.globalColors.green,
  bottomLine: 'stronghold.com',
  icon: receiveIcon,
  onSeeDetails,
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
  onSeeDetails,
  sender: 'cecileb',
  topLine: 'you sent',
  txVerb: 'sent',
}

const loadingProps = {
  ...commonProps,
  amountNominal: '',
  balanceChange: '',
  balanceChangeColor: '',
  bottomLine: '',
  icon: sendIcon,
  loading: true,
  sender: '',
  topLine: '',
  txVerb: 'sent',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Message popup/Payments', module)
    .add('They request Lumens', () => <PaymentPopupMoved {...theyRequestProps} />)
    .add('You receive Lumens', () => <PaymentPopupMoved {...youReceiveProps} />)
    .add('You request Lumens', () => <PaymentPopupMoved {...youRequestProps} />)
    .add('You send Lumens', () => <PaymentPopupMoved {...youSendProps} />)
    .add('You request BTC', () => <PaymentPopupMoved {...youRequestBTCProps} />)
    .add('You receive BTC', () => <PaymentPopupMoved {...youReceiveBTCProps} />)
    .add('You send BTC', () => <PaymentPopupMoved {...youSendBTCProps} />)
    .add('Loading', () => <PaymentPopupMoved {...loadingProps} />)
}

type State = {
  ref: ?Kb.Box,
}
class PaymentPopupMoved extends React.Component<React.ElementProps<typeof PaymentPopup>, State> {
  state = {ref: null}
  render() {
    return (
      <React.Fragment>
        <Kb.Box
          style={{left: 20, position: 'absolute', top: 20}}
          ref={ref => this.setState(s => (s.ref ? null : {ref}))}
        />
        <PaymentPopup {...this.props} attachTo={() => this.state.ref} />
      </React.Fragment>
    )
  }
}

export default load

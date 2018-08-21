// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as S from '../../../../../styles'
import PaymentPopup from '.'

const receiveIcon = 'receiving'
const sendIcon = 'sending'

const commonProps = {
  onCancel: null,
  onHidden: Sb.action('onHidden'),
  position: 'bottom left',
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
    .add('They request lumens', () => <PaymentPopupMoved {...theyRequestProps} />)
    .add('You receive lumens', () => <PaymentPopupMoved {...youReceiveProps} />)
    .add('You request lumens', () => <PaymentPopupMoved {...youRequestProps} />)
    .add('You send lumens', () => <PaymentPopupMoved {...youSendProps} />)
    .add('You request BTC', () => <PaymentPopupMoved {...youRequestBTCProps} />)
    .add('You receive BTC', () => <PaymentPopupMoved {...youReceiveBTCProps} />)
    .add('You send BTC', () => <PaymentPopupMoved {...youSendBTCProps} />)
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
        <PaymentPopup {...this.props} attachTo={this.state.ref} />
      </React.Fragment>
    )
  }
}

export default load

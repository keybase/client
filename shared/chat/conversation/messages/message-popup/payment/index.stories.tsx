import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as S from '../../../../../styles'
import PaymentPopup, {Props} from '.'

const load = () => {
  const receiveIcon = 'receiving'
  const sendIcon = 'sending'

  const commonProps = {
    approxWorth: '',
    bottomLine: '',
    cancelButtonLabel: '',
    errorDetails: '',
    loading: false,
    onCancel: null,
    onClaimLumens: null,
    onHidden: Sb.action('onHidden'),
    onSeeDetails: null,
    position: 'bottom left',
    senderDeviceName: 'iPhone 6',
    status: 'completed',
    timestamp: 'Yesterday 8:11 PM',
    visible: true,
  }

  const onCancel = Sb.action('onCancel')
  const onSeeDetails = Sb.action('onSeeDetails')

  const theyRequestProps = {
    ...commonProps,
    amountNominal: '$34',
    balanceChange: '',
    icon: receiveIcon,
    sender: 'kamel',
    topLine: 'requested Lumens worth',
    txVerb: 'requested',
  } as Props

  const youReceiveProps = {
    ...commonProps,
    amountNominal: '$1',
    balanceChange: '+5.0200803 XLM',
    icon: receiveIcon,
    onSeeDetails,
    sender: 'kamel',
    topLine: 'you received Lumens worth',
    txVerb: 'sent',
  } as Props

  const youRequestProps = {
    ...commonProps,
    amountNominal: '$34',
    balanceChange: '',
    cancelButtonLabel: 'Cancel request',
    icon: receiveIcon,
    onCancel,
    sender: 'cecileb',
    topLine: 'you requested Lumens worth',
    txVerb: 'requested',
  } as Props

  const youSendProps = {
    ...commonProps,
    amountNominal: '$1',
    balanceChange: '-170.6827309 XLM',
    icon: sendIcon,
    onSeeDetails,
    sender: 'cecileb',
    topLine: 'you sent Lumens worth',
    txVerb: 'sent',
  } as Props

  const youReceiveBTCProps = {
    ...commonProps,
    amountNominal: '1 BTC',
    balanceChange: '+1 BTC',
    bottomLine: 'stronghold.com',
    icon: receiveIcon,
    onSeeDetails,
    sender: 'kamel',
    topLine: 'you received',
    txVerb: 'sent',
  } as Props

  const youSendBTCProps = {
    ...commonProps,
    amountNominal: '1 BTC',
    balanceChange: '-1 BTC',
    bottomLine: 'stronghold.com',
    icon: sendIcon,
    onSeeDetails,
    sender: 'cecileb',
    topLine: 'you sent',
    txVerb: 'sent',
  } as Props

  const youSendBTCFromXLMProps = {
    ...commonProps,
    amountNominal: '1 BTC',
    balanceChange: '-10.2178468 XLM',
    bottomLine: 'stronghold.com',
    icon: sendIcon,
    onSeeDetails,
    sender: 'cecileb',
    topLine: 'you sent',
    txVerb: 'sent',
  } as Props

  const youSendXLMProps = {
    ...commonProps,
    amountNominal: '1 XLM',
    approxWorth: '$901.23 USD',
    balanceChange: '-1 XLM',
    icon: sendIcon,
    onSeeDetails,
    sender: 'cecileb',
    topLine: 'you sent',
    txVerb: 'sent',
  } as Props

  const pendingPaymentProps = {
    ...youSendXLMProps,
    status: 'pending',
    topLine: 'pending',
  }

  const loadingProps = {
    ...commonProps,
    amountNominal: '',
    balanceChange: '',
    icon: sendIcon,
    loading: true,
    sender: '',
    topLine: '',
    txVerb: 'sent',
  } as Props

  const completedProps = {
    ...theyRequestProps,
    status: 'completed',
  } as Props

  const canceledProps = {
    ...theyRequestProps,
    status: 'canceled',
  } as Props
  Sb.storiesOf('Chat/Conversation/Message popup/Payments', module)
    .add('They request Lumens', () => <PaymentPopupMoved {...theyRequestProps} />)
    .add('You receive Lumens', () => (
      <PaymentPopupMoved {...youReceiveProps} balanceChangeColor={S.globalColors.greenDark} />
    ))
    .add('You request Lumens', () => <PaymentPopupMoved {...youRequestProps} />)
    .add('You send Lumens', () => (
      <PaymentPopupMoved {...youSendProps} balanceChangeColor={S.globalColors.black} />
    ))
    .add('You receive BTC', () => (
      <PaymentPopupMoved {...youReceiveBTCProps} balanceChangeColor={S.globalColors.greenDark} />
    ))
    .add('You send BTC', () => (
      <PaymentPopupMoved {...youSendBTCProps} balanceChangeColor={S.globalColors.black} />
    ))
    .add('You send BTC from XLM', () => (
      <PaymentPopupMoved {...youSendBTCFromXLMProps} balanceChangeColor={S.globalColors.black} />
    ))
    .add('You send XLM', () => (
      <PaymentPopupMoved {...youSendXLMProps} balanceChangeColor={S.globalColors.black} />
    ))
    .add('Pending', () => (
      <PaymentPopupMoved {...pendingPaymentProps} balanceChangeColor={S.globalColors.black} />
    ))
    .add('Completed request', () => <PaymentPopupMoved {...completedProps} />)
    .add('Canceled request', () => <PaymentPopupMoved {...canceledProps} />)
    .add('Loading', () => <PaymentPopupMoved {...loadingProps} />)
}

type State = {
  ref: Kb.Box | null
}

class PaymentPopupMoved extends React.Component<Props, State> {
  state = {ref: null}
  render() {
    return (
      <>
        <Kb.Box
          style={{left: 20, position: 'absolute', top: 20}}
          ref={ref => this.setState(s => (s.ref ? null : {ref}))}
        />
        <PaymentPopup {...(this.props as Props)} attachTo={() => this.state.ref} />
      </>
    )
  }
}

export default load

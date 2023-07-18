import * as ConfigConstants from '../../../../constants/config'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import AccountPayment from '.'
import shallowEqual from 'shallowequal'
import type * as Types from '../../../../constants/types/chat2'
import type * as WalletTypes from '../../../../constants/types/wallets'

// Props for rendering the loading indicator
const loadingProps = {
  _paymentID: undefined,
  action: '',
  amount: '',
  approxWorth: '',
  balanceChange: '',
  balanceChangeColor: undefined,
  cancelButtonInfo: '',
  cancelButtonLabel: '',
  canceled: false,
  claimButtonLabel: '',
  icon: 'iconfont-stellar-send',
  loading: true,
  memo: '',
  pending: false,
  sendButtonLabel: '',
  showCoinsIcon: false,
  sourceAmount: '',
} as const

const failedProps = {
  ...loadingProps,
  loading: false,
}

// Get action phrase for sendPayment msg
const makeSendPaymentVerb = (status: WalletTypes.StatusSimplified, youAreSender: boolean) => {
  switch (status) {
    case 'pending':
      return 'sending'
    case 'canceled': // fallthrough
    case 'claimable':
      return youAreSender ? 'sending' : 'attempting to send'
    case 'error':
      return youAreSender ? 'attempted to send' : 'attempted to send'
    default:
      return 'sent'
  }
}

type OwnProps = {
  message: Types.MessageSendPayment | Types.MessageRequestPayment
}

const ConnectedAccountPayment = (ownProps: OwnProps) => {
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const stateProps = Container.useSelector(state => {
    const youAreSender = ownProps.message.author === you
    switch (ownProps.message.type) {
      case 'sendPayment': {
        const paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
        if (!paymentInfo) {
          // waiting for service to load it (missed service cache on loading thread)
          return loadingProps
        }

        const cancelable = paymentInfo.status === 'claimable'
        const pending = cancelable || paymentInfo.status === 'pending'
        const canceled = paymentInfo.status === 'canceled'
        const completed = paymentInfo.status === 'completed'
        const verb = makeSendPaymentVerb(paymentInfo.status, youAreSender)
        const sourceAmountDesc = `${paymentInfo.sourceAmount} ${paymentInfo.sourceAsset.code || 'XLM'}`

        const amountDescription = paymentInfo.sourceAmount
          ? `${paymentInfo.amountDescription}/${paymentInfo.issuerDescription}`
          : paymentInfo.amountDescription
        const amount = paymentInfo.worth ? paymentInfo.worth : amountDescription
        return {
          _paymentID: paymentInfo.paymentID,
          action: paymentInfo.worth ? `${verb} Lumens worth` : verb,
          amount,
          approxWorth: paymentInfo.worthAtSendTime,
          balanceChange: '',
          balanceChangeColor: Styles.globalColors.black,
          cancelButtonInfo: '',
          cancelButtonLabel: paymentInfo.showCancel ? 'Cancel' : '',
          canceled,
          claimButtonLabel: '',
          icon: pending ? ('iconfont-clock' as const) : undefined,
          loading: false,
          memo: paymentInfo.note.stringValue(),
          pending: pending || canceled,
          sendButtonLabel: '',
          showCoinsIcon: completed,
          sourceAmount: paymentInfo.sourceAmount.length ? sourceAmountDesc : '',
        }
      }
      case 'requestPayment': {
        const message = ownProps.message
        const requestInfo = Constants.getRequestMessageInfo(state, message)
        if (!requestInfo) {
          // waiting for service to load it
          return loadingProps
        }
        const {amountDescription, asset, canceled, done} = requestInfo
        return {
          _paymentID: undefined,
          action: asset === 'currency' ? 'requested Lumens worth' : 'requested',
          amount: amountDescription,
          approxWorth: requestInfo.worthAtRequestTime,
          balanceChange: '',
          balanceChangeColor: undefined,
          cancelButtonInfo: '',
          cancelButtonLabel: '',
          canceled,
          claimButtonLabel: '',
          icon: 'iconfont-stellar-request' as const,
          loading: false,
          memo: message.note.stringValue(),
          pending: false,
          sendButtonLabel:
            youAreSender || canceled || done
              ? ''
              : `Send${requestInfo.asset === 'currency' ? ' Lumens worth ' : ' '}`,
          showCoinsIcon: false,
        }
      }
      default:
        return failedProps
    }
  }, shallowEqual)

  const props = {
    action: stateProps.action,
    amount: stateProps.amount,
    approxWorth: stateProps.approxWorth,
    balanceChange: stateProps.balanceChange,
    balanceChangeColor: stateProps.balanceChangeColor,
    cancelButtonInfo: stateProps.cancelButtonInfo,
    cancelButtonLabel: stateProps.cancelButtonLabel,
    canceled: stateProps.canceled,
    claimButtonLabel: stateProps.claimButtonLabel,
    icon: stateProps.icon,
    loading: stateProps.loading,
    memo: stateProps.memo,
    pending: stateProps.pending,
    sendButtonLabel: stateProps.sendButtonLabel || '',
    showCoinsIcon: stateProps.showCoinsIcon,
    sourceAmount: stateProps.sourceAmount,
  }
  if (
    !stateProps.loading &&
    ownProps.message.type !== 'sendPayment' &&
    ownProps.message.type !== 'requestPayment'
  ) {
    return null
  }
  return <AccountPayment {...props} />
}
export default ConnectedAccountPayment

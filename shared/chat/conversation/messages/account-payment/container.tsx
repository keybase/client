import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as ConfigConstants from '../../../../constants/config'
import * as WalletConstants from '../../../../constants/wallets'
import type * as WalletTypes from '../../../../constants/types/wallets'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import AccountPayment from '.'
import shallowEqual from 'shallowequal'

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
  const {message} = ownProps
  const {conversationIDKey, ordinal} = message
  // TODO not huge selector
  const you = ConfigConstants.useConfigState(s => s.username)
  const stateProps = Container.useSelector(state => {
    const acceptedDisclaimer = WalletConstants.getAcceptedDisclaimer(state)
    const youAreSender = ownProps.message.author === you
    switch (ownProps.message.type) {
      case 'sendPayment': {
        const paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
        if (!paymentInfo) {
          // waiting for service to load it (missed service cache on loading thread)
          return loadingProps
        }

        // find the other participant's username
        const participantInfo = Constants.getParticipantInfo(state, ownProps.message.conversationIDKey)
        const theirUsername = participantInfo.name.find(p => p !== you) || ''

        const cancelable = paymentInfo.status === 'claimable'
        const pending = cancelable || paymentInfo.status === 'pending'
        const canceled = paymentInfo.status === 'canceled'
        const completed = paymentInfo.status === 'completed'
        const verb = makeSendPaymentVerb(paymentInfo.status, youAreSender)
        const sourceAmountDesc = `${paymentInfo.sourceAmount} ${paymentInfo.sourceAsset.code || 'XLM'}`
        const balanceChangeAmount =
          paymentInfo.sourceAmount.length && paymentInfo.delta === 'decrease'
            ? sourceAmountDesc
            : paymentInfo.amountDescription

        const amountDescription = paymentInfo.sourceAmount
          ? `${paymentInfo.amountDescription}/${paymentInfo.issuerDescription}`
          : paymentInfo.amountDescription
        const amount = paymentInfo.worth ? paymentInfo.worth : amountDescription
        return {
          _paymentID: paymentInfo.paymentID,
          action: paymentInfo.worth ? `${verb} Lumens worth` : verb,
          amount,
          approxWorth: paymentInfo.worthAtSendTime,
          balanceChange: completed
            ? `${WalletConstants.balanceChangeSign(paymentInfo.delta, balanceChangeAmount)}`
            : '',
          balanceChangeColor: WalletConstants.getBalanceChangeColor(paymentInfo.delta, paymentInfo.status),
          cancelButtonInfo: paymentInfo.showCancel ? WalletConstants.makeCancelButtonInfo(theirUsername) : '',
          cancelButtonLabel: paymentInfo.showCancel ? 'Cancel' : '',
          canceled,
          claimButtonLabel:
            !youAreSender && cancelable && !acceptedDisclaimer
              ? `Claim${paymentInfo.worth ? ' Lumens worth' : ''}`
              : '',
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

  const dispatch = Container.useDispatch()

  const _onCancel = (paymentID?: WalletTypes.PaymentID) => {
    if (paymentID) {
      dispatch(WalletsGen.createCancelPayment({paymentID}))
    }
  }
  const onClaim = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
  }
  const onSend = () => {
    dispatch(Chat2Gen.createPrepareFulfillRequestForm({conversationIDKey, ordinal}))
  }
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
    onCancel: () => _onCancel(stateProps._paymentID),
    onClaim: onClaim,
    onSend: onSend,
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

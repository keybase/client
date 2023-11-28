import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import AccountPayment from '.'

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
const makeSendPaymentVerb = (status: T.Wallets.StatusSimplified, youAreSender: boolean) => {
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
  message: T.Chat.MessageSendPayment | T.Chat.MessageRequestPayment
}

const getRequestMessageInfo = (
  accountsInfoMap: C.Chat.ConvoState['accountsInfoMap'],
  message: T.Chat.MessageRequestPayment
) => {
  const maybeRequestInfo = accountsInfoMap.get(message.id)
  if (!maybeRequestInfo) {
    return message.requestInfo
  }
  if (maybeRequestInfo.type === 'requestInfo') {
    return maybeRequestInfo
  }
  throw new Error(
    `Found impossible type ${maybeRequestInfo.type} in info meant for requestPayment message. convID: ${message.conversationIDKey} msgID: ${message.id}`
  )
}

const ConnectedAccountPayment = (ownProps: OwnProps) => {
  const you = C.useCurrentUserState(s => s.username)
  const accountsInfoMap = C.useChatContext(s => s.accountsInfoMap)

  const stateProps = (() => {
    const youAreSender = ownProps.message.author === you
    switch (ownProps.message.type) {
      case 'sendPayment': {
        const paymentInfo = C.Chat.getPaymentMessageInfo(accountsInfoMap, ownProps.message)
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
          balanceChangeColor: Kb.Styles.globalColors.black,
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
        const requestInfo = getRequestMessageInfo(accountsInfoMap, message)
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
  })()

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
  return <AccountPayment {...props} />
}
export default ConnectedAccountPayment

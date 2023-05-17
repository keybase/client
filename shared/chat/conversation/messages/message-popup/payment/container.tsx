import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as React from 'react'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as WalletConstants from '../../../../../constants/wallets'
import * as WalletGen from '../../../../../actions/wallets-gen'
import PaymentPopup from '.'
import type * as Types from '../../../../../constants/types/chat2'
import type * as WalletTypes from '../../../../../constants/types/wallets'
import type {Position} from '../../../../../styles'
import type {StylesCrossPlatform} from '../../../../../styles/css'
import {formatTimeForMessages} from '../../../../../util/timestamp'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  paymentID?: WalletTypes.PaymentID
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

type SendOwnProps = {
  message: Types.MessageSendPayment | Types.MessageText
} & OwnProps

type RequestOwnProps = {
  message: Types.MessageRequestPayment
} & OwnProps

const commonLoadingProps = {
  amountNominal: '',
  approxWorth: '',
  balanceChange: '',
  bottomLine: '',
  cancelButtonLabel: '',
  errorDetails: '',
  icon: 'sending' as const,
  loading: true,
  sender: '',
  senderDeviceName: '',
  status: '',
  timestamp: '',
  topLine: '',
  txVerb: 'sent' as const,
}

// MessageSendPayment ===================================
const getTopLineUser = (paymentInfo: Types.ChatPaymentInfo, sender: string, you: string) => {
  if (paymentInfo.status === 'pending') {
    return 'pending'
  } else if (paymentInfo.fromUsername === you) {
    return 'you sent'
  } else if (paymentInfo.toUsername === you) {
    return 'you received'
  } else {
    return sender + ' sent'
  }
}

export const SendPaymentPopup = (ownProps: SendOwnProps) => {
  const paymentInfo = Container.useSelector(state => {
    let paymentInfo = ownProps.paymentID
      ? state.chat2.paymentStatusMap.get(ownProps.paymentID) || undefined
      : undefined
    if (!paymentInfo && ownProps.message.type === 'sendPayment') {
      paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
    }
    return paymentInfo
  })
  const you = Container.useSelector(state => state.config.username)

  const dispatch = Container.useDispatch()
  const onCancel = (paymentID: WalletTypes.PaymentID) => {
    dispatch(WalletGen.createCancelPayment({paymentID}))
  }
  const onClaimLumens = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']}))
  }
  const onSeeDetails = (accountID: WalletTypes.AccountID, paymentID: WalletTypes.PaymentID) => {
    dispatch(WalletGen.createShowTransaction({accountID, paymentID}))
  }
  const props = (() => {
    if (ownProps.message.type !== 'sendPayment' && ownProps.message.type !== 'text') {
      return null
    }
    if (!paymentInfo) {
      return {
        ...commonLoadingProps,
        attachTo: ownProps.attachTo,
        onHidden: ownProps.onHidden,
        position: ownProps.position,
        visible: ownProps.visible,
      }
    }
    const youAreSender = you === paymentInfo.fromUsername
    const youAreReceiver = you === paymentInfo.toUsername

    const sourceAmountDesc = `${paymentInfo.sourceAmount} ${paymentInfo.sourceAsset.code || 'XLM'}`
    const balanceChangeAmount =
      paymentInfo.sourceAmount.length && paymentInfo.delta === 'decrease'
        ? sourceAmountDesc
        : paymentInfo.amountDescription

    return {
      amountNominal: paymentInfo.worth || paymentInfo.amountDescription,
      approxWorth: paymentInfo.worthAtSendTime,
      attachTo: ownProps.attachTo,
      balanceChange: `${WalletConstants.balanceChangeSign(paymentInfo.delta, balanceChangeAmount)}`,
      balanceChangeColor: WalletConstants.getBalanceChangeColor(paymentInfo.delta, paymentInfo.status),
      bottomLine: paymentInfo.issuerDescription,
      cancelButtonLabel: 'Cancel',
      errorDetails:
        paymentInfo.status === 'error' ||
        paymentInfo.status === 'canceled' ||
        paymentInfo.status === 'claimable'
          ? paymentInfo.statusDetail
          : '',
      icon: paymentInfo.delta === 'increase' ? ('receiving' as const) : ('sending' as const),
      loading: false,
      onCancel: paymentInfo.showCancel ? () => onCancel(paymentInfo.paymentID) : undefined,
      onClaimLumens: paymentInfo.status === 'claimable' && !youAreSender ? onClaimLumens : undefined,
      onHidden: ownProps.onHidden,
      onSeeDetails:
        (paymentInfo.status === 'completed' ||
          paymentInfo.status === 'error' ||
          paymentInfo.status === 'pending' ||
          paymentInfo.status === 'claimable' ||
          paymentInfo.status === 'canceled') &&
        (youAreSender || youAreReceiver)
          ? () => onSeeDetails(paymentInfo.accountID, paymentInfo.paymentID)
          : undefined,
      position: ownProps.position,
      sender: ownProps.message.author,
      senderDeviceName: ownProps.message.deviceName,
      status: paymentInfo.status,
      style: ownProps.style,
      timestamp: formatTimeForMessages(ownProps.message.timestamp),
      topLine: `${getTopLineUser(paymentInfo, ownProps.message.author, you)}${
        paymentInfo.worth ? ' Lumens worth' : ''
      }`,
      txVerb: 'sent' as const,
      visible: ownProps.visible,
    }
  })()

  if (props === null) return null

  return <PaymentPopup {...props} />
}

const RequestPaymentPopup = (ownProps: RequestOwnProps) => {
  const you = Container.useSelector(state => state.config.username)
  const requestInfo = Container.useSelector(state => Constants.getRequestMessageInfo(state, ownProps.message))

  const dispatch = Container.useDispatch()
  const onCancel = () => {
    if (ownProps.message.type !== 'requestPayment') {
      // @ts-ignore TS also says this is impossible!
      throw new Error(`RequestPaymentPopup: impossible case encountered: ${ownProps.message.type}`)
    }
    dispatch(
      WalletGen.createCancelRequest({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
        requestID: ownProps.message.requestID,
      })
    )
  }
  const {message} = ownProps
  if (message.type !== 'requestPayment') {
    // @ts-ignore TS also says this is impossible!
    throw new Error(`RequestPaymentPopup: impossible case encountered: ${message.type}`)
  }
  const props = (() => {
    if (!requestInfo) {
      return {
        ...commonLoadingProps,
        attachTo: ownProps.attachTo,
        onHidden: ownProps.onHidden,
        position: ownProps.position,
        visible: ownProps.visible,
      }
    }

    let bottomLine = ''
    if (requestInfo.asset !== 'native' && requestInfo.asset !== 'currency') {
      bottomLine = requestInfo.asset.issuerVerifiedDomain || requestInfo.asset.issuerAccountID || ''
    }

    const topLine = `${ownProps.message.author === you ? 'you requested' : 'requested'}${
      requestInfo.asset === 'currency' ? ' Lumens worth' : ''
    }`

    let status = ''
    if (requestInfo.canceled) {
      status = 'canceled'
    } else if (requestInfo.done) {
      status = 'completed'
    }

    return {
      amountNominal: requestInfo.amountDescription,
      approxWorth: '',
      attachTo: ownProps.attachTo,
      balanceChange: '',
      bottomLine,
      cancelButtonLabel: 'Cancel request',
      errorDetails: '',
      icon: 'receiving' as const,
      loading: false,
      onCancel:
        ownProps.message.author === you && !(requestInfo.done || requestInfo.canceled) ? onCancel : undefined,
      onHidden: ownProps.onHidden,
      position: ownProps.position,
      sender: ownProps.message.author,
      senderDeviceName: ownProps.message.deviceName,
      status,
      style: ownProps.style,
      timestamp: formatTimeForMessages(ownProps.message.timestamp),
      topLine,
      txVerb: 'requested' as const,
      visible: ownProps.visible,
    }
  })()
  return <PaymentPopup {...props} />
}

// Wrapper ==============================================
const PaymentPopupChooser = (props: OwnProps) => {
  const {conversationIDKey, ordinal} = props
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  if (!message) return null

  if (message.type === 'sendPayment') {
    return <SendPaymentPopup {...props} message={message} />
  } else if (message.type === 'requestPayment') {
    return <RequestPaymentPopup {...props} message={message} />
  }
  return null
}

export default PaymentPopupChooser

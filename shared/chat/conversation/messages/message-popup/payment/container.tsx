import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as WalletConstants from '../../../../../constants/wallets'
import * as WalletTypes from '../../../../../constants/types/wallets'
import * as WalletGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {formatTimeForMessages} from '../../../../../util/timestamp'
import PaymentPopup from '.'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  message: Types.MessageRequestPayment | Types.MessageSendPayment | Types.MessageText
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
  balanceChangeColor: undefined,
  bottomLine: '',
  cancelButtonLabel: '',
  errorDetails: '',
  icon: 'sending' as const,
  loading: true,
  onCancel: null,
  onClaimLumens: null,
  onSeeDetails: null,
  sender: '',
  senderDeviceName: '',
  status: '',
  style: undefined,
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

export const SendPaymentPopup = Container.namedConnect(
  (state, ownProps: SendOwnProps) => {
    let paymentInfo = ownProps.paymentID ? state.chat2.paymentStatusMap.get(ownProps.paymentID) || null : null
    if (!paymentInfo && ownProps.message.type === 'sendPayment') {
      paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
    }
    return {
      _you: state.config.username,
      paymentInfo,
    }
  },
  dispatch => ({
    onCancel: (paymentID: WalletTypes.PaymentID) => dispatch(WalletGen.createCancelPayment({paymentID})),
    onClaimLumens: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['walletOnboarding']})),
    onSeeDetails: (accountID: WalletTypes.AccountID, paymentID: WalletTypes.PaymentID) =>
      dispatch(WalletGen.createShowTransaction({accountID, paymentID})),
  }),
  (stateProps, dispatchProps, ownProps: SendOwnProps) => {
    if (ownProps.message.type !== 'sendPayment' && ownProps.message.type !== 'text') {
      throw new Error(`SendPaymentPopup: impossible case encountered: ${ownProps.message.type}`)
    }
    const {paymentInfo} = stateProps
    if (!paymentInfo) {
      return {
        ...commonLoadingProps,
        attachTo: ownProps.attachTo,
        onHidden: ownProps.onHidden,
        position: ownProps.position,
        visible: ownProps.visible,
      }
    }
    const {_you: you} = stateProps
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
      onCancel: paymentInfo.showCancel ? () => dispatchProps.onCancel(paymentInfo.paymentID) : null,
      onClaimLumens: paymentInfo.status === 'claimable' && !youAreSender ? dispatchProps.onClaimLumens : null,
      onHidden: ownProps.onHidden,
      onSeeDetails:
        (paymentInfo.status === 'completed' ||
          paymentInfo.status === 'error' ||
          paymentInfo.status === 'pending' ||
          paymentInfo.status === 'claimable' ||
          paymentInfo.status === 'canceled') &&
        (youAreSender || youAreReceiver)
          ? () => dispatchProps.onSeeDetails(paymentInfo.accountID, paymentInfo.paymentID)
          : null,
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
  },
  'PaymentPopup'
)(PaymentPopup)

// MessageRequestPayment ================================
const RequestPaymentPopup = Container.namedConnect(
  (state, ownProps: RequestOwnProps) => ({
    _you: state.config.username,
    requestInfo: Constants.getRequestMessageInfo(state, ownProps.message),
  }),
  (dispatch, ownProps: RequestOwnProps) => ({
    onCancel: () => {
      if (ownProps.message.type !== 'requestPayment') {
        throw new Error(`RequestPaymentPopup: impossible case encountered: ${ownProps.message.type}`)
      }
      dispatch(
        WalletGen.createCancelRequest({
          conversationIDKey: ownProps.message.conversationIDKey,
          ordinal: ownProps.message.ordinal,
          requestID: ownProps.message.requestID,
        })
      )
    },
  }),
  (stateProps, dispatchProps, ownProps: RequestOwnProps) => {
    const {_you: you} = stateProps
    const {message} = ownProps
    if (message.type !== 'requestPayment') {
      throw new Error(`RequestPaymentPopup: impossible case encountered: ${message.type}`)
    }
    const {requestInfo} = stateProps
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
      balanceChangeColor: undefined,
      bottomLine,
      cancelButtonLabel: 'Cancel request',
      errorDetails: '',
      icon: 'receiving' as const,
      loading: false,
      onCancel:
        ownProps.message.author === you && !(requestInfo.done || requestInfo.canceled)
          ? dispatchProps.onCancel
          : null,
      onClaimLumens: null,
      onHidden: ownProps.onHidden,
      onSeeDetails: null,
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
  },
  'PaymentPopup'
)(PaymentPopup)

// Wrapper ==============================================
const PaymentPopupChooser = (props: OwnProps) => {
  const {message, ...rest} = props
  if (message.type === 'sendPayment') {
    return <SendPaymentPopup {...rest} message={message} />
  } else if (message.type === 'requestPayment') {
    return <RequestPaymentPopup {...rest} message={message} />
  }
  throw new Error(`PaymentPopup: impossible case encountered: ${message.type}`)
}

export default PaymentPopupChooser

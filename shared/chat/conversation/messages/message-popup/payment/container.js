// @flow
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
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'
import type {StylesCrossPlatform} from '../../../../../styles/css'

// This file has two connectors and a wrapper. One connector is for sendPayment
// and the other for requestPayment. The wrapper decides which to use.

type OwnProps = {|
  attachTo: () => ?React.Component<any>,
  message: Types.MessageRequestPayment | Types.MessageSendPayment | Types.MessageText,
  paymentID?: WalletTypes.PaymentID,
  onHidden: () => void,
  position: Position,
  style?: StylesCrossPlatform,
  visible: boolean,
|}

type SendOwnProps = {|
  ...OwnProps,
  message: Types.MessageSendPayment | Types.MessageText,
|}

type RequestOwnProps = {
  ...OwnProps,
  message: Types.MessageRequestPayment,
}

const commonLoadingProps = {
  amountNominal: '',
  balanceChange: '',
  balanceChangeColor: '',
  bottomLine: '',
  cancelButtonLabel: '',
  icon: 'sending',
  loading: true,
  onCancel: null,
  onClaimLumens: null,
  onSeeDetails: null,
  sender: '',
  senderDeviceName: '',
  timestamp: '',
  topLine: '',
  txVerb: 'sent',
}

// MessageSendPayment ===================================
const sendMapStateToProps = (state, ownProps: SendOwnProps) => {
  let paymentInfo = ownProps.paymentID
    ? state.chat2.getIn(['paymentStatusMap', ownProps.paymentID], null)
    : null
  if (!paymentInfo && ownProps.message.type === 'sendPayment') {
    paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
  }
  return {
    _you: state.config.username,
    paymentInfo,
  }
}

const sendMapDispatchToProps = dispatch => ({
  onCancel: (paymentID: WalletTypes.PaymentID) => dispatch(WalletGen.createCancelPayment({paymentID})),
  onClaimLumens: () =>
    dispatch(
      Container.isMobile
        ? RouteTreeGen.createNavigateTo({path: WalletConstants.rootWalletPath})
        : RouteTreeGen.createSwitchTo({path: WalletConstants.rootWalletPath})
    ),
  onSeeDetails: (accountID: WalletTypes.AccountID, paymentID: WalletTypes.PaymentID) => {
    dispatch(WalletGen.createSelectAccount({accountID}))
    dispatch(
      RouteTreeGen.createNavigateTo({
        path: [
          ...WalletConstants.rootWalletPath,
          'wallet',
          {props: {accountID, paymentID}, selected: 'transactionDetails'},
        ],
      })
    )
  },
})

const getTopLineUser = (paymentInfo, sender, you) => {
  if (paymentInfo.fromUsername === you) {
    return 'you sent'
  } else if (paymentInfo.toUsername === you) {
    return 'you received'
  } else {
    return sender + ' sent'
  }
}

const sendMergeProps = (stateProps, dispatchProps, ownProps: SendOwnProps) => {
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
  return {
    amountNominal: paymentInfo.worth || paymentInfo.amountDescription,
    attachTo: ownProps.attachTo,
    balanceChange: `${WalletConstants.balanceChangeSign(paymentInfo.delta, paymentInfo.amountDescription)}`,
    balanceChangeColor: WalletConstants.balanceChangeColor(paymentInfo.delta, paymentInfo.status),
    bottomLine: '', // TODO on asset support in payment
    cancelButtonLabel: 'Cancel',
    errorDetails:
      paymentInfo.status === 'error' ||
      paymentInfo.status === 'canceled' ||
      paymentInfo.status === 'claimable'
        ? paymentInfo.statusDetail
        : undefined,
    icon: paymentInfo.delta === 'increase' ? 'receiving' : 'sending',
    loading: false,
    onCancel: paymentInfo.showCancel ? () => dispatchProps.onCancel(paymentInfo.paymentID) : null,
    onClaimLumens: paymentInfo.status === 'cancelable' && !youAreSender ? dispatchProps.onClaimLumens : null,
    onHidden: ownProps.onHidden,
    onSeeDetails:
      (paymentInfo.status === 'completed' ||
        paymentInfo.status === 'error' ||
        paymentInfo.status === 'claimable' ||
        paymentInfo.status === 'canceled') &&
      (youAreSender || youAreReceiver)
        ? () => dispatchProps.onSeeDetails(paymentInfo.accountID, paymentInfo.paymentID)
        : null,
    position: ownProps.position,
    sender: ownProps.message.author,
    senderDeviceName: ownProps.message.deviceName,
    style: ownProps.style,
    timestamp: formatTimeForMessages(ownProps.message.timestamp),
    topLine: `${getTopLineUser(paymentInfo, ownProps.message.author, you)}${
      paymentInfo.worth ? ' Lumens worth' : ''
    }`,
    txVerb: 'sent',
    visible: ownProps.visible,
  }
}

export const SendPaymentPopup = Container.connect<SendOwnProps, _, _, _, _>(
  sendMapStateToProps,
  sendMapDispatchToProps,
  sendMergeProps
)(PaymentPopup)

// MessageRequestPayment ================================
const requestMapStateToProps = (state, ownProps: RequestOwnProps) => ({
  _you: state.config.username,
  requestInfo: Constants.getRequestMessageInfo(state, ownProps.message),
})

const requestMapDispatchToProps = (dispatch, ownProps: RequestOwnProps) => ({
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
})

const requestMergeProps = (stateProps, dispatchProps, ownProps: RequestOwnProps) => {
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

  let topLine = `${ownProps.message.author === you ? 'you requested' : 'requested'}${
    requestInfo.asset === 'currency' ? ' Lumens worth' : ''
  }`

  return {
    amountNominal: requestInfo.amountDescription,
    attachTo: ownProps.attachTo,
    balanceChange: '',
    balanceChangeColor: '',
    bottomLine,
    cancelButtonLabel: 'Cancel request',
    icon: 'receiving',
    loading: false,
    onCancel: ownProps.message.author === you ? dispatchProps.onCancel : null,
    onClaimLumens: null,
    onHidden: ownProps.onHidden,
    onSeeDetails: null,
    position: ownProps.position,
    sender: ownProps.message.author,
    senderDeviceName: ownProps.message.deviceName,
    style: ownProps.style,
    timestamp: formatTimeForMessages(ownProps.message.timestamp),
    topLine,
    txVerb: 'requested',
    visible: ownProps.visible,
  }
}

const RequestPaymentPopup = Container.connect<RequestOwnProps, _, _, _, _>(
  requestMapStateToProps,
  requestMapDispatchToProps,
  requestMergeProps
)(PaymentPopup)

// Wrapper ==============================================
const PaymentPopupChooser = (props: OwnProps) => {
  switch (props.message.type) {
    case 'sendPayment':
      // $FlowIssue doesn't understand message is the right type
      return <SendPaymentPopup {...props} />
    case 'requestPayment':
      // $FlowIssue doesn't understand message is the right type
      return <RequestPaymentPopup {...props} />
    default:
      throw new Error(`PaymentPopup: impossible case encountered: ${props.message.type}`)
  }
}

export default PaymentPopupChooser

// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as WalletGen from '../../../../../actions/wallets-gen'
import * as Styles from '../../../../../styles'
import {formatTimeForMessages} from '../../../../../util/timestamp'
import PaymentPopup from '.'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

// This file has two connectors and a wrapper. One connector is for sendPayment
// and the other for requestPayment. The wrapper decides which to use.

type OwnProps = {|
  attachTo: () => ?React.Component<any>,
  message: Types.MessageRequestPayment | Types.MessageSendPayment,
  onHidden: () => void,
  position: Position,
  visible: boolean,
|}

type SendOwnProps = {|
  ...OwnProps,
  message: Types.MessageSendPayment,
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
  icon: 'sending',
  loading: true,
  onCancel: null,
  sender: '',
  senderDeviceName: '',
  timestamp: '',
  topLine: '',
  txVerb: 'sent',
}

// MessageSendPayment ===================================
const sendMapStateToProps = (state: Container.TypedState, ownProps: SendOwnProps) => ({
  paymentInfo: Constants.getPaymentMessageInfo(state, ownProps.message),
  _you: state.config.username,
})

const sendMergeProps = (stateProps, _, ownProps: SendOwnProps) => {
  if (ownProps.message.type !== 'sendPayment') {
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
  return {
    amountNominal: paymentInfo.worth || paymentInfo.amountDescription,
    attachTo: ownProps.attachTo,
    balanceChange: `${paymentInfo.delta === 'increase' ? '+' : '-'}${paymentInfo.amountDescription}`,
    balanceChangeColor:
      paymentInfo.delta === 'increase' ? Styles.globalColors.green2 : Styles.globalColors.red,
    bottomLine: '', // TODO on asset support in payment
    icon: paymentInfo.delta === 'increase' ? 'receiving' : 'sending',
    loading: false,
    onCancel: null,
    onHidden: ownProps.onHidden,
    position: ownProps.position,
    sender: ownProps.message.author,
    senderDeviceName: ownProps.message.deviceName,
    timestamp: formatTimeForMessages(ownProps.message.timestamp),
    topLine: `${ownProps.message.author === you ? 'you sent' : 'you received'}${
      paymentInfo.worth ? ' Lumens worth' : ''
    }`,
    txVerb: 'sent',
    visible: ownProps.visible,
  }
}

const SendPaymentPopup = Container.connect(sendMapStateToProps, () => ({}), sendMergeProps)(PaymentPopup)

// MessageRequestPayment ================================
const requestMapStateToProps = (state: Container.TypedState, ownProps: RequestOwnProps) => ({
  requestInfo: Constants.getRequestMessageInfo(state, ownProps.message),
  _you: state.config.username,
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
    bottomLine = requestInfo.asset.issuerName || requestInfo.asset.issuerAccountID || ''
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
    icon: 'receiving',
    loading: false,
    onCancel: ownProps.message.author === you ? dispatchProps.onCancel : null,
    onHidden: ownProps.onHidden,
    position: ownProps.position,
    sender: ownProps.message.author,
    senderDeviceName: ownProps.message.deviceName,
    timestamp: formatTimeForMessages(ownProps.message.timestamp),
    topLine,
    txVerb: 'requested',
    visible: ownProps.visible,
  }
}

const RequestPaymentPopup = Container.connect(
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

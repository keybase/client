// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/chat2'
import * as SettingsConstants from '../../../../../constants/settings'
import * as Types from '../../../../../constants/types/chat2'
import * as WalletConstants from '../../../../../constants/wallets'
import * as WalletTypes from '../../../../../constants/types/wallets'
import * as WalletGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as Tabs from '../../../../../constants/tabs'
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
const sendMapStateToProps = (state, ownProps: SendOwnProps) => ({
  paymentInfo: Constants.getPaymentMessageInfo(state, ownProps.message),
  _you: state.config.username,
})

const sendMapDispatchToProps = dispatch => ({
  onCancel: (paymentID: WalletTypes.PaymentID) => dispatch(WalletGen.createCancelPayment({paymentID})),
  onClaimLumens: () =>
    dispatch(
      Container.isMobile
        ? RouteTreeGen.createNavigateTo({path: [Tabs.settingsTab, SettingsConstants.walletsTab]})
        : RouteTreeGen.createSwitchTo({path: [Tabs.walletsTab]})
    ),
  onSeeDetails: (accountID: WalletTypes.AccountID, paymentID: WalletTypes.PaymentID) => {
    dispatch(WalletGen.createSelectAccount({accountID}))
    const root = Container.isMobile ? [Tabs.settingsTab, SettingsConstants.walletsTab] : [Tabs.walletsTab]
    dispatch(
      RouteTreeGen.createNavigateTo({
        path: [...root, 'wallet', {selected: 'transactionDetails', props: {accountID, paymentID}}],
      })
    )
  },
})

const sendMergeProps = (stateProps, dispatchProps, ownProps: SendOwnProps) => {
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
  const youAreSender = you === ownProps.message.author
  return {
    amountNominal: paymentInfo.worth || paymentInfo.amountDescription,
    attachTo: ownProps.attachTo,
    balanceChange: `${WalletConstants.balanceChangeSign(paymentInfo.delta, paymentInfo.amountDescription)}`,
    balanceChangeColor: WalletConstants.balanceChangeColor(paymentInfo.delta, paymentInfo.status),
    bottomLine: '', // TODO on asset support in payment
    cancelButtonLabel: 'Cancel',
    icon: paymentInfo.delta === 'increase' ? 'receiving' : 'sending',
    loading: false,
    onCancel:
      paymentInfo.status === 'cancelable' && youAreSender
        ? () => dispatchProps.onCancel(paymentInfo.paymentID)
        : null,
    onClaimLumens: paymentInfo.status === 'cancelable' && !youAreSender ? dispatchProps.onClaimLumens : null,
    onHidden: ownProps.onHidden,
    onSeeDetails:
      paymentInfo.status === 'completed'
        ? () => dispatchProps.onSeeDetails(paymentInfo.accountID, paymentInfo.paymentID)
        : null,
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

const SendPaymentPopup = Container.connect<SendOwnProps, _, _, _, _>(
  sendMapStateToProps,
  sendMapDispatchToProps,
  sendMergeProps
)(PaymentPopup)

// MessageRequestPayment ================================
const requestMapStateToProps = (state, ownProps: RequestOwnProps) => ({
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

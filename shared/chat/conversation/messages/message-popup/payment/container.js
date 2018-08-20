// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as ChatTypes from '../../../../../constants/types/chat2'
import * as WalletConstants from '../../../../../constants/wallets'
import PaymentPopup from '.'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

type OwnProps = {|
  attachTo: ?React.Component<any, any>,
  message: ChatTypes.MessageRequestPayment | ChatTypes.MessageSendPayment,
  onHidden: () => void,
  position: Position,
  visible: boolean,
|}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const accountID = WalletConstants.getDefaultAccountID(state)
  let _record = null
  if (ownProps.message.type === 'sendPayment') {
    if (accountID) {
      _record = WalletConstants.getPayment(state, accountID, ownProps.message.paymentID)
    }
  } else {
    _record = WalletConstants.getRequest(state, ownProps.message.requestID)
  }
  return {
    _record,
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onCancel: () => {},
})

// Props to show the loading indicator
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

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  if (!stateProps._record) {
    // haven't loaded details
    return {
      ...commonLoadingProps,
      attachTo: ownProps.attachTo,
      onHidden: ownProps.onHidden,
      position: ownProps.position,
      visible: ownProps.visible,
    }
  }
  const you = stateProps._you
  const message = ownProps.message
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
  }
}

const ConnectedPaymentPopup = Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(PaymentPopup)
export default ConnectedPaymentPopup

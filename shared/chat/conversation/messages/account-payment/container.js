// @flow
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as WalletConstants from '../../../../constants/wallets'
import * as WalletTypes from '../../../../constants/types/wallets'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../actions/wallets-gen'
import AccountPayment from '.'

// Props for rendering the loading indicator
const loadingProps = {
  _paymentID: null,
  action: '',
  amount: '',
  balanceChange: '',
  balanceChangeColor: '',
  cancelButtonInfo: '',
  cancelButtonLabel: '',
  canceled: false,
  claimButtonLabel: '',
  icon: 'iconfont-stellar-send',
  loading: true,
  memo: '',
  pending: false,
}

// Tooltip text for cancelable payments
const makeCancelButtonInfo = (username: string) =>
  `This transaction can be canceled because ${username} does not yet have a wallet. Encourage ${username} to claim this and set up a wallet.`

type OwnProps = {
  message: Types.MessageSendPayment | Types.MessageRequestPayment,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const acceptedDisclaimer = WalletConstants.getAcceptedDisclaimer(state)
  const you = state.config.username
  const youAreSender = ownProps.message.author === you
  switch (ownProps.message.type) {
    case 'sendPayment': {
      const paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
      if (!paymentInfo) {
        // waiting for service to load it (missed service cache on loading thread)
        return loadingProps
      }

      // find the other participant's username
      const conv = Constants.getMeta(state, ownProps.message.conversationIDKey)
      const theirUsername = conv.participants.find(p => p !== you) || ''

      const pending = ['pending', 'cancelable'].includes(paymentInfo.status)
      const canceled = paymentInfo.status === 'canceled'
      const cancelable = paymentInfo.status === 'cancelable'
      const verb = pending || canceled ? 'sending' : 'sent'
      return {
        _paymentID: paymentInfo.paymentID,
        action: paymentInfo.worth ? `${verb} Lumens worth` : verb,
        amount: paymentInfo.worth ? paymentInfo.worth : paymentInfo.amountDescription,
        balanceChange: `${WalletConstants.balanceChangeSign(
          paymentInfo.delta,
          paymentInfo.amountDescription
        )}`,
        balanceChangeColor: WalletConstants.balanceChangeColor(paymentInfo.delta, paymentInfo.status),
        cancelButtonInfo: youAreSender && cancelable ? makeCancelButtonInfo(theirUsername) : '',
        cancelButtonLabel: youAreSender && cancelable ? 'Cancel' : '',
        canceled,
        claimButtonLabel:
          !youAreSender && cancelable && !acceptedDisclaimer
            ? `Claim${paymentInfo.worth ? ' Lumens worth' : ''} ${paymentInfo.worth ||
                paymentInfo.amountDescription}`
            : '',
        icon: paymentInfo.status === 'pending' ? 'icon-transaction-pending-16' : 'iconfont-stellar-send',
        loading: false,
        memo: paymentInfo.note.stringValue(),
        pending,
        sendButtonLabel: '',
      }
    }
    case 'requestPayment': {
      const message = ownProps.message
      const requestInfo = Constants.getRequestMessageInfo(state, message)
      if (!requestInfo) {
        // waiting for service to load it
        return loadingProps
      }
      return {
        _paymentID: null,
        action: requestInfo.asset === 'currency' ? 'requested Lumens worth' : 'requested',
        amount: requestInfo.amountDescription,
        balanceChange: '',
        balanceChangeColor: '',
        cancelButtonInfo: '',
        cancelButtonLabel: '',
        canceled: false, // TODO
        claimButtonLabel: '',
        icon: 'iconfont-stellar-request',
        loading: false,
        memo: message.note.stringValue(),
        pending: false,
        sendButtonLabel: youAreSender
          ? ''
          : `Send${requestInfo.asset === 'currency' ? ' Lumens worth ' : ' '}${
              requestInfo.amountDescription
            }`,
      }
    }
    default:
      throw new Error(`AccountPayment: impossible case encountered: '${ownProps.message.type}'`)
  }
}

const mapDispatchToProps = (dispatch, {message: {conversationIDKey, ordinal}}) => ({
  _onCancel: (paymentID: ?WalletTypes.PaymentID) => {
    if (paymentID) {
      dispatch(WalletsGen.createCancelPayment({paymentID}))
    }
  },
  onClaim: () => {}, // TODO nav to wallets accept disclaimer flow
  onSend: () => dispatch(Chat2Gen.createPrepareFulfillRequestForm({conversationIDKey, ordinal})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  action: stateProps.action,
  amount: stateProps.amount,
  balanceChange: stateProps.balanceChange,
  balanceChangeColor: stateProps.balanceChangeColor,
  cancelButtonInfo: stateProps.cancelButtonInfo,
  cancelButtonLabel: stateProps.cancelButtonLabel,
  canceled: stateProps.canceled,
  claimButtonLabel: stateProps.claimButtonLabel,
  icon: stateProps.icon,
  loading: stateProps.loading,
  memo: stateProps.memo,
  onCancel: () => dispatchProps._onCancel(stateProps._paymentID),
  onClaim: dispatchProps.onClaim,
  onSend: dispatchProps.onSend,
  pending: stateProps.pending,
  sendButtonLabel: stateProps.sendButtonLabel || '',
})

const ConnectedAccountPayment = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(AccountPayment)
export default ConnectedAccountPayment

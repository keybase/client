// @flow
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as WalletConstants from '../../../../constants/wallets'
import * as WalletTypes from '../../../../constants/types/wallets'
import * as Tabs from '../../../../constants/tabs'
import * as SettingsTabs from '../../../../constants/settings'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import AccountPayment from '.'

// Props for rendering the loading indicator
const loadingProps = {
  _paymentID: null,
  action: '',
  amount: '',
  approxWorth: '',
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
  showCoinsIcon: false,
}

// Info text for cancelable payments
const makeCancelButtonInfo = (username: string) => `${username} can claim this when they set up their wallet.`

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

      const cancelable = paymentInfo.status === 'claimable'
      const pending = cancelable || paymentInfo.status === 'pending'
      const canceled = paymentInfo.status === 'canceled'
      const completed = paymentInfo.status === 'completed'
      const verb = makeSendPaymentVerb(paymentInfo.status, youAreSender)
      return {
        _paymentID: paymentInfo.paymentID,
        action: paymentInfo.worth ? `${verb} Lumens worth` : verb,
        amount: paymentInfo.worth ? paymentInfo.worth : paymentInfo.amountDescription,
        approxWorth: paymentInfo.worthAtSendTime,
        balanceChange: completed
          ? `${WalletConstants.balanceChangeSign(paymentInfo.delta, paymentInfo.amountDescription)}`
          : '',
        balanceChangeColor: WalletConstants.balanceChangeColor(paymentInfo.delta, paymentInfo.status),
        cancelButtonInfo: paymentInfo.showCancel ? makeCancelButtonInfo(theirUsername) : '',
        cancelButtonLabel: paymentInfo.showCancel ? 'Cancel' : '',
        canceled,
        claimButtonLabel:
          !youAreSender && cancelable && !acceptedDisclaimer
            ? `Claim${paymentInfo.worth ? ' Lumens worth' : ''}`
            : '',
        icon: pending ? 'iconfont-clock' : null,
        loading: false,
        memo: paymentInfo.note.stringValue(),
        pending: pending || canceled,
        sendButtonLabel: '',
        showCoinsIcon: completed,
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
        _paymentID: null,
        action: asset === 'currency' ? 'requested Lumens worth' : 'requested',
        amount: amountDescription,
        approxWorth: requestInfo.worthAtRequestTime,
        balanceChange: '',
        balanceChangeColor: '',
        cancelButtonInfo: '',
        cancelButtonLabel: '',
        canceled,
        claimButtonLabel: '',
        icon: 'iconfont-stellar-request',
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
      throw new Error(`AccountPayment: impossible case encountered: '${ownProps.message.type}'`)
  }
}

const mapDispatchToProps = (dispatch, {message: {conversationIDKey, ordinal}}) => ({
  _onCancel: (paymentID: ?WalletTypes.PaymentID) => {
    if (paymentID) {
      dispatch(WalletsGen.createCancelPayment({paymentID}))
    }
  },
  onClaim: () =>
    dispatch(
      RouteTreeGen.createNavigateTo({
        path: Container.isMobile ? [Tabs.settingsTab, SettingsTabs.walletsTab] : [Tabs.walletsTab],
      })
    ),
  onSend: () => dispatch(Chat2Gen.createPrepareFulfillRequestForm({conversationIDKey, ordinal})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
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
  onCancel: () => dispatchProps._onCancel(stateProps._paymentID),
  onClaim: dispatchProps.onClaim,
  onSend: dispatchProps.onSend,
  pending: stateProps.pending,
  sendButtonLabel: stateProps.sendButtonLabel || '',
  showCoinsIcon: stateProps.showCoinsIcon,
})

const ConnectedAccountPayment = Container.connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(AccountPayment)
export default ConnectedAccountPayment

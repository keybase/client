// @flow
import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as WalletConstants from '../../../../constants/wallets'
import * as WalletTypes from '../../../../constants/types/wallets'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as Route from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import HiddenString from '../../../../util/hidden-string'
import AccountPayment, {type Props as AccountPaymentProps} from '.'

// Props for rendering the loading indicator
const loadingProps = {
  _defaultAccountID: WalletTypes.noAccountID,
  _request: WalletConstants.makeRequest(),
  action: '',
  amount: '',
  balanceChange: '',
  balanceChangeColor: '',
  icon: 'iconfont-stellar-send',
  loading: true,
  memo: '',
  pending: false,
}

type OwnProps = {
  message: Types.MessageSendPayment | Types.MessageRequestPayment,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const common = {
    _defaultAccountID: WalletConstants.getDefaultAccountID(state),
    _request: WalletConstants.makeRequest(),
  }
  switch (ownProps.message.type) {
    case 'sendPayment': {
      const paymentID = ownProps.message.paymentID
      const accountID = WalletConstants.getDefaultAccountID(state)
      if (!accountID) {
        return loadingProps
      }
      const payment = WalletConstants.getPayment(state, accountID, paymentID)
      if (payment.statusSimplified === 'none') {
        // no payment
        return loadingProps
      }
      return {
        ...common,
        action: payment.worth ? 'sent lumens worth' : 'sent',
        amount: payment.worth ? payment.worth : payment.amountDescription,
        balanceChange: `${payment.delta === 'increase' ? '+' : '-'}${payment.amountDescription}`,
        balanceChangeColor:
          payment.delta === 'increase' ? Styles.globalColors.green2 : Styles.globalColors.red,
        icon: 'iconfont-stellar-send',
        loading: false,
        memo: payment.note.stringValue(),
        pending: false,
        sendButtonLabel: '',
      }
    }
    case 'requestPayment': {
      const message: Types.MessageRequestPayment = ownProps.message
      const requestID = ownProps.message.requestID
      const request = WalletConstants.getRequest(state, requestID)
      if (!request) {
        return loadingProps
      }
      common._request = request
      const sendProps =
        ownProps.message.author === state.config.username
          ? {}
          : {
              sendButtonLabel: `Send${request.asset === 'currency' ? ' lumens worth ' : ' '}${
                request.amountDescription
              }`,
            }

      return {
        ...common,
        ...sendProps,
        action: request.asset === 'currency' ? 'requested lumens worth' : 'requested',
        amount: request.amountDescription,
        balanceChange: '',
        balanceChangeColor: '',
        icon: 'iconfont-stellar-request',
        loading: false,
        memo: message.note,
        pending: false,
      }
    }
    default:
      throw new Error(`AccountPayment: impossible case encountered: '${ownProps.message.type}'`)
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onSend: (details: ?WalletTypes.Request, defaultAccountID: ?WalletTypes.AccountID) => {
    if (details && defaultAccountID && ownProps.message.type === 'requestPayment') {
      const message = ownProps.message
      if (details.currencyCode) {
        dispatch(WalletsGen.createSetBuildingCurrency({currency: details.currencyCode}))
      }
      dispatch(WalletsGen.createSetBuildingAmount({amount: details.amount}))
      dispatch(WalletsGen.createSetBuildingFrom({from: defaultAccountID || ''}))
      dispatch(WalletsGen.createSetBuildingRecipientType({recipientType: 'keybaseUser'}))
      dispatch(WalletsGen.createSetBuildingTo({to: message.author}))
      dispatch(WalletsGen.createSetBuildingSecretNote({secretNote: new HiddenString(message.note)}))
      dispatch(Route.createNavigateAppend({path: [WalletConstants.sendReceiveFormRouteKey]}))
    }
  },
  loadTxData: () => {
    if (ownProps.message.type === 'requestPayment') {
      dispatch(WalletsGen.createLoadRequestDetail({requestID: ownProps.message.requestID}))
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  action: stateProps.action,
  amount: stateProps.amount,
  balanceChange: stateProps.balanceChange,
  balanceChangeColor: stateProps.balanceChangeColor,
  icon: stateProps.icon,
  loadTxData: dispatchProps.loadTxData,
  loading: stateProps.loading,
  memo: stateProps.memo,
  onSend: () => dispatchProps._onSend(stateProps._request, stateProps._defaultAccountID),
  pending: stateProps.pending,
  sendButtonLabel: stateProps.sendButtonLabel || '',
})

type LoadCalls = {|
  loadTxData: () => void,
|}

class LoadWrapper extends React.Component<{...AccountPaymentProps, ...LoadCalls}> {
  componentDidMount() {
    if (this.props.loading) {
      this.props.loadTxData()
    }
  }
  render() {
    const {loadTxData, ...passThroughProps} = this.props
    return <AccountPayment {...passThroughProps} />
  }
}

const ConnectedAccountPayment = Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(
  LoadWrapper
)
export default ConnectedAccountPayment

// @flow
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as WalletConstants from '../../../../constants/wallets'
import * as WalletTypes from '../../../../constants/types/wallets'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as Route from '../../../../actions/route-tree-gen'
import * as Styles from '../../../../styles'
import HiddenString from '../../../../util/hidden-string'
import AccountPayment from '.'

// Props for rendering the loading indicator
const loadingProps = {
  _defaultAccountID: WalletTypes.noAccountID,
  _request: Constants.makeChatRequestInfo(),
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
    _request: Constants.makeChatRequestInfo(),
  }
  switch (ownProps.message.type) {
    case 'sendPayment': {
      const {paymentInfo} = ownProps.message
      if (!paymentInfo) {
        // waiting for service to load it (missed service cache on loading thread)
        return loadingProps
      }
      return {
        ...common,
        action: paymentInfo.worth ? 'sent lumens worth' : 'sent',
        amount: paymentInfo.worth ? paymentInfo.worth : paymentInfo.amountDescription,
        balanceChange: `${paymentInfo.delta === 'increase' ? '+' : '-'}${paymentInfo.amountDescription}`,
        balanceChangeColor:
          paymentInfo.delta === 'increase' ? Styles.globalColors.green2 : Styles.globalColors.red,
        icon: 'iconfont-stellar-send',
        loading: false,
        memo: paymentInfo.note.stringValue(),
        pending: paymentInfo.status === 'pending',
        sendButtonLabel: '',
      }
    }
    case 'requestPayment': {
      const {requestInfo} = ownProps.message
      if (!requestInfo) {
        // waiting for service to load it
        return loadingProps
      }
      common._request = requestInfo
      const sendProps =
        ownProps.message.author === state.config.username
          ? {}
          : {
              sendButtonLabel: `Send${requestInfo.asset === 'currency' ? ' lumens worth ' : ' '}${
                requestInfo.amountDescription
              }`,
            }

      return {
        ...common,
        ...sendProps,
        action: requestInfo.asset === 'currency' ? 'requested lumens worth' : 'requested',
        amount: requestInfo.amountDescription,
        balanceChange: '',
        balanceChangeColor: '',
        icon: 'iconfont-stellar-request',
        loading: false,
        memo: ownProps.message.note,
        pending: false,
      }
    }
    default:
      throw new Error(`AccountPayment: impossible case encountered: '${ownProps.message.type}'`)
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onSend: (details: Types.ChatRequestInfo, defaultAccountID: ?WalletTypes.AccountID) => {
    if (details.amount && defaultAccountID && ownProps.message.type === 'requestPayment') {
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
  loading: stateProps.loading,
  memo: stateProps.memo,
  onSend: () => dispatchProps._onSend(stateProps._request, stateProps._defaultAccountID),
  pending: stateProps.pending,
  sendButtonLabel: stateProps.sendButtonLabel || '',
})

const ConnectedAccountPayment = Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(
  AccountPayment
)
export default ConnectedAccountPayment

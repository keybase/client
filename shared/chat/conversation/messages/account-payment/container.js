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
  _info: null,
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
  switch (ownProps.message.type) {
    case 'sendPayment': {
      const paymentInfo = Constants.getPaymentMessageInfo(state, ownProps.message)
      if (!paymentInfo) {
        // waiting for service to load it (missed service cache on loading thread)
        return loadingProps
      }
      return {
        _info: paymentInfo,
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
      const message = ownProps.message
      const requestInfo = Constants.getRequestMessageInfo(state, message)
      if (!requestInfo) {
        // waiting for service to load it
        return loadingProps
      }
      const sendProps =
        message.author === state.config.username
          ? {}
          : {
              sendButtonLabel: `Send${requestInfo.asset === 'currency' ? ' lumens worth ' : ' '}${
                requestInfo.amountDescription
              }`,
            }

      return {
        ...sendProps,
        _info: requestInfo,
        action: requestInfo.asset === 'currency' ? 'requested lumens worth' : 'requested',
        amount: requestInfo.amountDescription,
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
  _onSend: (requestInfo: ?Types.ChatRequestInfo) => {
    if (ownProps.message.type !== 'requestPayment') {
      throw new Error(`AccountPayment: impossible case encountered: '${ownProps.message.type}'`)
    }
    const message = ownProps.message
    if (requestInfo) {
      if (requestInfo.currencyCode) {
        dispatch(WalletsGen.createSetBuildingCurrency({currency: requestInfo.currencyCode}))
      }
      dispatch(WalletsGen.createSetBuildingAmount({amount: requestInfo.amount}))
      dispatch(WalletsGen.createSetBuildingFrom({from: WalletTypes.noAccountID})) // Meaning default account
      dispatch(WalletsGen.createSetBuildingRecipientType({recipientType: 'keybaseUser'}))
      dispatch(WalletsGen.createSetBuildingTo({to: message.author}))
      dispatch(WalletsGen.createSetBuildingSecretNote({secretNote: new HiddenString(message.note)}))
      dispatch(Route.createNavigateAppend({path: [WalletConstants.sendReceiveFormRouteKey]}))
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
  onSend: () =>
    dispatchProps._onSend(
      stateProps._info && stateProps._info.type === 'requestInfo' ? stateProps._info : null
    ),
  pending: stateProps.pending,
  sendButtonLabel: stateProps.sendButtonLabel || '',
})

const ConnectedAccountPayment = Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(
  AccountPayment
)
export default ConnectedAccountPayment

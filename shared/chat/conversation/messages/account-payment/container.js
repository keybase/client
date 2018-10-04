// @flow
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Styles from '../../../../styles'
import AccountPayment from '.'

// Props for rendering the loading indicator
const loadingProps = {
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
      const pending = paymentInfo.status !== 'completed'
      const verb = pending ? 'sending' : 'sent'
      let sign = ''
      if (paymentInfo.delta !== 'none') {
        sign = paymentInfo.delta === 'increase' ? '+' : '-'
      }
      let balanceChangeColor = Styles.globalColors.black
      if (paymentInfo.delta !== 'none') {
        balanceChangeColor =
          paymentInfo.delta === 'increase' ? Styles.globalColors.green2 : Styles.globalColors.red
      }
      if (pending) {
        balanceChangeColor = Styles.globalColors.black_20
      }
      return {
        action: paymentInfo.worth ? `${verb} lumens worth` : verb,
        amount: paymentInfo.worth ? paymentInfo.worth : paymentInfo.amountDescription,
        balanceChange: `${sign}${paymentInfo.amountDescription}`,
        balanceChangeColor,
        icon: 'iconfont-stellar-send',
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
        action: requestInfo.asset === 'currency' ? 'requested lumens worth' : 'requested',
        amount: requestInfo.amountDescription,
        balanceChange: '',
        balanceChangeColor: '',
        icon: 'iconfont-stellar-request',
        loading: false,
        memo: message.note.stringValue(),
        pending: false,
      }
    }
    default:
      throw new Error(`AccountPayment: impossible case encountered: '${ownProps.message.type}'`)
  }
}

const mapDispatchToProps = (dispatch, {message: {conversationIDKey, ordinal}}) => ({
  onSend: () => dispatch(Chat2Gen.createPrepareFulfillRequestForm({conversationIDKey, ordinal})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  action: stateProps.action,
  amount: stateProps.amount,
  balanceChange: stateProps.balanceChange,
  balanceChangeColor: stateProps.balanceChangeColor,
  icon: stateProps.icon,
  loading: stateProps.loading,
  memo: stateProps.memo,
  onSend: dispatchProps.onSend,
  pending: stateProps.pending,
  sendButtonLabel: stateProps.sendButtonLabel || '',
})

const ConnectedAccountPayment = Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(
  AccountPayment
)
export default ConnectedAccountPayment

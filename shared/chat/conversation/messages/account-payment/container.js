// @flow
import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/wallets'
import * as Types from '../../../../constants/types/chat2'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as Styles from '../../../../styles'
import AccountPayment, {type Props as AccountPaymentProps} from '.'

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

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  switch (ownProps.message.type) {
    case 'sendPayment': {
      const paymentID = ownProps.message.paymentID
      const accountID = Constants.getDefaultAccountID(state)
      if (!accountID) {
        return loadingProps
      }
      const payment = Constants.getPayment(state, accountID, paymentID)
      if (payment.statusSimplified === 'none') {
        // no payment
        return loadingProps
      }
      return {
        action: payment.worth ? 'sent lumens worth' : 'sent',
        amount: payment.worth ? payment.worth : payment.amountDescription,
        balanceChange: `${payment.delta === 'increase' ? '+' : '-'}${payment.amountDescription}`,
        balanceChangeColor:
          payment.delta === 'increase' ? Styles.globalColors.green2 : Styles.globalColors.red,
        icon: 'iconfont-stellar-send',
        loading: false,
        memo: payment.note,
        pending: false,
        sendButtonLabel: '',
      }
    }
    case 'requestPayment': {
      const message: Types.MessageRequestPayment = ownProps.message
      const requestID = ownProps.message.requestID
      const request = Constants.getRequest(state, requestID)
      if (!request) {
        return loadingProps
      }

      const sendProps =
        ownProps.message.author === state.config.username
          ? {}
          : {
              sendButtonLabel: `Send${request.asset === 'currency' ? ' lumens worth ' : ' '}${
                request.amountDescription
              }`,
            }

      return {
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

const mapDispatchToProps = (dispatch: Container.Dispatch, ownProps: OwnProps) => ({
  loadTxData: () => {
    if (ownProps.message.type === 'requestPayment') {
      dispatch(WalletsGen.createLoadRequestDetail({requestID: ownProps.message.requestID}))
    }
  },
  onSend: () => {
    // TODO navigate to dialog
    console.log('TODO')
  },
})

type LoadCalls = {|
  loadTxData: () => void,
|}

class LoadWrapper extends React.Component<AccountPaymentProps & LoadCalls> {
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

const ConnectedAccountPayment = Container.connect(mapStateToProps, mapDispatchToProps)(LoadWrapper)
export default ConnectedAccountPayment

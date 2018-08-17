// @flow
import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as Styles from '../../../../styles'
import AccountPayment, {type Props as AccountPaymentProps} from '.'

type OwnProps = {
  message: Types.MessageSendPayment | Types.MessageRequestPayment,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  switch (ownProps.message.type) {
    case 'sendPayment': {
      return {
        action: 'sent lumens worth',
        amount: '$35',
        balanceChange: '-90.5700999 XLM',
        balanceChangeColor: Styles.globalColors.red,
        icon: 'iconfont-stellar-send',
        memo: ':beer:',
        pending: false,
      }
    }
    case 'requestPayment': {
      return {
        action: 'sent lumens worth',
        amount: '$35',
        balanceChange: '-90.5700999 XLM',
        balanceChangeColor: Styles.globalColors.red,
        icon: 'iconfont-stellar-send',
        memo: ':beer:',
        pending: false,
      }
    }
  }
  return {
    action: 'sent lumens worth',
    amount: '$35',
    balanceChange: '-90.5700999 XLM',
    balanceChangeColor: Styles.globalColors.red,
    icon: 'iconfont-stellar-send',
    memo: ':beer:',
    pending: false,
  }
}

const mapDispatchToProps = (dispatch: Container.Dispatch, ownProps: OwnProps) => ({
  loadTxData: () => {
    if (ownProps.message.type === 'requestPayment') {
      dispatch(WalletsGen.createLoadRequestDetail({requestID: ownProps.message.requestID}))
    }
  },
})

type LoadCalls = {|
  loadTxData: () => void,
|}

class LoadWrapper extends React.Component<AccountPaymentProps & LoadCalls> {
  componentDidMount() {
    this.props.loadTxData()
  }
  render() {
    return <AccountPayment {...this.props} />
  }
}

const ConnectedAccountPayment = Container.connect(mapStateToProps, mapDispatchToProps)(LoadWrapper)
export default ConnectedAccountPayment

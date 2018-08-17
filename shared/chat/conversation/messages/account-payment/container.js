// @flow
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as Styles from '../../../../styles'
import AccountPayment from '.'

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

const mapDispatchToProps = (dispatch: Container.Dispatch, ownProps: OwnProps) => ({})

const ConnectedAccountPayment = Container.connect(mapStateToProps, mapDispatchToProps)(AccountPayment)
export default ConnectedAccountPayment

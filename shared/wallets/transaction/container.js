// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const payment = Constants.getPayment(state, ownProps.accountID, ownProps.paymentID)
  const you = state.config.username
  let yourRole, counterpartyType

  if (payment.source === you) {
    yourRole = 'sender'
    if (payment.target === you) {
      // wallet transfer
      counterpartyType = 'wallet'
    } else {
      counterpartyType = (() => {
        switch (payment.targetType) {
          case 'sbs': // fallthrough
          case 'keybase':
            return 'keybaseUser'
          case 'stellar':
            return 'stellarPublicKey'
          default:
            return null
        }
      })()
    }
  } else {
    yourRole = 'receiver'
    if (payment.sourceType === 'keybase') {
      counterpartyType = ''
    }
  }

  return {
    timestamp: payment.time,
  }
}

// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import TransactionDetails from '.'

export type OwnProps = {
  accountID: Types.AccountID,
  paymentID: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  _transaction: Constants.getPayment(state, ownProps.accountID, ownProps.paymentID),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  navigateUp: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => {
  console.warn('merge')
  return {
  ...stateProps,
  onClose: dispatchProps.navigateUp,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TransactionDetails)

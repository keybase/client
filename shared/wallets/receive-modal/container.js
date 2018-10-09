// @flow
import {connect} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Receive from '.'

export type OwnProps = {
  accountID: Types.AccountID,
}

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  return {
    accountName: account.name || `${state.config.username}'s account`,
    federatedAddress: Constants.getFederatedAddress(state, accountID),
    stellarAddress: accountID,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  navigateUp: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  onClose: dispatchProps.navigateUp,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Receive)

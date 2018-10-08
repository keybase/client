// @flow
import {connect, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import Receive from '.'

export type OwnProps = {
  accountID: Types.AccountID,
}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  return {
    federatedAddress: Constants.getFederatedAddress(state, accountID),
    stellarAddress: accountID,
    username: state.config.username,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  navigateUp: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  onClose: dispatchProps.navigateUp,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Receive)

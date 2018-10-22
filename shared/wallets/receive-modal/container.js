// @flow
import {connect} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import Receive from '.'

export type OwnProps = {
  accountID: Types.AccountID,
}

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const account = Constants.getAccount(state, accountID)
  return {
    accountName: account.name,
    federatedAddress: Constants.getFederatedAddress(state, accountID),
    isDefaultAccount: account.isDefault,
    stellarAddress: accountID,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  navigateUp: () => dispatch(navigateUp()),
  onRequest: () => {
    const accountID = routeProps.get('accountID')
    dispatch(navigateUp())
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        from: accountID,
        isRequest: true,
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  onClose: dispatchProps.navigateUp,
  onRequest: dispatchProps.onRequest,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Receive)

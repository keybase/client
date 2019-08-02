import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Receive from '.'

export type OwnProps = Container.RouteProps< { accountID: Types.AccountID } >

const mapStateToProps = (state, ownProps) => {
  const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
  const account = Constants.getAccount(state, accountID)
  return {
    accountName: account.name,
    federatedAddress: Constants.getFederatedAddress(state, accountID),
    isDefaultAccount: account.isDefault,
    stellarAddress: accountID,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  navigateUp: () => dispatch(RouteTreeGen.createNavigateUp()),
  onRequest: () => {
    const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
    dispatch(RouteTreeGen.createNavigateUp())
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

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(Receive)

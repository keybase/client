import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Receive from '.'

export type OwnProps = Container.RouteProps<'receive'>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const accountID = ownProps.route.params?.accountID ?? Types.noAccountID
    const account = Constants.getAccount(state, accountID)
    return {
      accountName: account.name,
      federatedAddress: Constants.getFederatedAddress(state, accountID),
      isDefaultAccount: account.isDefault,
      stellarAddress: accountID,
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    navigateUp: () => dispatch(RouteTreeGen.createNavigateUp()),
    onRequest: () => {
      const accountID = ownProps.route.params?.accountID ?? Types.noAccountID
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(
        WalletsGen.createOpenSendRequestForm({
          from: accountID,
          isRequest: true,
        })
      )
    },
  }),
  (stateProps, dispatchProps) => ({
    ...stateProps,
    onClose: dispatchProps.navigateUp,
    onRequest: dispatchProps.onRequest,
  })
)(Receive)

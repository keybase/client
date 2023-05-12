import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Receive from '.'

export type OwnProps = Container.RouteProps2<'receive'>

export default (ownProps: OwnProps) => {
  const accountID = ownProps.route.params.accountID ?? Types.noAccountID
  const account = Container.useSelector(state => Constants.getAccount(state, accountID))
  const accountName = account.name
  const federatedAddress = Container.useSelector(state => Constants.getFederatedAddress(state, accountID))
  const isDefaultAccount = account.isDefault
  const stellarAddress = accountID

  const dispatch = Container.useDispatch()
  const navigateUp = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onRequest = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(WalletsGen.createOpenSendRequestForm({from: accountID, isRequest: true}))
  }
  const props = {
    accountName,
    federatedAddress,
    isDefaultAccount,
    onClose: navigateUp,
    onRequest: onRequest,
    stellarAddress,
  }
  return <Receive {...props} />
}

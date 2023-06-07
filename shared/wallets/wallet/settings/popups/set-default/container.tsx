import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import SetDefaultAccountPopup from '.'

type OwnProps = {accountID: Types.AccountID}

export default (ownProps: OwnProps) => {
  const accountID = ownProps.accountID ?? Types.noAccountID
  const accountName = Container.useSelector(state => Constants.getAccount(state, accountID).name)
  const username = Container.useSelector(state => state.config.username)
  const waiting = Container.useAnyWaiting(Constants.setAccountAsDefaultWaitingKey)
  const dispatch = Container.useDispatch()
  const _onAccept = (accountID: Types.AccountID) => {
    dispatch(
      WalletsGen.createSetAccountAsDefault({
        accountID,
      })
    )
  }
  const _onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    accountName: accountName,
    onAccept: () => _onAccept(accountID),
    onClose: () => _onClose(),
    username: username,
    waiting: waiting,
  }
  return <SetDefaultAccountPopup {...props} />
}

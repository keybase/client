import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as ConfigConstants from '../../../../../constants/config'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Types from '../../../../../constants/types/wallets'
import ReallyRemoveAccountPopup from '.'

type OwnProps = {accountID: Types.AccountID}

export default (ownProps: OwnProps) => {
  const accountID = ownProps.accountID ?? Types.noAccountID
  const secretKey = Container.useSelector(state => Constants.getSecretKey(state, accountID).stringValue())
  const name = Container.useSelector(state => Constants.getAccount(state, accountID).name)
  const waiting = Container.useAnyWaiting(Constants.deleteAccountWaitingKey)

  const dispatch = Container.useDispatch()
  const _onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const _onCopyKey = ConfigConstants.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const _onFinish = (accountID: Types.AccountID) => {
    dispatch(WalletsGen.createDeleteAccount({accountID}))
  }
  const props = {
    accountID: accountID,
    loading: !secretKey,
    name: name,
    onCancel: () => _onClose(),
    onCopyKey: () => _onCopyKey(secretKey),
    onFinish: () => _onFinish(accountID),
    waiting: waiting,
  }
  return <ReallyRemoveAccountPopup {...props} />
}

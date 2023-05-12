import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Types from '../../../../../constants/types/wallets'
import {anyWaiting} from '../../../../../constants/waiting'
import ReallyRemoveAccountPopup from '.'

type OwnProps = Container.RouteProps2<'reallyRemoveAccount'>

export default (ownProps: OwnProps) => {
  const accountID = ownProps.route.params.accountID ?? Types.noAccountID
  const secretKey = Container.useSelector(state => Constants.getSecretKey(state, accountID).stringValue())
  const name = Container.useSelector(state => Constants.getAccount(state, accountID).name)
  const waiting = Container.useSelector(state => anyWaiting(state, Constants.deleteAccountWaitingKey))

  const dispatch = Container.useDispatch()
  const _onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const _onCopyKey = (secretKey: string) => {
    dispatch(ConfigGen.createCopyToClipboard({text: secretKey}))
  }
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

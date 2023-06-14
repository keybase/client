import * as ConfigConstants from '../../../constants/config'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Header from '.'
import type * as Types from '../../../constants/types/wallets'
import {memoize} from '../../../util/memoize'

const otherUnreadPayments = memoize(
  (map: Container.TypedState['wallets']['unreadPaymentsMap'], accID: Types.AccountID) =>
    [...map.entries()].some(([id, u]) => id !== accID && !!u)
)

export default () => {
  const _accountID = Container.useSelector(state => Constants.getSelectedAccount(state))
  const selectedAccount = Container.useSelector(state => Constants.getAccount(state, _accountID))
  const accountID = selectedAccount.accountID
  const isDefaultWallet = selectedAccount.isDefault
  const keybaseUser = ConfigConstants.useConfigState(s => s.username)
  const thisDeviceIsLockedOut = selectedAccount.deviceReadOnly
  const unreadPayments = Container.useSelector(state =>
    otherUnreadPayments(state.wallets.unreadPaymentsMap, selectedAccount.accountID)
  )
  const walletName = selectedAccount.name

  const dispatch = Container.useDispatch()
  const _onReceive = (accountID: Types.AccountID) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {accountID},
            selected: 'receive',
          },
        ],
      })
    )
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSettings = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settings']}))
  }
  const props = {
    accountID,
    isDefaultWallet,
    keybaseUser,
    onBack: onBack,
    onReceive: () => _onReceive(accountID),
    onSettings: onSettings,
    thisDeviceIsLockedOut,
    unreadPayments,
    walletName,
  }
  return <Header {...props} />
}

import * as Container from '../../../util/container'
import {memoize} from '../../../util/memoize'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import type * as Types from '../../../constants/types/wallets'
import Header from '.'

const otherUnreadPayments = memoize(
  (map: Container.TypedState['wallets']['unreadPaymentsMap'], accID: Types.AccountID) =>
    [...map.entries()].some(([id, u]) => id !== accID && !!u)
)

export default () => {
  const _accountID = Container.useSelector(state => Constants.getSelectedAccount(state))
  const selectedAccount = Container.useSelector(state => Constants.getAccount(state, _accountID))
  const accountID = selectedAccount.accountID
  const isDefaultWallet = selectedAccount.isDefault
  const keybaseUser = Container.useSelector(state => state.config.username)
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

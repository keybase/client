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

type OwnProps = {}

export default Container.connect(
  state => {
    const accountID = Constants.getSelectedAccount(state)
    const selectedAccount = Constants.getAccount(state, accountID)
    return {
      accountID: selectedAccount.accountID,
      isDefaultWallet: selectedAccount.isDefault,
      keybaseUser: state.config.username,
      thisDeviceIsLockedOut: selectedAccount.deviceReadOnly,
      unreadPayments: otherUnreadPayments(state.wallets.unreadPaymentsMap, selectedAccount.accountID),
      walletName: selectedAccount.name,
    }
  },
  (dispatch: Container.TypedDispatch) => ({
    _onReceive: (accountID: Types.AccountID) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {accountID},
              selected: 'receive',
            },
          ],
        })
      ),
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onSettings: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settings']})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    onBack: dispatchProps.onBack,
    onReceive: () => dispatchProps._onReceive(stateProps.accountID),
    onSettings: dispatchProps.onSettings,
  })
)(Header)

import * as Container from '../../../util/container'
import {memoize} from '../../../util/memoize'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import Header from '.'

const otherUnreadPayments = memoize(
  (map: Container.TypedState['wallets']['unreadPaymentsMap'], accID: Types.AccountID) =>
    !!map.delete(accID).some(Boolean)
)

type OwnProps = {
  onBack: () => void
}

const mapStateToProps = (state: Container.TypedState) => {
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
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
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
  onSettings: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settings']})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...stateProps,
    onBack: Container.isMobile ? ownProps.onBack : null,
    onReceive: () => dispatchProps._onReceive(stateProps.accountID),
    onSettings: dispatchProps.onSettings,
  })
)(Header)

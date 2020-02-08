import {WalletRow, Props} from '.'
import {namedConnect, isPhone} from '../../../util/container'
import {getAccount, getSelectedAccount} from '../../../constants/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {AccountID} from '../../../constants/types/wallets'

// TODO: This is now desktop-only, so remove references to isMobile.

type OwnProps = {
  accountID: AccountID
}

const mapStateToProps = (
  state,
  ownProps: {
    accountID: AccountID
  }
) => {
  const account = getAccount(state, ownProps.accountID)
  const name = account.name
  const me = state.config.username
  const keybaseUser = account.isDefault ? me : ''
  const selectedAccount = getSelectedAccount(state)
  return {
    contents: account.balanceDescription,
    isSelected: selectedAccount === ownProps.accountID,
    keybaseUser,
    name,
    selectedAccount,
    unreadPayments: state.wallets.unreadPaymentsMap.get(ownProps.accountID) ?? 0,
  }
}

const mapDispatchToProps = dispatch => ({
  _onSelectAccount: (accountID: AccountID) => {
    if (!isPhone) {
      dispatch(RouteTreeGen.createNavUpToScreen({routeName: 'wallet'}))
    }
    dispatch(WalletsGen.createSelectAccount({accountID, reason: 'user-selected', show: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => ({
  contents: stateProps.contents,
  isSelected: !isPhone && stateProps.isSelected,
  keybaseUser: stateProps.keybaseUser,
  name: stateProps.name,
  onSelect: () => {
    // First clear any new payments on the currently selected acct.
    dispatchProps._onSelectAccount(ownProps.accountID)
  },
  unreadPayments: stateProps.unreadPayments,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'WalletRow')(WalletRow)

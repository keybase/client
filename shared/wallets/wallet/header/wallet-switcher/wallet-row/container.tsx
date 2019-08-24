import {WalletRow} from '.'
import * as Container from '../../../../../util/container'
import {getAccount, getSelectedAccount} from '../../../../../constants/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import {AccountID} from '../../../../../constants/types/wallets'

type OwnProps = {
  accountID: AccountID
  hideMenu: () => void
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const account = getAccount(state, ownProps.accountID)
  const name = account.name
  const me = state.config.username || ''
  const keybaseUser = account.isDefault ? me : ''
  const selectedAccount = getSelectedAccount(state)
  return {
    contents: account.balanceDescription,
    isSelected: selectedAccount === ownProps.accountID,
    keybaseUser,
    name,
    selectedAccount,
    unreadPayments: state.wallets.unreadPaymentsMap.get(ownProps.accountID, 0),
  }
}

export default Container.connect(
  mapStateToProps,
  dispatch => ({
    _onSelectAccount: (accountID: AccountID) =>
      dispatch(WalletsGen.createSelectAccount({accountID, reason: 'user-selected', show: true})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    contents: stateProps.contents,
    isSelected: stateProps.isSelected,
    keybaseUser: stateProps.keybaseUser,
    name: stateProps.name,
    onSelect: () => {
      // First clear any new payments on the currently selected acct.
      dispatchProps._onSelectAccount(ownProps.accountID)
      ownProps.hideMenu()
    },
    unreadPayments: stateProps.unreadPayments,
  })
)(WalletRow)

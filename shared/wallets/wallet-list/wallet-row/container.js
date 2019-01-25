// @flow
import {WalletRow, type Props} from '.'
import {connect, isMobile} from '../../../util/container'
import {getAccount, getSelectedAccount} from '../../../constants/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import {type AccountID} from '../../../constants/types/wallets'

// TODO: This is now desktop-only, so remove references to isMobile.

type OwnProps = {accountID: AccountID}

const mapStateToProps = (state, ownProps: {accountID: AccountID}) => {
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

const mapDispatchToProps = dispatch => ({
  _onClearNewPayments: (accountID: AccountID) => dispatch(WalletsGen.createClearNewPayments({accountID})),
  _onSelectAccount: (accountID: AccountID) =>
    dispatch(WalletsGen.createSelectAccount({accountID, reason: 'user-selected', show: true})),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  contents: stateProps.contents,
  isSelected: !isMobile && stateProps.isSelected,
  keybaseUser: stateProps.keybaseUser,
  name: stateProps.name,
  onSelect: () => {
    // First clear any new payments on the currently selected acct.
    dispatchProps._onClearNewPayments(stateProps.selectedAccount)
    dispatchProps._onSelectAccount(ownProps.accountID)
  },
  unreadPayments: stateProps.unreadPayments,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletRow)

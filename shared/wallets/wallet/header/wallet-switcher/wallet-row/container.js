// @flow
import {WalletRow, type Props} from '.'
import {connect} from '../../../../../util/container'
import {getAccount, getSelectedAccount} from '../../../../../constants/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import {type AccountID} from '../../../../../constants/types/wallets'

type OwnProps = {
  accountID: AccountID,
  onSelect?: () => void,
}

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
    dispatch(WalletsGen.createSelectAccount({accountID, show: true})),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  contents: stateProps.contents,
  isSelected: stateProps.isSelected,
  keybaseUser: stateProps.keybaseUser,
  name: stateProps.name,
  onSelect: () => {
    // First clear any new payments on the currently selected acct.
    dispatchProps._onClearNewPayments(stateProps.selectedAccount)
    dispatchProps._onSelectAccount(ownProps.accountID)
    ownProps.onSelect && ownProps.onSelect()
  },
  unreadPayments: stateProps.unreadPayments,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletRow)

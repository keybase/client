// @flow
import {WalletRow, type Props} from '.'
import {connect, isMobile} from '../../../util/container'
import {getAccount, getSelectedAccount} from '../../../constants/wallets'
import {createSelectAccount} from '../../../actions/wallets-gen'
import {type AccountID} from '../../../constants/types/wallets'

const mapStateToProps = (state, ownProps: {accountID: AccountID}) => {
  const account = getAccount(state, ownProps.accountID)
  const name = account.name
  const me = state.config.username || ''
  const keybaseUser = account.isDefault ? me : ''
  return {
    contents: account.balanceDescription,
    isSelected: getSelectedAccount(state) === ownProps.accountID,
    keybaseUser,
    name,
    unreadPayments: state.wallets.unreadPaymentsMap.get(ownProps.accountID, 0),
  }
}

const mapDispatchToProps = (dispatch) => ({
  _onSelectAccount: (accountID: AccountID) => {
    dispatch(createSelectAccount({accountID, show: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  contents: stateProps.contents,
  isSelected: !isMobile && stateProps.isSelected,
  keybaseUser: stateProps.keybaseUser,
  name: stateProps.name,
  onSelect: () => dispatchProps._onSelectAccount(ownProps.accountID),
  unreadPayments: stateProps.unreadPayments,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletRow)

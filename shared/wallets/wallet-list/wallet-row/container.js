// @flow
import {WalletRow, type Props} from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {getAccount, getSelectedAccount} from '../../../constants/wallets'
import {createSelectAccount} from '../../../actions/wallets-gen'
import {type AccountID} from '../../../constants/types/wallets'

const mapStateToProps = (state: TypedState, {accountID}) => {
  const account = getAccount(state, accountID)
  const name = account.name || accountID
  const me = state.config.username || ''
  const keybaseUser = account.isDefault ? me : ''
  return {
    accountID,
    isSelected: getSelectedAccount(state) === accountID,
    name,
    keybaseUser,
    contents: account.balanceDescription,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onSelectAccount: (accountID: AccountID) => {
    dispatch(createSelectAccount({accountID}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => {
  return {
    isSelected: stateProps.isSelected,
    name: stateProps.name,
    keybaseUser: stateProps.keybaseUser,
    contents: stateProps.contents,
    onSelect: () => dispatchProps._onSelectAccount(ownProps.accountID),
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletRow)

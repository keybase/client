// @flow
import {WalletRow, type Props} from '.'
import {connect, type TypedState} from '../../../util/container'
import {getAccount, getSelectedAccount} from '../../../constants/wallets'
import {createSelectAccount} from '../../../actions/wallets-gen'
import {type AccountID} from '../../../constants/types/wallets'

const mapStateToProps = (state: TypedState, ownProps: {accountID: AccountID}) => {
  const account = getAccount(state, ownProps.accountID)
  const name = account.name || ownProps.accountID
  const me = state.config.username || ''
  const keybaseUser = account.isDefault ? me : ''
  return {
    isSelected: getSelectedAccount(state) === ownProps.accountID,
    name,
    keybaseUser,
    contents: account.balanceDescription,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onSelectAccount: (accountID: AccountID) => {
    dispatch(createSelectAccount({accountID, show: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  isSelected: stateProps.isSelected,
  name: stateProps.name,
  keybaseUser: stateProps.keybaseUser,
  contents: stateProps.contents,
  onSelect: () => dispatchProps._onSelectAccount(ownProps.accountID),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletRow)

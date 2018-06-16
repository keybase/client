// @flow
import {WalletList} from '.'
import logger from '../../logger'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import {getAccounts, getSelectedAccount} from '../../constants/wallets'
import {createSelectAccount} from '../../actions/wallets-gen'
import {type AccountID} from '../../constants/types/wallets'

const mapStateToProps = (state: TypedState) => ({
  accounts: getAccounts(state),
  selectedAccount: getSelectedAccount(state),
  me: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onSelectAccount: (accountID: AccountID) => {
    dispatch(createSelectAccount({accountID}))
  },
  onAddNew: () => {
    logger.error('TODO: onAddNew')
  },
  onLinkExisting: () => {
    logger.error('TODO: onLinkExisting')
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  // Accounts is already ordered, so no need to sort.
  const wallets = stateProps.accounts
    .map(a => {
      let name = a.name || a.accountID
      // TODO: Better way to do this?
      if (name.length > 20) {
        name = name.substr(0, 20) + '...'
      }

      return {
        keybaseUser: a.isDefault ? stateProps.me : '',
        name,
        contents: a.balanceDescription,
      }
    })
    .valueSeq()
    .toJS()

  return {
    wallets,
    selectedAccount: stateProps.selectedAccount,
    onSelectAccount: dispatchProps.onSelectAccount,
    onAddNew: dispatchProps.onAddNew,
    onLinkExisting: dispatchProps.onLinkExisting,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletList)

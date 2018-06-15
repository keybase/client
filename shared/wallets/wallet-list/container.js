// @flow
import {WalletList} from '.'
import logger from '../../logger'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import {getAccounts} from '../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({accounts: getAccounts(state)})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
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
        // TODO: How to get keybaseUser?
        name,
        contents: a.balanceDescription,
      }
    })
    .valueSeq()
    .toJS()

  return {
    wallets,
    onAddNew: dispatchProps.onAddNew,
    onLinkExisting: dispatchProps.onLinkExisting,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletList)

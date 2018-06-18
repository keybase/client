// @flow
import {WalletList, type Props} from '.'
import logger from '../../logger'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import {getAccountIDs} from '../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({
  accounts: getAccountIDs(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onAddNew: () => {
    logger.error('TODO: onAddNew')
  },
  onLinkExisting: () => {
    logger.error('TODO: onLinkExisting')
  },
})

const mergeProps = (stateProps, dispatchProps): Props => ({
  accountIDs: stateProps.accounts.toArray(),
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletList)

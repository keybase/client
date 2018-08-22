// @flow
import {WalletList, type Props} from '.'
import logger from '../../logger'
import * as RouteTree from '../../actions/route-tree'
import {connect, type TypedState} from '../../util/container'
import {getAccountIDs} from '../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({
  accounts: getAccountIDs(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onAddNew: () => {
    logger.error('TODO: onAddNew')
  },
  onLinkExisting: () => {
    dispatch(RouteTree.navigateAppend(['linkExisting']))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  accountIDs: stateProps.accounts.toArray(),
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
  style: ownProps.style,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletList)

// @flow
import {WalletList, type Props} from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTree from '../../actions/route-tree'
import {connect, type TypedState, isMobile} from '../../util/container'
import {getAccountIDs} from '../../constants/wallets'

const mapStateToProps = (state: TypedState) => ({
  accounts: getAccountIDs(state),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onAddNew: () => {
    dispatch(RouteTree.navigateAppend([{props: {showOnCreation: true}, selected: 'createNewAccount'}]))
  },
  onBack: isMobile ? () => dispatch(RouteTree.navigateUp()) : null,
  onLinkExisting: () => {
    dispatch(RouteTree.navigateAppend([{props: {showOnCreation: true}, selected: 'linkExisting'}]))
  },
  refresh: () => dispatch(WalletsGen.createLoadAccounts()),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  accountIDs: stateProps.accounts.toArray(),
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
  onBack: dispatchProps.onBack,
  refresh: dispatchProps.refresh,
  style: ownProps.style,
  title: 'Wallets',
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletList)

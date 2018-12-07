// @flow
import {WalletSwitcher, type Props} from '.'
import * as RouteTree from '../../../../actions/route-tree'
import {connect, isMobile} from '../../../../util/container'
import {getAccountIDs} from '../../../../constants/wallets'

type OwnProps = {|
  walletName: string,
|}

const mapStateToProps = state => ({
  accounts: getAccountIDs(state),
})

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTree.navigateAppend([
        {props: {backButton: isMobile, showOnCreation: true}, selected: 'createNewAccount'},
      ])
    )
  },
  onLinkExisting: () => {
    dispatch(RouteTree.navigateAppend([{props: {showOnCreation: true}, selected: 'linkExisting'}]))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  accountIDs: stateProps.accounts.toArray(),
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
  walletName: ownProps.walletName,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletSwitcher)

// @flow
import {WalletSwitcher, type Props} from '.'
import * as RouteTree from '../../../../actions/route-tree'
import * as Types from '../../../../constants/types/wallets'
import {connect, isMobile} from '../../../../util/container'

type OwnProps = {|
  accountID: Types.AccountID,
  walletName: string,
|}

const mapStateToProps = state => ({})

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
  accountID: ownProps.accountID,
  accountIDs: [],
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
  walletName: ownProps.walletName,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletSwitcher)

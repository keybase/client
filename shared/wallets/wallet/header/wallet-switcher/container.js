// @flow
import * as React from 'react'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {connect, isMobile} from '../../../../util/container'
import {getAccountIDs} from '../../../../constants/wallets'
import openURL from '../../../../util/open-url'
import {WalletSwitcher} from '.'

type OwnProps = {|
  getAttachmentRef: () => ?React.Component<any>,
  showingMenu: boolean,
  hideMenu: () => void,
|}

const mapStateToProps = state => ({
  accounts: getAccountIDs(state),
})

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: isMobile, showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onLinkExisting: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  },
  onWhatIsStellar: () => openURL('https://keybase.io/what-is-stellar'),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  accountIDs: stateProps.accounts.toArray(),
  onAddNew: dispatchProps.onAddNew,
  onLinkExisting: dispatchProps.onLinkExisting,
  onWhatIsStellar: dispatchProps.onWhatIsStellar,
  ...ownProps,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletSwitcher)

// @flow
import * as React from 'react'
import * as RouteTree from '../../../../actions/route-tree'
import * as Types from '../../../../constants/types/wallets'
import {connect, isMobile} from '../../../../util/container'
import {getAccountIDs} from '../../../../constants/wallets'
import openURL from '../../../../util/open-url'
import {WalletSwitcher} from '.'

type OwnProps = {|
  getAttachmentRef: () => ?React.Component<any>,
  showingMenu: boolean,
  hideMenu: () => void,
|}

export type Props = {|
  ...$Exact<OwnProps>,
  accountIDs: Array<Types.AccountID>,
  onAddNew: () => void,
  onLinkExisting: () => void,
  onWhatIsStellar: () => void,
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
  onWhatIsStellar: () => openURL('https://keybase.io/what-is-stellar'),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
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

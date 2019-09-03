import * as React from 'react'
import * as Constants from '../../../../constants/wallets'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as Types from '../../../../constants/types/wallets'
import {WalletSwitcher} from '.'

type OwnProps = {
  getAttachmentRef?: (() => React.Component<any>) | null
  showingMenu: boolean
  hideMenu: () => void
}

const mapStateToProps = (state: Container.TypedState) => ({
  accounts: Constants.getAccountIDs(state),
  airdropIsLive: state.wallets.airdropDetails.isPromoted,
  inAirdrop: state.wallets.airdropState === 'accepted',
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: Container.isMobile, showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onJoinAirdrop: () => {
    dispatch(
      WalletsGen.createSelectAccount({accountID: Types.airdropAccountID, reason: 'user-selected', show: true})
    )
  },
  onLinkExisting: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  },
  onWhatIsStellar: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['whatIsStellarModal']})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    accountIDs: stateProps.accounts.toArray(),
    airdropIsLive: stateProps.airdropIsLive,
    inAirdrop: stateProps.inAirdrop,
    onAddNew: dispatchProps.onAddNew,
    onJoinAirdrop: dispatchProps.onJoinAirdrop,
    onLinkExisting: dispatchProps.onLinkExisting,
    onWhatIsStellar: dispatchProps.onWhatIsStellar,
    ...ownProps,
  })
  // TODO fix
)(WalletSwitcher) as any

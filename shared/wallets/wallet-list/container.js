// @flow
import {WalletList, type Props} from '.'
import * as Constants from '../../constants/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as RouteTree from '../../route-tree'
import * as Styles from '../../styles'
import openURL from '../../util/open-url'
import {connect} from '../../util/container'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {style: Styles.StylesCrossPlatform}

const mapStateToProps = state => {
  const path = RouteTree.getPath(state.routeTree.routeState).last()
  return {
    accounts: Constants.getAccountIDs(state),
    airdropSelected: path === 'airdrop' || path === 'airdropQualify',
    inAirdrop: state.wallets.airdropState === 'accepted',
    loading: anyWaiting(state, Constants.loadAccountsWaitingKey),
  }
}

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: false, showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onJoinAirdrop: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['airdrop']}))
  },
  onLinkExisting: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  },
  onWhatIsStellar: () => openURL('https://keybase.io/what-is-stellar'),
})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  accountIDs: stateProps.accounts.toArray(),
  airdropSelected: stateProps.airdropSelected,
  inAirdrop: stateProps.inAirdrop,
  loading: stateProps.loading,
  onAddNew: dispatchProps.onAddNew,
  onJoinAirdrop: dispatchProps.onJoinAirdrop,
  onLinkExisting: dispatchProps.onLinkExisting,
  onWhatIsStellar: dispatchProps.onWhatIsStellar,
  style: ownProps.style,
  title: 'Wallets',
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletList)

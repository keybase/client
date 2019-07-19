import {WalletList} from '.'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {
  style: Styles.StylesCrossPlatform
}

const mapStateToProps = (state: Container.TypedState) => ({
  accounts: Constants.getAccountIDs(state),
  airdropIsLive: state.wallets.airdropDetails.isPromoted,
  airdropSelected: Constants.getAirdropSelected(),
  inAirdrop: state.wallets.airdropState === 'accepted',
  loading: anyWaiting(state, Constants.loadAccountsWaitingKey),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: false, showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onJoinAirdrop: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['airdrop'], replace: true}))
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
    airdropSelected: stateProps.airdropSelected,
    inAirdrop: stateProps.inAirdrop,
    loading: stateProps.loading,
    onAddNew: dispatchProps.onAddNew,
    onJoinAirdrop: stateProps.airdropIsLive ? dispatchProps.onJoinAirdrop : null,
    onLinkExisting: dispatchProps.onLinkExisting,
    onWhatIsStellar: dispatchProps.onWhatIsStellar,
    style: ownProps.style,
    title: 'Wallets',
  })
)(WalletList)

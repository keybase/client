import {WalletList} from '.'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import openURL from '../../util/open-url'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {
  style: Styles.StylesCrossPlatform
}

const mapStateToProps = (state: Container.TypedState) => {
  return {
    accounts: Constants.getAccountIDs(state),
    airdropSelected: false, // TODO path === 'airdrop' || path === 'airdropQualify',
    inAirdrop: state.wallets.airdropState === 'accepted',
    loading: anyWaiting(state, Constants.loadAccountsWaitingKey),
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
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
  onWhatIsStellar: () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['whatIsStellarModal']}))
  },
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
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
)(WalletList)

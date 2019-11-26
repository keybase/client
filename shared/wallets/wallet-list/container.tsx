import {WalletList} from '.'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Styles from '../../styles'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = {
  style: Styles.StylesCrossPlatform
}

export default Container.connect(
  state => ({
    accounts: Constants.getAccountIDs(state),
    airdropIsLive: state.wallets.airdropDetails.isPromoted || state.wallets.airdropState === 'accepted',
    airdropSelected: Constants.getAirdropSelected(state),
    inAirdrop: state.wallets.airdropState === 'accepted',
    loading: anyWaiting(state, Constants.loadAccountsWaitingKey),
  }),
  dispatch => ({
    onAddNew: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {backButton: false, showOnCreation: true}, selected: 'createNewAccount'}],
        })
      ),
    onJoinAirdrop: () =>
      dispatch(
        WalletsGen.createSelectAccount({
          accountID: Types.airdropAccountID,
          reason: 'user-selected',
          show: true,
        })
      ),
    onLinkExisting: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
      ),
    onWhatIsStellar: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['whatIsStellarModal']})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    accountIDs: stateProps.accounts,
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

import * as Container from '../../util/container'
import * as Constants from '../../constants/tracker2'
import * as WalletsConstants from '../../constants/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Bio, {Props} from '.'

type OwnProps = {
  inTracker: boolean
  username: string
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const common = {
    airdropIsLive: state.wallets.airdropDetails.isPromoted,
    youAreInAirdrop: state.wallets.airdropState === 'accepted',
  }
  const d = Constants.getDetails(state, ownProps.username)
  if (d.state === 'notAUserYet') {
    const nonUser = Constants.getNonUserDetails(state, ownProps.username)
    return {
      ...common,
      bio: nonUser.bio,
      followThem: false,
      followersCount: null,
      followingCount: null,
      followsYou: false,
      fullname: nonUser.fullName,
      location: null,
      registeredForAirdrop: false,
      sbsDescription: nonUser.description,
    }
  } else {
    return {
      ...common,
      bio: d.bio,
      followThem: Constants.followThem(state, ownProps.username),
      followersCount: d.followersCount,
      followingCount: d.followingCount,
      followsYou: Constants.followsYou(state, ownProps.username),
      fullname: d.fullname,
      location: d.location,
      registeredForAirdrop: d.registeredForAirdrop,
      sbsDescription: null,
    }
  }
}
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onLearnMore: () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: WalletsConstants.rootWalletTab}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [...WalletsConstants.walletPath, 'airdrop']}))
  },
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps): Props => ({
    airdropIsLive: stateProps.airdropIsLive,
    bio: stateProps.bio,
    followThem: stateProps.followThem,
    followersCount: stateProps.followersCount,
    followingCount: stateProps.followingCount,
    followsYou: stateProps.followsYou,
    fullname: stateProps.fullname,
    inTracker: ownProps.inTracker,
    location: stateProps.location,
    onBack: dispatchProps.onBack,
    onLearnMore: dispatchProps.onLearnMore,
    registeredForAirdrop: stateProps.registeredForAirdrop,
    sbsDescription: stateProps.sbsDescription,
    youAreInAirdrop: stateProps.youAreInAirdrop,
  }),
  'Bio'
)(Bio)

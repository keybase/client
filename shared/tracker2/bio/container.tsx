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
  const d = Constants.getDetails(state, ownProps.username)
  const common = {
    airdropIsLive: state.wallets.airdropDetails.isPromoted,
    blocked: d.blocked,
    hidFromFollowers: d.hidFromFollowers,
    username: ownProps.username,
    youAreInAirdrop: state.wallets.airdropState === 'accepted',
  }
  if (d.state === 'notAUserYet') {
    const nonUser = Constants.getNonUserDetails(state, ownProps.username)
    return {
      ...common,
      bio: nonUser.bio,
      followThem: false,
      followsYou: false,
      fullname: nonUser.fullName,
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
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
  }),
  'Bio'
)(Bio)

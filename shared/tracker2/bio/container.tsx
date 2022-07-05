import * as Container from '../../util/container'
import * as Constants from '../../constants/tracker2'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Bio from '.'

type OwnProps = {
  inTracker: boolean
  username: string
}

export default Container.namedConnect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const d = Constants.getDetails(state, ownProps.username)
    const common = {
      blocked: d.blocked,
      hidFromFollowers: d.hidFromFollowers,
      username: ownProps.username,
    }
    if (d.state === 'notAUserYet') {
      const nonUser = Constants.getNonUserDetails(state, ownProps.username)
      return {
        ...common,
        bio: nonUser.bio,
        followThem: false,
        followsYou: false,
        fullname: nonUser.fullName,
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
      }
    }
  },
  (dispatch: Container.TypedDispatch) => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
  }),
  'Bio'
)(Bio)

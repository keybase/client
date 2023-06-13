import * as Container from '../../util/container'
import * as Constants from '../../constants/tracker2'
import * as Followers from '../../constants/followers'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Bio from '.'
import shallowEqual from 'shallowequal'

type OwnProps = {
  inTracker: boolean
  username: string
}

export default (ownProps: OwnProps) => {
  const {inTracker, username} = ownProps
  const stateProps = Container.useSelector(state => {
    const d = Constants.getDetails(state, username)
    const common = {
      blocked: d.blocked,
      hidFromFollowers: d.hidFromFollowers,
    }

    if (d.state === 'notAUserYet') {
      const nonUser = Constants.getNonUserDetails(state, username)
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
        followersCount: d.followersCount,
        followingCount: d.followingCount,
        fullname: d.fullname,
        location: d.location,
      }
    }
  }, shallowEqual)

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }

  const followThem = Followers.useFollowerState(s => s.following.has(username))
  const followsYou = Followers.useFollowerState(s => s.followers.has(username))

  const props = {
    followThem,
    followsYou,
    inTracker,
    onBack,
    username,
    ...stateProps,
  }
  return <Bio {...props} />
}

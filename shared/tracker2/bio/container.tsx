import * as C from '@/constants'
import * as Constants from '@/constants/tracker2'
import Bio from '.'

type OwnProps = {
  inTracker: boolean
  username: string
}

const Container = (ownProps: OwnProps) => {
  const {inTracker, username} = ownProps
  const stateProps = C.useTrackerState(
    C.useShallow(s => {
      const d = Constants.getDetails(s, username)
      const common = {
        blocked: d.blocked,
        hidFromFollowers: d.hidFromFollowers,
      }

      if (d.state === 'notAUserYet') {
        const nonUser = Constants.getNonUserDetails(s, username)
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
    })
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  const followThem = C.useFollowerState(s => s.following.has(username))
  const followsYou = C.useFollowerState(s => s.followers.has(username))

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

export default Container

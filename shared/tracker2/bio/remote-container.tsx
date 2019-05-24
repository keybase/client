import * as Container from '../../util/container'
import Bio from '.'

type OwnProps = {
  username: string
}

const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bio: stateProps.bio,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  followsYou: stateProps.followsYou,
  fullname: stateProps.fullname,
  inTracker: true,
  location: stateProps.location,
  registeredForAirdrop: stateProps.registeredForAirdrop,
})

export default Container.remoteConnect(s => s, mapDispatchToProps, mergeProps)(Bio)

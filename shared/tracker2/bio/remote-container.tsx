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

// Just to get the stories working short term. TODO remove and use newer story wrapper
const ConnectedBio = __STORYBOOK__
  ? Container.namedConnect(s => s, mapDispatchToProps, mergeProps, 'Bio')(Bio)
  : Container.remoteConnect(s => s, mapDispatchToProps, mergeProps)(Bio)
export default ConnectedBio

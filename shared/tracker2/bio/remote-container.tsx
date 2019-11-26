import * as Container from '../../util/container'
import Bio from '.'

type OwnProps = {username: string}

const mapDispatchToProps = () => ({})
const mergeProps = (stateProps, _, ownProps: OwnProps) => ({
  airdropIsLive: stateProps.airdropIsLive,
  bio: stateProps.bio,
  blocked: stateProps.blocked,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  followsYou: stateProps.followsYou,
  fullname: stateProps.fullname,
  hidFromFollowers: stateProps.hidFromFollowers,
  inTracker: true,
  location: stateProps.location,
  registeredForAirdrop: stateProps.registeredForAirdrop,
  sbsDescription: undefined,
  username: ownProps.username,
  youAreInAirdrop: stateProps.youAreInAirdrop,
})

// Just to get the stories working short term. TODO remove and use newer story wrapper
const ConnectedBio = __STORYBOOK__
  ? Container.namedConnect(s => s, mapDispatchToProps, mergeProps, 'Bio')(Bio)
  : Container.remoteConnect(s => s, mapDispatchToProps, mergeProps)(Bio)
export default ConnectedBio

import * as Container from '../../util/container'
import Bio from '.'
import {DeserializeProps} from '../remote-serializer.desktop'

type OwnProps = {username: string}

const mergeProps = (stateProps: DeserializeProps, _, ownProps: OwnProps) => {
  const {bio, blocked, followThem, followersCount, followingCount, followsYou, fullname} = stateProps
  const {hidFromFollowers, location, stellarHidden} = stateProps
  const {username} = ownProps
  return {
    bio,
    blocked,
    followThem,
    followersCount,
    followingCount,
    followsYou,
    fullname,
    hidFromFollowers,
    inTracker: true,
    location,
    sbsDescription: undefined,
    stellarHidden,
    username,
  }
}

// Just to get the stories working short term. TODO remove and use newer story wrapper
const ConnectedBio = __STORYBOOK__
  ? Container.namedConnect(
      // @ts-ignore
      (s: DeserializeProps) => s,
      () => ({}),
      mergeProps,
      'Bio'
    )(Bio)
  : Container.remoteConnect(
      (s: DeserializeProps) => s,
      () => ({}),
      mergeProps
    )(Bio)
export default ConnectedBio

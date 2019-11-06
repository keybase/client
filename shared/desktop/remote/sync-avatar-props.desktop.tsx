// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as React from 'react'
import * as Container from '../../util/container'
import isEqual from 'lodash/isEqual'
import {intersect} from '../../util/set'
import {memoize} from '../../util/memoize'

type OwnProps = {
  usernames: Array<string>
  windowComponent: string
  windowParam: string
}

type Props = {
  followers: Set<string>
  following: Set<string>
  httpSrvAddress: string
  httpSrvToken: string
  usernames: Array<string>
  windowComponent: string
  windowParam: string
}

export const serialize = {
  followers: (v: any) => [...v],
  following: (v: any) => [...v],
  httpSrvAddress: (v: any) => v,
  httpSrvToken: (v: any) => v,
}

const initialState = {
  config: {
    avatarRefreshCounter: new Map(),
    followers: new Set(),
    following: new Set(),
    httpSrvAddress: '',
    httpSrvToken: '',
  },
}
export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state
  return {
    ...state,
    config: {
      ...state.config,
      ...(props.followers ? {followers: new Set(props.followers)} : {}),
      ...(props.following ? {following: new Set(props.following)} : {}),
      avatarRefreshCounter: initialState.config.avatarRefreshCounter,
      httpSrvAddress: props.httpSrvAddress || state.config.httpSrvAddress,
      httpSrvToken: props.httpSrvToken || state.config.httpSrvToken,
    },
  }
}

function SyncAvatarProps(ComposedComponent: any) {
  const RemoteAvatarConnected = (props: Props) => {
    const {usernamesRef, ...rest} = props
    return <ComposedComponent {...rest} />
  }

  const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
    const {usernames} = ownProps
    return {
      ...immutableCached(
        getRemoteFollowers(state.config.followers, usernames),
        getRemoteFollowing(stat.config.following, usernames)
      ),
      httpSrvAddress: state.config.httpSrvAddress,
      httpSrvToken: state.config.httpSrvToken,
    }
  }

  const getRemoteFollowers = memoize((followers: Set<string>, usernames: Set<string>) =>
    intersect(followers, usernames)
  )
  const getRemoteFollowing = memoize((following: Set<string>, usernames: Set<string>) =>
    intersect(following, usernames)
  )

  // use an immutable equals to not rerender if its the same
  const immutableCached = memoize(
    (followers: Set<string>, following: Set<string>) => ({followers, following}),
    (
      [newFollowers, newFollowing]: [Set<string>, Set<string>],
      [oldFollowers, oldFollowing]: [Set<string>, Set<string>]
    ) => isEqual(newFollowers, oldFollowers) && isEqual(newFollowing, oldFollowing)
  )

  const Connected = Container.connect(
    mapStateToProps,
    () => ({}),
    (s, d, o: OwnProps) => ({...o, ...s, ...d})
  )(RemoteAvatarConnected)

  type WrapperProps = {
    usernames: Array<string>
    windowComponent: string
    windowParam: string
  }

  const Wrapper = (props: WrapperProps) => {
    const usernames = new Set<string>(props.usernames)
    return <Connected {...props} usernamesRef={usernamesRef} />
  }

  return Wrapper
}

export default SyncAvatarProps

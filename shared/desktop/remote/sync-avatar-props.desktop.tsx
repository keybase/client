// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as React from 'react'
import * as Container from '../../util/container'
import isEqual from 'lodash/isEqual'
import {intersect} from '../../util/set'
import {memoize} from '../../util/memoize'

type OwnProps = {
  usernames: Set<string>
  windowComponent: string
  windowParam: string
}

type Props = {
  followers: Set<string>
  following: Set<string>
  httpSrvAddress: string
  httpSrvToken: string
  usernames: Set<string>
  windowComponent: string
  windowParam: string
}

export const serialize = {
  followers: (v: any) => [...v],
  following: (v: any) => [...v],
  httpSrvAddress: (v: any) => v,
  httpSrvToken: (v: any) => v,
  infoMap: (v: any) => [...v.entries()],
}

const initialState = {
  config: {
    avatarRefreshCounter: new Map(),
    followers: new Set(),
    following: new Set(),
    httpSrvAddress: '',
    httpSrvToken: '',
  },
  users: {
    infoMap: new Map(),
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
    users: {
      infoMap: new Map(props.infoMap),
    },
  }
}

// Prevent <Connected /> from re-rendering on new Sets when usernames
const getUsernamesSet = memoize(
  (usernames: Array<string>) => {
    return new Set<string>(usernames)
  },
  ([oldUsernames], [newUsername]) => isEqual(oldUsernames, newUsername)
)

function SyncAvatarProps(ComposedComponent: any) {
  const RemoteAvatarConnected = (props: Props) => <ComposedComponent {...props} />

  const getRemoteFollowers = memoize((followers: Set<string>, usernames: Set<string>) =>
    intersect(followers, usernames)
  )
  const getRemoteFollowing = memoize((following: Set<string>, usernames: Set<string>) =>
    intersect(following, usernames)
  )

  const getRemoteInfoMap = memoize((infoMap: Map<any, any>, usernames: Set<string>) => {
    const m = new Map()
    for (const u of usernames) {
      const i = infoMap.get(u)
      i && m.set(u, i)
    }
    return m
  })

  const Connected = Container.connect(
    state => {
      const {followers, following, httpSrvAddress, httpSrvToken} = state.config
      const {infoMap} = state.users
      return {
        _followers: followers,
        _following: following,
        _infoMap: infoMap,
        httpSrvAddress,
        httpSrvToken,
      }
    },
    () => ({}),
    (stateProps, _d, ownProps: OwnProps) => {
      const {usernames} = ownProps
      const {_followers, _following, httpSrvAddress, httpSrvToken, _infoMap} = stateProps
      return {
        followers: getRemoteFollowers(_followers, usernames),
        following: getRemoteFollowing(_following, usernames),
        httpSrvAddress,
        httpSrvToken,
        infoMap: getRemoteInfoMap(_infoMap, usernames),
        ...ownProps,
      }
    }
  )(RemoteAvatarConnected)

  type WrapperProps = {
    usernames: Array<string>
    windowComponent: string
    windowParam: string
  }

  const Wrapper = (props: WrapperProps) => {
    /*
     * Usernames is the the subset of the following/follower usernames to select before serializing and sending to the remote window.
     * For users with lots of followers/followees, we don't want to serialize and send lists with thousands of names over.
     *
     * In the case of the menubar widget, we only care about a subset of the uernames that have updated files.
     */
    const usernamesSet = getUsernamesSet(props.usernames)
    return <Connected {...props} usernames={usernamesSet} />
  }

  return Wrapper
}

export default SyncAvatarProps

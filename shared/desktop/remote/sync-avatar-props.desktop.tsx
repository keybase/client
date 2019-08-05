// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as I from 'immutable'
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Container from '../../util/container'
import {memoize} from '../../util/memoize'

type OwnProps = {
  usernames: I.Set<string>
  setUsernames: (arg0: I.Set<string>) => void
  remoteWindow: SafeElectron.BrowserWindowType | null
  windowComponent: string
  windowParam: string
}

type Props = {
  followers: I.Set<string>
  following: I.Set<string>
  httpSrvAddress: string
  httpSrvToken: string
  remoteWindow: SafeElectron.BrowserWindowType | null
  setUsernames: (arg0: I.Set<string>) => void
  usernames: I.Set<string>
  windowComponent: string
  windowParam: string
}

export const serialize = {
  followers: (v: any) => v.toArray(),
  following: (v: any) => v.toArray(),
  httpSrvAddress: (v: any) => v,
  httpSrvToken: (v: any) => v,
}

const initialState = {
  config: {
    avatarRefreshCounter: I.Map(),
    followers: I.Set(),
    following: I.Set(),
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
      ...(props.followers ? {followers: I.Set(props.followers)} : {}),
      ...(props.following ? {following: I.Set(props.following)} : {}),
      avatarRefreshCounter: initialState.config.avatarRefreshCounter,
      httpSrvAddress: props.httpSrvAddress || state.config.httpSrvAddress,
      httpSrvToken: props.httpSrvToken || state.config.httpSrvToken,
    },
  }
}

function SyncAvatarProps(ComposedComponent: any) {
  class RemoteAvatarConnected extends React.PureComponent<Props> {
    render() {
      const {setUsernames, usernames, ...rest} = this.props
      return <ComposedComponent {...rest} />
    }
  }

  const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
    ...immutableCached(
      getRemoteFollowers(state.config.followers, ownProps.usernames),
      getRemoteFollowing(state.config.following, ownProps.usernames)
    ),
    httpSrvAddress: state.config.httpSrvAddress,
    httpSrvToken: state.config.httpSrvToken,
  })

  const getRemoteFollowers = memoize((followers, usernames) => followers.intersect(usernames))
  const getRemoteFollowing = memoize((following, usernames) => following.intersect(usernames))

  // use an immutable equals to not rerender if its the same
  const immutableCached = memoize(
    (followers, following) => ({followers, following}),
    ([newFollowers, newFollowing], [oldFollowers, oldFollowing]) =>
      newFollowers.equals(oldFollowers) && newFollowing.equals(oldFollowing)
  )

  const Connected = Container.connect(
    mapStateToProps,
    () => ({}),
    (s, d, o: OwnProps) => ({...o, ...s, ...d})
  )(RemoteAvatarConnected)

  type WrapperProps = {
    remoteWindow: SafeElectron.BrowserWindowType | null
    windowComponent: string
    windowParam: string
  }

  class Wrapper extends React.PureComponent<
    WrapperProps,
    {
      usernames: I.Set<string>
    }
  > {
    state = {usernames: I.Set()}
    setUsernames = (usernames: I.Set<string>) => this.setState({usernames})
    render() {
      // @ts-ignore TODO fix
      return <Connected {...this.props} usernames={this.state.usernames} setUsernames={this.setUsernames} />
    }
  }

  return Wrapper
}

export default SyncAvatarProps

// @flow
// This HOC wraps a RemoteWindow so it can send avatar related props
// It listens for avatar related actions and bookkeeps them to send them back over the wire
import * as ConfigGen from '../../actions/config-gen'
import * as I from 'immutable'
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {connect} from '../../util/container'
import {memoize} from '../../util/memoize'

type OwnProps = {|
  usernames: I.Set<string>,
  setUsernames: (I.Set<string>) => void,
  remoteWindow: ?SafeElectron.BrowserWindowType,
  windowComponent: string,
  windowParam: string,
|}

type Props = {
  avatars: Object,
  followers: I.Set<string>,
  following: I.Set<string>,
  remoteWindow: ?SafeElectron.BrowserWindowType,
  setUsernames: (I.Set<string>) => void,
  usernames: I.Set<string>,
  windowComponent: string,
  windowParam: string,
}

export const serialize = {
  avatars: (v: any, o: any) => {
    if (!v) return undefined
    const toSend = v.filter((sizes, name) => {
      return !o || sizes !== o.get(name)
    })
    return toSend.isEmpty() ? undefined : toSend.toJS()
  },
  followers: (v: any) => v.toArray(),
  following: (v: any) => v.toArray(),
}

const initialState = {
  config: {
    avatars: I.Map(),
    followers: I.Set(),
    following: I.Set(),
  },
}
export const deserialize = (state: any = initialState, props: any) => {
  if (!props) return state

  const pa = props.avatars || {}
  const arrs = Object.keys(pa).reduce((arr, name) => {
    const sizes = Object.keys(pa[name]).reduce((arr, size) => {
      arr.push([size, pa[name][size]])
      return arr
    }, [])
    arr.push([name, I.Map(sizes)])
    return arr
  }, [])
  return {
    ...state,
    config: {
      ...state.config,
      avatars: (state.config.avatars || I.Map()).merge(I.Map(arrs)),
      ...(props.followers ? {followers: I.Set(props.followers)} : {}),
      ...(props.following ? {following: I.Set(props.following)} : {}),
    },
  }
}

function SyncAvatarProps(ComposedComponent: any) {
  class RemoteAvatarConnected extends React.PureComponent<Props> {
    _onRemoteActionFired = (
      event: any,
      action: {type: string, payload: Object},
      windowComponent: string,
      windowParam: string
    ) => {
      if (windowComponent === this.props.windowComponent && windowParam === this.props.windowParam) {
        if (action.type === ConfigGen.loadAvatars) {
          const {usernames} = action.payload
          this.props.setUsernames(this.props.usernames.concat(usernames))
        } else if (action.type === ConfigGen.loadTeamAvatars) {
          const {teamnames} = action.payload
          this.props.setUsernames(this.props.usernames.concat(teamnames))
        }
      }
    }

    componentDidMount() {
      SafeElectron.getIpcRenderer().on('dispatchAction', this._onRemoteActionFired)
    }
    componentWillUnmount() {
      SafeElectron.getIpcRenderer().removeListener('dispatchAction', this._onRemoteActionFired)
    }

    render() {
      const {setUsernames, usernames, ...rest} = this.props
      return <ComposedComponent {...rest} />
    }
  }

  const mapStateToProps = (state, ownProps) =>
    immutableCached(
      getRemoteAvatars(state.config.avatars, ownProps.usernames),
      getRemoteFollowers(state.config.followers, ownProps.usernames),
      getRemoteFollowing(state.config.following, ownProps.usernames)
    )

  const getRemoteAvatars = memoize((avatars, usernames) => avatars.filter((_, name) => usernames.has(name)))
  const getRemoteFollowers = memoize((followers, usernames) => followers.intersect(usernames))
  const getRemoteFollowing = memoize((following, usernames) => following.intersect(usernames))

  // use an immutable equals to not rerender if its the same
  const immutableCached = memoize(
    (avatars, followers, following) => ({avatars, followers, following}),
    ([newAvatars, newFollowers, newFollowing], [oldAvatars, oldFollowers, oldFollowing]) =>
      newAvatars.equals(oldAvatars) && newFollowers.equals(oldFollowers) && newFollowing.equals(oldFollowing)
  )

  const Connected = connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    () => ({}),
    (s, d, o) => ({...o, ...s, ...d})
  )(RemoteAvatarConnected)

  type WrapperProps = {
    remoteWindow: ?SafeElectron.BrowserWindowType,
    windowComponent: string,
    windowParam: string,
  }
  class Wrapper extends React.PureComponent<WrapperProps, {usernames: I.Set<string>}> {
    state = {usernames: I.Set()}
    setUsernames = (usernames: I.Set<string>) => this.setState({usernames})
    render() {
      return <Connected {...this.props} usernames={this.state.usernames} setUsernames={this.setUsernames} />
    }
  }

  return Wrapper
}

export default SyncAvatarProps
